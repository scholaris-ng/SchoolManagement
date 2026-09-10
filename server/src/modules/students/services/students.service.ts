import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { StudentRepository } from '../repositories/student.repository';
import { StudentAccessService } from './studentAccess.service';
import { Student } from '../entities/student.entity';
import { StudentEnrollment } from '../entities/studentEnrollment.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import type { StudentDTO, StudentSummaryDTO } from '../dto/students.dto';
import type {
  ChangeStatusInput,
  CreateStudentInput,
  FetchStudentsQuery,
  SearchStudentsQuery,
  UpdateStudentInput,
} from '../validators/students.schema';

/** Empty strings from an optional form field mean "not provided", not "set to blank". */
function nullIfBlank<T extends string | null | undefined>(value: T): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed ? trimmed : null;
}

export class StudentsService {
  static Instance = new StudentsService();

  private constructor(
    private readonly students = StudentRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchStudents(
    context: RequestContext,
    query: FetchStudentsQuery,
  ): Promise<Paginated<StudentDTO>> {
    return this.students.fetchPaginated(context.schoolId, {
      ...query,
      visibleIds: await this.access.visibleStudentIds(context),
    });
  }

  async search(
    context: RequestContext,
    query: SearchStudentsQuery,
  ): Promise<Paginated<StudentSummaryDTO>> {
    const visibleIds = await this.access.visibleStudentIds(context);
    const items = await this.students.search(
      context.schoolId,
      query.search,
      query.pageSize,
      visibleIds,
    );
    // The client types this as paginated even though it is a typeahead, so the
    // envelope matches rather than being a special case for one endpoint.
    return {
      items,
      meta: {
        page: 1,
        pageSize: query.pageSize,
        total: items.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };
  }

  async fetchStudent(context: RequestContext, id: string): Promise<StudentDTO> {
    const student = await this.students.findOneDTO(context.schoolId, id);
    if (!student) throw AppError.notFound('Student');

    // "Not found" rather than "forbidden": that a child attends this school is
    // not something an unrelated parent gets to confirm.
    if (!(await this.access.canSeeStudent(context, id))) throw AppError.notFound('Student');

    return student;
  }

  async createStudent(context: RequestContext, input: CreateStudentInput): Promise<StudentDTO> {
    const clash = await this.students.findByAdmissionNo(context.schoolId, input.admissionNo);
    if (clash) throw AppError.conflict('That admission number is already in use.');

    const schoolClass = await this.requireClass(context, input.currentClassId);

    const created = await AppDataSource.transaction(async (manager) => {
      const student = await manager.save(
        manager.create(Student, {
          schoolId: context.schoolId,
          admissionNo: input.admissionNo,
          firstName: input.firstName,
          middleName: nullIfBlank(input.middleName),
          lastName: input.lastName,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth,
          admissionDate: input.admissionDate,
          status: 'ACTIVE',
          currentClassId: schoolClass.id,
          houseId: nullIfBlank(input.houseId),
          photoUrl: input.photoUrl ?? null,
          photoStoragePath: input.photoStoragePath ?? null,
          photoConsent: input.photoConsent,
          bloodGroup: nullIfBlank(input.bloodGroup),
          medicalNotes: nullIfBlank(input.medicalNotes),
          emergencyContactName: nullIfBlank(input.emergencyContactName),
          emergencyContactPhone: nullIfBlank(input.emergencyContactPhone),
          address: nullIfBlank(input.address),
          nationality: nullIfBlank(input.nationality),
          stateOfOrigin: nullIfBlank(input.stateOfOrigin),
          religion: nullIfBlank(input.religion),
          customFields: input.customFields ?? {},
        }),
      );

      // Admission opens the first enrolment. Without it the pupil has a class
      // but no history, and next year's promotion has nothing to close.
      const session = await this.currentSessionId(manager, context.schoolId);
      if (session) {
        await manager.save(
          manager.create(StudentEnrollment, {
            schoolId: context.schoolId,
            studentId: student.id,
            sessionId: session,
            levelId: schoolClass.levelId,
            classId: schoolClass.id,
            status: 'ACTIVE',
            enrolledOn: input.admissionDate,
          }),
        );
      }

      await manager.increment(SchoolClass, { id: schoolClass.id }, 'enrolledCount', 1);
      return student;
    });

    await this.audit.record(context, {
      action: 'student.created',
      entityType: 'Student',
      entityId: created.id,
      entityLabel: `${created.firstName} ${created.lastName}`,
      after: { admissionNo: created.admissionNo, classId: created.currentClassId },
    });

    const dto = await this.students.findOneDTO(context.schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateStudent(
    context: RequestContext,
    id: string,
    patch: UpdateStudentInput,
    expectedVersion: number | undefined,
  ): Promise<StudentDTO> {
    const existing = await this.students.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Student');

    if (patch.admissionNo && patch.admissionNo !== existing.admissionNo) {
      const clash = await this.students.findByAdmissionNo(context.schoolId, patch.admissionNo);
      if (clash) throw AppError.conflict('That admission number is already in use.');
    }

    // Moving class keeps both class counters honest.
    let movedTo: SchoolClass | null = null;
    if (patch.currentClassId && patch.currentClassId !== existing.currentClassId) {
      movedTo = await this.requireClass(context, patch.currentClassId);
    }

    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      columns[key] =
        typeof value === 'string' && key !== 'admissionNo' && key !== 'firstName' && key !== 'lastName'
          ? nullIfBlank(value)
          : value;
    }

    if (expectedVersion !== undefined) {
      const applied = await this.students.updateIfVersionMatches(id, expectedVersion, columns);
      if (!applied) throw AppError.versionConflict();
    } else {
      await this.students.update(id, columns);
    }

    if (movedTo) {
      await AppDataSource.transaction(async (manager) => {
        if (existing.currentClassId) {
          await manager.decrement(
            SchoolClass,
            { id: existing.currentClassId },
            'enrolledCount',
            1,
          );
        }
        await manager.increment(SchoolClass, { id: movedTo.id }, 'enrolledCount', 1);
      });
    }

    await this.audit.record(context, {
      action: 'student.updated',
      entityType: 'Student',
      entityId: id,
      entityLabel: `${existing.firstName} ${existing.lastName}`,
      before: { classId: existing.currentClassId, status: existing.status },
      after: { classId: patch.currentClassId ?? existing.currentClassId },
    });

    const dto = await this.students.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Student');
    return dto;
  }

  /**
   * Moves a pupil between statuses, closing their enrolment when they leave.
   *
   * Always audited at WARNING: a withdrawal or transfer changes what the school
   * owes, who may collect the child, and whether they appear on a register.
   */
  async changeStatus(
    context: RequestContext,
    id: string,
    input: ChangeStatusInput,
  ): Promise<StudentDTO> {
    const student = await this.students.findByIdScoped(context.schoolId, id);
    if (!student) throw AppError.notFound('Student');
    if (student.status === input.status) {
      throw AppError.conflict(`This student is already ${input.status.toLowerCase()}.`);
    }

    const leaving = input.status !== 'ACTIVE' && input.status !== 'SUSPENDED';

    await AppDataSource.transaction(async (manager) => {
      await manager.update(Student, { id }, { status: input.status });

      if (leaving) {
        await manager.query(
          `UPDATE student_enrollments
              SET status = $3, exited_on = $4, note = COALESCE($5, note), updated_at = now()
            WHERE school_id = $1 AND student_id = $2 AND status = 'ACTIVE'`,
          [
            context.schoolId,
            id,
            input.status === 'GRADUATED' ? 'COMPLETED' : input.status,
            input.effectiveDate,
            nullIfBlank(input.reason),
          ],
        );

        // They no longer occupy a place.
        if (student.currentClassId) {
          await manager.decrement(SchoolClass, { id: student.currentClassId }, 'enrolledCount', 1);
        }
        await manager.update(Student, { id }, { currentClassId: null });
      }
    });

    await this.audit.record(context, {
      action: 'student.status_changed',
      entityType: 'Student',
      entityId: id,
      entityLabel: `${student.firstName} ${student.lastName}`,
      before: { status: student.status },
      after: {
        status: input.status,
        effectiveDate: input.effectiveDate,
        reason: nullIfBlank(input.reason),
        destinationSchool: nullIfBlank(input.destinationSchool),
      },
      severity: 'WARNING',
    });

    const dto = await this.students.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Student');
    return dto;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireClass(context: RequestContext, classId: string): Promise<SchoolClass> {
    const schoolClass = await AppDataSource.getRepository(SchoolClass).findOne({
      where: { id: classId, schoolId: context.schoolId },
    });
    if (!schoolClass) throw AppError.notFound('Class');
    return schoolClass;
  }

  private async currentSessionId(
    manager: { query: (sql: string, params: unknown[]) => Promise<{ id: string }[]> },
    schoolId: string,
  ): Promise<string | null> {
    const [row] = await manager.query(
      `SELECT id FROM academic_sessions
       WHERE school_id = $1 AND is_current = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [schoolId],
    );
    return row?.id ?? null;
  }
}
