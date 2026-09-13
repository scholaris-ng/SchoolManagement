import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { SchemeOfWork } from '../entities/schemeOfWork.entity';
import { SchemeWeek } from '../entities/schemeWeek.entity';
import { LessonNote } from '../entities/lessonNote.entity';
import type { LessonNoteDTO, SchemeOfWorkDTO, SchemeSummaryDTO, SchemeWeekDTO } from '../dto/scheme.dto';
import type { CurriculumVisibility } from './curriculum.repository';

const SCHEME_PROJECTION = `
  s.id, s.school_id AS "schoolId",
  s.subject_id AS "subjectId", sub.name AS "subjectName",
  s.class_id AS "classId", c.name AS "className",
  s.term_id AS "termId", t.name AS "termName", ses.name AS "sessionName",
  s.curriculum_id AS "curriculumId", s.status,
  COALESCE(s.created_by_user_id::text, '') AS "createdById",
  s.created_by_name AS "createdByName",
  s.approved_by_name AS "approvedByName", s.approved_at AS "approvedAt",
  s.version,
  (SELECT COUNT(*)::int FROM scheme_weeks w WHERE w.scheme_id = s.id) AS "weekCount"
`;

const SCHEME_FROM = `
  FROM schemes_of_work s
  JOIN subjects sub ON sub.id = s.subject_id
  JOIN school_classes c ON c.id = s.class_id
  JOIN terms t ON t.id = s.term_id
  JOIN academic_sessions ses ON ses.id = t.session_id
`;

const WEEK_PROJECTION = `
  w.id, w.week_number AS "weekNumber",
  to_char(w.start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(w.end_date, 'YYYY-MM-DD') AS "endDate",
  w.topic_id AS "topicId", w.topic_title AS "topicTitle",
  w.objective_ids AS "objectiveIds", w.objective_statements AS "objectiveStatements",
  w.activities, w.resources, w.is_break AS "isBreak"
`;

const NOTE_PROJECTION = `
  n.id, n.school_id AS "schoolId", n.teacher_id AS "teacherId", n.teacher_name AS "teacherName",
  n.scheme_id AS "schemeId", n.scheme_week_id AS "schemeWeekId",
  n.class_id AS "classId", c.name AS "className",
  n.subject_id AS "subjectId", sub.name AS "subjectName",
  n.term_id AS "termId", n.week_number AS "weekNumber",
  to_char(n.date, 'YYYY-MM-DD') AS date, n.topic,
  n.objective_ids AS "objectiveIds", n.objective_statements AS "objectiveStatements",
  n.content, n.resources, n.assignment, n.challenges, n.student_difficulties AS "studentDifficulties",
  n.status, n.reviewer_name AS "reviewerName", n.reviewed_at AS "reviewedAt", n.review_comment AS "reviewComment",
  n.version
`;

const NOTE_FROM = `
  FROM lesson_notes n
  JOIN school_classes c ON c.id = n.class_id
  JOIN subjects sub ON sub.id = n.subject_id
`;

export interface SchemeFilter {
  page: number;
  pageSize: number;
  search?: string;
  classId?: string;
  subjectId?: string;
  status?: string;
  visibility: CurriculumVisibility;
}

export interface NoteFilter {
  page: number;
  pageSize: number;
  search?: string;
  classId?: string;
  subjectId?: string;
  status?: string;
  /** Null means every teacher's notes; otherwise only this member of staff's. */
  teacherId: string | null;
}

/** The scheme side of the pair-or-author visibility clause used for curricula. */
function visibilityClause(params: unknown[], where: string[], visibility: CurriculumVisibility): void {
  if (visibility.pairs === null) return;
  params.push(visibility.pairs.map((pair) => pair.classId));
  const classes = params.length;
  params.push(visibility.pairs.map((pair) => pair.subjectId));
  const subjects = params.length;
  params.push(visibility.authorUserId);
  const author = params.length;
  where.push(
    `(EXISTS (
        SELECT 1 FROM unnest($${classes}::uuid[], $${subjects}::uuid[]) AS pair(class_id, subject_id)
         WHERE pair.class_id = s.class_id AND pair.subject_id = s.subject_id
      ) OR s.created_by_user_id = $${author})`,
  );
}

export class SchemeRepository extends TenantRepository<SchemeOfWork> {
  static Instance = new SchemeRepository();

  private constructor() {
    super(SchemeOfWork, 'scheme');
  }

  /* -- Schemes --------------------------------------------------------------- */

