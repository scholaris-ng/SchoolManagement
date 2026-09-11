import { In } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { StudentAccessService } from './studentAccess.service';
import { StudentDocument } from '../entities/studentDocument.entity';
import { StudentEnrollment } from '../entities/studentEnrollment.entity';
import { Student } from '../entities/student.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import type {
  PromotionResultDTO,
  StudentDocumentDTO,
  StudentEnrollmentDTO,
} from '../dto/students.dto';
import type {
  AddDocumentInput,
  PromoteStudentsInput,
} from '../validators/studentRelations.schema';

const ENROLLMENT_PROJECTION = `
  e.id, e.school_id AS "schoolId", e.student_id AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  e.session_id AS "sessionId", ses.name AS "sessionName",
  e.term_id AS "termId", t.name AS "termName",
  e.level_id AS "levelId", l.name AS "levelName",
  e.class_id AS "classId", c.name AS "className",
  e.status,
  to_char(e.enrolled_on, 'YYYY-MM-DD') AS "enrolledOn",
  to_char(e.exited_on,   'YYYY-MM-DD') AS "exitedOn",
  e.note
`;

/**
 * What hangs off a pupil's record: their history, their files, and the bulk
 * move at the end of a year.
 *
 * Split from `StudentsService` to keep both under the file-size limit in
 * `server_arch.md` section 17, and because these are genuinely a different
 * concern from the record itself.
 */
export class StudentRelationsService {
  static Instance = new StudentRelationsService();

