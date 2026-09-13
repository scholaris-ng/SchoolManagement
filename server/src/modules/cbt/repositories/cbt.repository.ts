import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Question } from '../entities/question.entity';
import { CbtAssessment, CbtAttempt } from '../entities/cbtAssessment.entity';
import type { CbtAssessmentDTO, QuestionDTO } from '../dto/cbt.dto';

const QUESTION_PROJECTION = `
  q.id, q.school_id AS "schoolId",
  q.subject_id AS "subjectId", sub.name AS "subjectName",
  q.topic_id AS "topicId", t.title AS "topicTitle",
  q.objective_id AS "objectiveId", o.statement AS "objectiveStatement",
  q.level_id AS "levelId", q.type, q.difficulty, q.text, q.image_url AS "imageUrl",
  q.options, q.correct_answer AS "correctAnswer", q.explanation, q.marks,
  q.usage_count AS "usageCount", q.created_by_name AS "createdByName", q.created_at AS "createdAt"
`;

const QUESTION_FROM = `
  FROM questions q
  JOIN subjects sub ON sub.id = q.subject_id
  LEFT JOIN curriculum_topics t ON t.id = q.topic_id
  LEFT JOIN learning_objectives o ON o.id = q.objective_id
`;

const ASSESSMENT_PROJECTION = `
  a.id, a.school_id AS "schoolId", a.title, a.mode,
  a.subject_id AS "subjectId", sub.name AS "subjectName",
  a.class_ids AS "classIds", a.term_id AS "termId", a.question_ids AS "questionIds",
  a.duration_minutes AS "durationMinutes", a.attempts_allowed AS "attemptsAllowed",
  a.starts_at AS "startsAt", a.ends_at AS "endsAt",
  a.shuffle_questions AS "shuffleQuestions", a.shuffle_options AS "shuffleOptions",
  a.show_result_immediately AS "showResultImmediately", a.pass_score AS "passScore",
  a.state, a.created_by_name AS "createdByName", a.version,
  COALESCE(array_length(a.question_ids, 1), 0) AS "questionCount",
  (SELECT COALESCE(SUM(q.marks), 0)::int FROM questions q WHERE q.id = ANY(a.question_ids)) AS "totalMarks",
  (SELECT COUNT(*)::int FROM cbt_attempts at WHERE at.assessment_id = a.id AND at.status IN ('SUBMITTED', 'GRADED')) AS "submissionCount",
  (SELECT ROUND(AVG(at.score), 1) FROM cbt_attempts at WHERE at.assessment_id = a.id AND at.score IS NOT NULL) AS "averageScore",
  (SELECT COALESCE(array_agg(c.name ORDER BY c.name), '{}') FROM school_classes c WHERE c.id = ANY(a.class_ids)) AS "classNames"
`;

const ASSESSMENT_FROM = `
  FROM cbt_assessments a
  JOIN subjects sub ON sub.id = a.subject_id
`;

export interface QuestionFilter {
  page: number;
  pageSize: number;
  search?: string;
  subjectId?: string;
  topicId?: string;
  objectiveId?: string;
  difficulty?: string;
  type?: string;
  /** Subjects the caller may see; null for everyone. */
  subjectIds: string[] | null;
}

export interface AssessmentFilter {
  page: number;
  pageSize: number;
  search?: string;
  subjectId?: string;
  mode?: string;
  state?: string;
  /** Classes a candidate belongs to; null means the caller is staff. */
  classIds: string[] | null;
}

export class CbtRepository extends TenantRepository<Question> {
  static Instance = new CbtRepository();

  private constructor() {
    super(Question, 'question');
  }

  /* -- Questions ------------------------------------------------------------- */