  async fetchPaginated(schoolId: string, filter: SchemeFilter): Promise<Paginated<SchemeSummaryDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['s.school_id = $1'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('s.class_id', filter.classId);
    eq('s.subject_id', filter.subjectId);
    eq('s.status', filter.status);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(`(sub.name ILIKE $${i} OR c.name ILIKE $${i} OR s.created_by_name ILIKE $${i})`);
    }
    visibilityClause(params, where, filter.visibility);
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${SCHEME_FROM} WHERE ${whereSql}`, params);
    const rows: Omit<SchemeSummaryDTO, 'weeks'>[] = await this.repo.query(
      `SELECT ${SCHEME_PROJECTION} ${SCHEME_FROM}
        WHERE ${whereSql}
        ORDER BY ses.start_date DESC, t.sequence DESC, c.name ASC, sub.name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(
      rows.map((row) => ({ ...row, weeks: [] as [] })),
      filter.page,
      filter.pageSize,
      Number(countRow?.total ?? 0),
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<SchemeOfWorkDTO | null> {
    const rows: (Omit<SchemeOfWorkDTO, 'weeks'> & { weekCount: number })[] = await this.repo.query(
      `SELECT ${SCHEME_PROJECTION} ${SCHEME_FROM} WHERE s.school_id = $1 AND s.id = $2`,
      [schoolId, id],
    );
    const row = rows[0];
    if (!row) return null;
    const weeks = await this.weeksFor(schoolId, id);
    const { weekCount: _weekCount, ...scheme } = row;
    return { ...scheme, weeks };
  }

  async findByCurriculumAndTerm(schoolId: string, curriculumId: string, termId: string): Promise<SchemeOfWork | null> {
    return this.repo.findOne({ where: { schoolId, curriculumId, termId } });
  }

  async findEntity(schoolId: string, id: string): Promise<SchemeOfWork | null> {
    return this.repo.findOne({ where: { schoolId, id } });
  }

  async createWithWeeks(
    scheme: DeepPartial<SchemeOfWork>,
    weeks: Omit<DeepPartial<SchemeWeek>, 'schemeId' | 'schoolId'>[],
    manager: EntityManager,
  ): Promise<SchemeOfWork> {
    const schemeRepo = manager.getRepository(SchemeOfWork);
    const saved = await schemeRepo.save(schemeRepo.create(scheme));
    const weekRepo = manager.getRepository(SchemeWeek);
    await weekRepo.save(
      weeks.map((week) => weekRepo.create({ ...week, schemeId: saved.id, schoolId: saved.schoolId })),
    );
    return saved;
  }

  /**
   * Replaces the content of every week in one go and bumps the version, but
   * only if the caller's version is still current. Week rows are matched by
   * id, so a week's number and dates are the slot's and cannot be moved.
   */
  async saveWeeksIfVersionMatches(
    schoolId: string,
    id: string,
    expectedVersion: number,
    weeks: Pick<SchemeWeekDTO, 'id' | 'topicId' | 'topicTitle' | 'objectiveIds' | 'objectiveStatements' | 'activities' | 'resources' | 'isBreak'>[],
    patch: DeepPartial<SchemeOfWork>,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(SchemeOfWork)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND school_id = :schoolId AND version = :expectedVersion', {
        id,
        schoolId,
        expectedVersion,
      })
      .execute();
    if ((result.affected ?? 0) === 0) return false;