  private constructor(
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchEnrollments(
    context: RequestContext,
    studentId: string,
  ): Promise<StudentEnrollmentDTO[]> {
    await this.assertVisible(context, studentId);

    return AppDataSource.query(
      `SELECT ${ENROLLMENT_PROJECTION}
       FROM student_enrollments e
       JOIN students s            ON s.id = e.student_id
       JOIN academic_sessions ses ON ses.id = e.session_id
       JOIN school_levels l       ON l.id = e.level_id
       JOIN school_classes c      ON c.id = e.class_id
       LEFT JOIN terms t          ON t.id = e.term_id
       WHERE e.school_id = $1 AND e.student_id = $2
       ORDER BY e.enrolled_on DESC`,
      [context.schoolId, studentId],
    );
  }

  // ─── Documents ─────────────────────────────────────────────────────────────

  async fetchDocuments(
    context: RequestContext,
    studentId: string,
  ): Promise<StudentDocumentDTO[]> {
    await this.assertVisible(context, studentId);

    const rows: (StudentDocumentDTO & { sizeBytes: string })[] = await AppDataSource.query(
      `SELECT id, school_id AS "schoolId", student_id AS "studentId", name, category,
              storage_path AS "storagePath", download_url AS "downloadUrl",
              mime_type AS "mimeType", size_bytes AS "sizeBytes",
              uploaded_by_name AS "uploadedByName", created_at AS "uploadedAt"
       FROM student_documents
       WHERE school_id = $1 AND student_id = $2
       ORDER BY created_at DESC`,
      [context.schoolId, studentId],
    );

    // bigint arrives as a string from pg; the client's type expects a number.
    return rows.map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) }));
  }

  async addDocument(
    context: RequestContext,
    studentId: string,
    input: AddDocumentInput,
  ): Promise<StudentDocumentDTO> {
    const student = await this.requireStudent(context, studentId);

    const repo = AppDataSource.getRepository(StudentDocument);
    const saved = await repo.save(
      repo.create({
        schoolId: context.schoolId,
        studentId,
        name: input.name,
        category: input.category,
        storagePath: input.storagePath,
        downloadUrl: input.downloadUrl ?? null,
        mimeType: input.mimeType,
        sizeBytes: String(input.sizeBytes),
        // Captured now, so the entry still reads correctly after this member
        // of staff has left.
        uploadedByName: context.user.displayName,
        uploadedByUserId: context.user.id,
      }),
    );

    await this.audit.record(context, {
      action: 'student.document_added',
      entityType: 'Student',
      entityId: studentId,
      entityLabel: `${student.firstName} ${student.lastName}`,
      after: { document: saved.name, category: saved.category },
    });

    const [dto] = await this.fetchDocumentsById(context.schoolId, saved.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async removeDocument(
    context: RequestContext,
    studentId: string,
    documentId: string,
  ): Promise<void> {
    const repo = AppDataSource.getRepository(StudentDocument);
    const document = await repo.findOne({
      where: { id: documentId, studentId, schoolId: context.schoolId },
    });
    if (!document) throw AppError.notFound('Document');

    await repo.delete({ id: documentId });

    // The object itself is removed by the storage adapter when that lands; the
    // path is recorded here so nothing is orphaned in the bucket.
    await this.audit.record(context, {
      action: 'student.document_removed',
      entityType: 'Student',
      entityId: studentId,
      before: { document: document.name, storagePath: document.storagePath },
      severity: 'WARNING',
    });
  }

  // ─── Promotion ─────────────────────────────────────────────────────────────

  /**
   * Moves a whole class up at the end of a session (spec section 13).
   *
   * Everyone in the class moves unless they are named as repeating or
   * graduating. The whole thing runs in one transaction: a promotion that
   * half-applied would leave pupils in two classes at once, or in none.
   *
   * Enrolments are closed and new ones opened rather than edited, so the
   * history a transcript is built from stays intact.
   */
  async promote(
    context: RequestContext,
    input: PromoteStudentsInput,
  ): Promise<PromotionResultDTO> {
    if (input.fromClassId === input.toClassId) {
      throw AppError.validation('Choose a different class to promote into.');
    }

    const [fromClass, toClass] = await Promise.all([
      this.requireClass(context, input.fromClassId),
      this.requireClass(context, input.toClassId),
    ]);

    const repeating = new Set(input.repeatStudentIds);
    const graduating = new Set(input.graduateStudentIds);

    const overlap = input.repeatStudentIds.filter((id) => graduating.has(id));
    if (overlap.length > 0) {
      throw AppError.validation('A student cannot both repeat and graduate.');
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const roll: { id: string }[] = await manager.query(
        `SELECT id FROM students
         WHERE school_id = $1 AND current_class_id = $2
           AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [context.schoolId, input.fromClassId],
      );

      // Grouped by outcome rather than walked student by student — a roll of
      // forty pupils used to mean up to 120 sequential round trips inside this
      // transaction. Each group below is one statement regardless of size.
      const rollIds = roll.map((row) => row.id);
      const graduatingIds = rollIds.filter((id) => graduating.has(id));
      const repeatingIds = rollIds.filter((id) => repeating.has(id) && !graduating.has(id));
      const promotedIds = rollIds.filter((id) => !graduating.has(id) && !repeating.has(id));

      const closeOutgoing = async (ids: string[], status: string) => {
        if (ids.length === 0) return;
        await manager.query(
          `UPDATE student_enrollments
              SET status = $3, exited_on = CURRENT_DATE, note = COALESCE($4, note), updated_at = now()
            WHERE school_id = $1 AND student_id = ANY($2::uuid[]) AND status = 'ACTIVE'`,
          [context.schoolId, ids, status, input.note || null],
        );
      };

      // Close every outgoing enrolment with the outcome it actually had.
      await closeOutgoing(graduatingIds, 'COMPLETED');
      await closeOutgoing(repeatingIds, 'REPEATED');
      await closeOutgoing(promotedIds, 'PROMOTED');

      if (graduatingIds.length > 0) {
        await manager.update(
          Student,
          { id: In(graduatingIds) },
          { status: 'GRADUATED', currentClassId: null },
        );
      }
      if (promotedIds.length > 0) {
        await manager.update(Student, { id: In(promotedIds) }, { currentClassId: toClass.id });
      }
      // A repeating pupil stays where they are, so their `students` row needs
      // no change — only a fresh enrolment, alongside everyone promoted.

      const enrolledOn = new Date().toISOString().slice(0, 10);
      const newEnrollments = [
        ...repeatingIds.map((id) => ({
          schoolId: context.schoolId,
          studentId: id,
          sessionId: input.nextSessionId,
          levelId: fromClass.levelId,
          classId: fromClass.id,
          status: 'ACTIVE' as const,
          enrolledOn,
          note: input.note || null,
        })),
        ...promotedIds.map((id) => ({
          schoolId: context.schoolId,
          studentId: id,
          sessionId: input.nextSessionId,
          levelId: toClass.levelId,
          classId: toClass.id,
          status: 'ACTIVE' as const,
          enrolledOn,
          note: input.note || null,
        })),
      ];
      if (newEnrollments.length > 0) {
        await manager.insert(StudentEnrollment, newEnrollments);
      }

      const promoted = promotedIds.length;
      const repeated = repeatingIds.length;
      const graduated = graduatingIds.length;

      // Recount both classes from the roll rather than adjusting by deltas —
      // after a bulk move, a derived counter should be re-derived.
      for (const classId of [input.fromClassId, input.toClassId]) {
        await manager.query(
          `UPDATE school_classes SET enrolled_count = (
             SELECT COUNT(*) FROM students
             WHERE current_class_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
           ) WHERE id = $1`,
          [classId],
        );
      }

      return { promoted, repeated, graduated };
    });

    await this.audit.record(context, {
      action: 'student.promoted',
      entityType: 'SchoolClass',
      entityId: input.fromClassId,
      entityLabel: `${fromClass.name} → ${toClass.name}`,
      after: { ...result, note: input.note || null },
      severity: 'WARNING',
    });

    return result;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async fetchDocumentsById(
    schoolId: string,
    id: string,
  ): Promise<StudentDocumentDTO[]> {
    const rows: (StudentDocumentDTO & { sizeBytes: string })[] = await AppDataSource.query(
      `SELECT id, school_id AS "schoolId", student_id AS "studentId", name, category,
              storage_path AS "storagePath", download_url AS "downloadUrl",
              mime_type AS "mimeType", size_bytes AS "sizeBytes",
              uploaded_by_name AS "uploadedByName", created_at AS "uploadedAt"
       FROM student_documents WHERE school_id = $1 AND id = $2`,
      [schoolId, id],
    );
    return rows.map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) }));
  }

  private async assertVisible(context: RequestContext, studentId: string): Promise<void> {
    if (!(await this.access.canSeeStudent(context, studentId))) {
      throw AppError.notFound('Student');
    }
  }

  private async requireStudent(context: RequestContext, studentId: string): Promise<Student> {
    const student = await AppDataSource.getRepository(Student).findOne({
      where: { id: studentId, schoolId: context.schoolId },
    });
    if (!student) throw AppError.notFound('Student');
    return student;
  }

  private async requireClass(context: RequestContext, classId: string): Promise<SchoolClass> {
    const schoolClass = await AppDataSource.getRepository(SchoolClass).findOne({
      where: { id: classId, schoolId: context.schoolId },
    });
    if (!schoolClass) throw AppError.notFound('Class');
    return schoolClass;
  }
}