  async fetchQuestions(schoolId: string, filter: QuestionFilter): Promise<Paginated<QuestionDTO>> {
    if (filter.subjectIds && filter.subjectIds.length === 0) {
      return paginatedResult<QuestionDTO>([], filter.page, filter.pageSize, 0);
    }
    const params: unknown[] = [schoolId];
    const where = ['q.school_id = $1'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('q.subject_id', filter.subjectId);
    eq('q.topic_id', filter.topicId);
    eq('q.objective_id', filter.objectiveId);
    eq('q.difficulty', filter.difficulty);
    eq('q.type', filter.type);
    if (filter.subjectIds) {
      params.push(filter.subjectIds);
      where.push(`q.subject_id = ANY($${params.length}::uuid[])`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(`q.text ILIKE $${params.length}`);
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${QUESTION_FROM} WHERE ${whereSql}`, params);
    const rows: QuestionDTO[] = await this.repo.query(
      `SELECT ${QUESTION_PROJECTION} ${QUESTION_FROM}
        WHERE ${whereSql}
        ORDER BY q.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findQuestionDTO(schoolId: string, id: string): Promise<QuestionDTO | null> {
    const rows: QuestionDTO[] = await this.repo.query(
      `SELECT ${QUESTION_PROJECTION} ${QUESTION_FROM} WHERE q.school_id = $1 AND q.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async questionsByIds(schoolId: string, ids: string[]): Promise<QuestionDTO[]> {
    if (ids.length === 0) return [];
    return this.repo.query(
      `SELECT ${QUESTION_PROJECTION} ${QUESTION_FROM} WHERE q.school_id = $1 AND q.id = ANY($2::uuid[])`,
      [schoolId, ids],
    );
  }

  async createQuestion(data: DeepPartial<Question>): Promise<Question> {
    return this.repo.save(this.repo.create(data));
  }

  async updateQuestion(schoolId: string, id: string, patch: DeepPartial<Question>): Promise<void> {
    await this.repo.update({ id, schoolId }, patch as never);
  }

  async removeQuestion(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }

  /** Which papers already use a question — what stops one being deleted out from under them. */
  async papersUsing(schoolId: string, questionId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM cbt_assessments WHERE school_id = $1 AND $2 = ANY(question_ids)`,
      [schoolId, questionId],
    );
    return Number(row?.total ?? 0);
  }

  async countQuestionUse(schoolId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo.query(
      `UPDATE questions SET usage_count = usage_count + 1 WHERE school_id = $1 AND id = ANY($2::uuid[])`,
      [schoolId, ids],
    );
  }

  /* -- Assessments ----------------------------------------------------------- */

  async fetchAssessments(schoolId: string, filter: AssessmentFilter): Promise<Paginated<CbtAssessmentDTO>> {
    if (filter.classIds && filter.classIds.length === 0) {
      return paginatedResult<CbtAssessmentDTO>([], filter.page, filter.pageSize, 0);
    }
    const params: unknown[] = [schoolId];
    const where = ['a.school_id = $1'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('a.subject_id', filter.subjectId);
    eq('a.mode', filter.mode);
    eq('a.state', filter.state);
    if (filter.classIds) {
      params.push(filter.classIds);
      // A candidate sees the papers set for their class, and only once they open.
      where.push(`a.class_ids && $${params.length}::uuid[]`);
      where.push(`a.state IN ('OPEN', 'CLOSED', 'GRADED')`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(`a.title ILIKE $${params.length}`);
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${ASSESSMENT_FROM} WHERE ${whereSql}`, params);
    const rows: (CbtAssessmentDTO & { averageScore: string | null })[] = await this.repo.query(
      `SELECT ${ASSESSMENT_PROJECTION} ${ASSESSMENT_FROM}
        WHERE ${whereSql}
        ORDER BY COALESCE(a.starts_at, a.created_at) DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(
      rows.map((row) => ({ ...row, averageScore: row.averageScore === null ? null : Number(row.averageScore) })),
      filter.page,
      filter.pageSize,
      Number(countRow?.total ?? 0),
    );
  }

  async findAssessmentDTO(schoolId: string, id: string): Promise<CbtAssessmentDTO | null> {
    const rows: (CbtAssessmentDTO & { averageScore: string | null })[] = await this.repo.query(
      `SELECT ${ASSESSMENT_PROJECTION} ${ASSESSMENT_FROM} WHERE a.school_id = $1 AND a.id = $2`,
      [schoolId, id],
    );
    const row = rows[0];
    return row ? { ...row, averageScore: row.averageScore === null ? null : Number(row.averageScore) } : null;
  }

  /** Papers this teacher set that have not opened yet — the dashboard's tile. */
  async upcomingForTeacher(
    schoolId: string,
    teacherId: string,
    limit: number,
  ): Promise<{ id: string; title: string; startsAt: string; className: string }[]> {
    return this.repo.query(
      `SELECT a.id, a.title, a.starts_at AS "startsAt",
              COALESCE((SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM school_classes c WHERE c.id = ANY(a.class_ids)), '') AS "className"
         FROM cbt_assessments a
        WHERE a.school_id = $1
          AND a.starts_at IS NOT NULL
          AND a.starts_at > now()
          AND a.state IN ('SCHEDULED', 'OPEN')
          AND EXISTS (
            SELECT 1 FROM teaching_assignments ta
             WHERE ta.staff_id = $2 AND ta.subject_id = a.subject_id AND ta.class_id = ANY(a.class_ids)
          )
        ORDER BY a.starts_at ASC
        LIMIT $3`,
      [schoolId, teacherId, limit],
    );
  }

  async createAssessment(data: DeepPartial<CbtAssessment>): Promise<CbtAssessment> {
    const repo = this.repo.manager.getRepository(CbtAssessment);
    return repo.save(repo.create(data));
  }

  async updateAssessmentIfVersionMatches(
    schoolId: string,
    id: string,
    expectedVersion: number | undefined,
    patch: DeepPartial<CbtAssessment>,
  ): Promise<boolean> {
    const builder = this.repo.manager
      .createQueryBuilder()
      .update(CbtAssessment)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND school_id = :schoolId', { id, schoolId });
    if (expectedVersion !== undefined) builder.andWhere('version = :expectedVersion', { expectedVersion });
    const result = await builder.execute();
    return (result.affected ?? 0) > 0;
  }

  /* -- Attempts -------------------------------------------------------------- */

  async findAttempt(schoolId: string, id: string): Promise<CbtAttempt | null> {
    return this.repo.manager.getRepository(CbtAttempt).findOne({ where: { id, schoolId } });
  }

  async attemptsFor(schoolId: string, assessmentId: string, studentId: string): Promise<CbtAttempt[]> {
    return this.repo.manager
      .getRepository(CbtAttempt)
      .find({ where: { schoolId, assessmentId, studentId }, order: { startedAt: 'DESC' } });
  }

  async createAttempt(data: DeepPartial<CbtAttempt>): Promise<CbtAttempt> {
    const repo = this.repo.manager.getRepository(CbtAttempt);
    return repo.save(repo.create(data));
  }

  async updateAttempt(schoolId: string, id: string, patch: DeepPartial<CbtAttempt>): Promise<void> {
    await this.repo.manager.getRepository(CbtAttempt).update({ id, schoolId }, patch as never);
  }
}