    const weekRepo = manager.getRepository(SchemeWeek);
    for (const week of weeks) {
      await weekRepo.update(
        { id: week.id, schemeId: id, schoolId },
        {
          topicId: week.topicId,
          topicTitle: week.topicTitle,
          objectiveIds: week.objectiveIds,
          objectiveStatements: week.objectiveStatements,
          activities: week.activities,
          resources: week.resources,
          isBreak: week.isBreak,
        },
      );
    }
    return true;
  }

  async weeksFor(schoolId: string, schemeId: string): Promise<SchemeWeekDTO[]> {
    return this.repo.query(
      `SELECT ${WEEK_PROJECTION} FROM scheme_weeks w
        WHERE w.school_id = $1 AND w.scheme_id = $2
        ORDER BY w.week_number ASC`,
      [schoolId, schemeId],
    );
  }

  async findWeek(schoolId: string, schemeId: string, weekId: string): Promise<SchemeWeekDTO | null> {
    const rows: SchemeWeekDTO[] = await this.repo.query(
      `SELECT ${WEEK_PROJECTION} FROM scheme_weeks w
        WHERE w.school_id = $1 AND w.scheme_id = $2 AND w.id = $3`,
      [schoolId, schemeId, weekId],
    );
    return rows[0] ?? null;
  }

  /* -- Lesson notes ---------------------------------------------------------- */

  async fetchNotes(schoolId: string, filter: NoteFilter): Promise<Paginated<LessonNoteDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['n.school_id = $1'];
    const eq = (column: string, value: string | undefined | null) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('n.class_id', filter.classId);
    eq('n.subject_id', filter.subjectId);
    eq('n.status', filter.status);
    eq('n.teacher_id', filter.teacherId);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(`(n.topic ILIKE $${i} OR sub.name ILIKE $${i} OR c.name ILIKE $${i} OR n.teacher_name ILIKE $${i})`);
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${NOTE_FROM} WHERE ${whereSql}`, params);
    const rows: LessonNoteDTO[] = await this.repo.query(
      `SELECT ${NOTE_PROJECTION} ${NOTE_FROM}
        WHERE ${whereSql}
        ORDER BY n.date DESC, n.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findNoteDTO(schoolId: string, id: string): Promise<LessonNoteDTO | null> {
    const rows: LessonNoteDTO[] = await this.repo.query(
      `SELECT ${NOTE_PROJECTION} ${NOTE_FROM} WHERE n.school_id = $1 AND n.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * Weeks of an approved scheme this teacher has no note for yet — the
   * dashboard's "lesson notes due". Only weeks already begun count; next
   * month's is not late.
   */
  async weeksAwaitingNotes(
    schoolId: string,
    teacherId: string,
    today: string,
  ): Promise<{ id: string; className: string; subjectName: string; weekNumber: number }[]> {
    return this.repo.query(
      `SELECT w.id, c.name AS "className", sub.name AS "subjectName", w.week_number AS "weekNumber"
         FROM scheme_weeks w
         JOIN schemes_of_work s ON s.id = w.scheme_id
         JOIN school_classes c ON c.id = s.class_id
         JOIN subjects sub ON sub.id = s.subject_id
         JOIN terms t ON t.id = s.term_id AND t.is_current = TRUE
        WHERE w.school_id = $1
          AND s.status = 'APPROVED'
          AND NOT w.is_break
          AND w.start_date <= $3::date
          AND EXISTS (
            SELECT 1 FROM teaching_assignments ta
             WHERE ta.staff_id = $2 AND ta.class_id = s.class_id AND ta.subject_id = s.subject_id
          )
          AND NOT EXISTS (
            SELECT 1 FROM lesson_notes n WHERE n.scheme_week_id = w.id AND n.teacher_id = $2
          )
        ORDER BY w.start_date ASC
        LIMIT 10`,
      [schoolId, teacherId, today],
    );
  }

  /** Coverage per plan for one teacher — the same taught/total the report uses. */
  async coverageForTeacher(
    schoolId: string,
    teacherId: string,
  ): Promise<{ subjectName: string; className: string; coverageRate: number }[]> {
    const rows: { subjectName: string; className: string; coverageRate: string }[] = await this.repo.query(
      `SELECT sub.name AS "subjectName", c.name AS "className",
              COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE o.taught_at IS NOT NULL) / NULLIF(COUNT(o.id), 0)), 0) AS "coverageRate"
         FROM curricula cur
         JOIN subjects sub ON sub.id = cur.subject_id
         JOIN school_classes c ON c.id = cur.class_id
         JOIN academic_sessions ses ON ses.id = cur.session_id AND ses.is_current = TRUE
         LEFT JOIN curriculum_topics t ON t.curriculum_id = cur.id
         LEFT JOIN learning_objectives o ON o.topic_id = t.id
        WHERE cur.school_id = $1
          AND EXISTS (
            SELECT 1 FROM teaching_assignments ta
             WHERE ta.staff_id = $2 AND ta.class_id = cur.class_id AND ta.subject_id = cur.subject_id
          )
        GROUP BY sub.name, c.name
        ORDER BY "coverageRate" ASC`,
      [schoolId, teacherId],
    );
    return rows.map((row) => ({ ...row, coverageRate: Number(row.coverageRate) }));
  }

  async createNote(data: DeepPartial<LessonNote>): Promise<LessonNote> {
    const repo = this.repo.manager.getRepository(LessonNote);
    return repo.save(repo.create(data));
  }

  async updateNoteIfVersionMatches(
    schoolId: string,
    id: string,
    expectedVersion: number | undefined,
    patch: DeepPartial<LessonNote>,
  ): Promise<boolean> {
    const builder = this.repo.manager
      .createQueryBuilder()
      .update(LessonNote)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND school_id = :schoolId', { id, schoolId });
    if (expectedVersion !== undefined) builder.andWhere('version = :expectedVersion', { expectedVersion });
    const result = await builder.execute();
    return (result.affected ?? 0) > 0;
  }

  async removeNotes(schoolId: string, ids: string[], teacherId: string | null): Promise<number> {
    if (ids.length === 0) return 0;
    const params: unknown[] = [schoolId, ids];
    const teacherClause = teacherId ? 'AND teacher_id = $3' : '';
    if (teacherId) params.push(teacherId);
    const [, affected]: [unknown[], number] = await this.repo.query(
      `DELETE FROM lesson_notes
        WHERE school_id = $1 AND id = ANY($2::uuid[]) AND status IN ('DRAFT', 'RETURNED') ${teacherClause}`,
      params,
    );
    return Number(affected ?? 0);
  }
}
