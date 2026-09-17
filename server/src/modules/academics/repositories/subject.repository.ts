import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Subject } from '../entities/subject.entity';
import { SubjectLevel } from '../entities/subjectLevel.entity';
import type { SubjectDTO } from '../dto/academics.dto';

/**
 * Everywhere a subject id can be depended on, besides `subject_levels` — that
 * table is the subject's own configuration (which levels take it), cleaned up
 * along with the row rather than a reason to keep it. Every table below has an
 * `ON DELETE CASCADE` foreign key to `subjects`, which is exactly the danger: a
 * hard delete would succeed silently and take a teacher's assignment, a term's
 * timetable slot, a scheme of work, or — worst — an already-entered result down
 * with it. This is the check that decides whether that is ever allowed to run.
 */
function referenceExistsFor(alias: string): string {
  return `(
    EXISTS (SELECT 1 FROM teaching_assignments WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM timetable_entries  WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM curricula          WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM schemes_of_work    WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM lesson_notes       WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM score_sheets       WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM questions          WHERE subject_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM cbt_assessments    WHERE subject_id = ${alias}.id)
  )`;
}

const REFERENCE_EXISTS = referenceExistsFor('sub');

const PROJECTION = `
  sub.id, sub.school_id AS "schoolId", sub.name, sub.code, sub.category,
  sub.is_core AS "isCore", sub.is_active AS "isActive", sub.schedule,
  COALESCE(lv.ids,   '{}') AS "levelIds",
  COALESCE(lv.names, '{}') AS "levelNames",
  COALESCE(t.ids,   '{}') AS "teacherIds",
  COALESCE(t.names, '{}') AS "teacherNames",
  COALESCE(array_length(t.ids, 1), 0) AS "teacherCount",
  ${REFERENCE_EXISTS} AS "isReferenced"
`;

const LEVEL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      array_agg(l.id   ORDER BY l.sequence) AS ids,
      array_agg(l.name ORDER BY l.sequence) AS names
    FROM subject_levels sl
    JOIN school_levels l ON l.id = sl.level_id AND l.deleted_at IS NULL
    WHERE sl.subject_id = sub.id
  ) lv ON TRUE
`;

/**
 * One row per teacher, not per teaching assignment: a subject taught by the
 * same person to three classes must still name them once. The dedup happens
 * in the inner query — an `array_agg(DISTINCT …)` outside it cannot also be
 * ordered, since Postgres requires a `DISTINCT` aggregate's `ORDER BY` to be
 * one of its own arguments, and two separately-ordered distinct aggregates
 * (one for ids, one for names) would not agree on an order with each other.
 */
const TEACHER_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      array_agg(x.id   ORDER BY x.last_name) AS ids,
      array_agg(x.name ORDER BY x.last_name) AS names
    FROM (
      SELECT DISTINCT s.id, s.last_name, (s.first_name || ' ' || s.last_name) AS name
      FROM teaching_assignments ta
      JOIN staff s ON s.id = ta.staff_id AND s.deleted_at IS NULL
      WHERE ta.subject_id = sub.id AND ta.school_id = sub.school_id
    ) x
  ) t ON TRUE
`;

export interface SubjectFilter {
  /** Resolved from `classId` by the service when only a class was named. */
  levelId?: string | null;
  /** Null means unrestricted; an empty array means the caller sees none. */
  allowedIds: string[] | null;
}

export class SubjectRepository extends TenantRepository<Subject> {
  static Instance = new SubjectRepository();

  private constructor() {
    super(Subject, 'subject');
  }

  async fetchForSchool(schoolId: string, filter: SubjectFilter): Promise<SubjectDTO[]> {
    if (filter.allowedIds && filter.allowedIds.length === 0) return [];

    const params: unknown[] = [schoolId];
    const clauses: string[] = [];

    if (filter.levelId) {
      params.push(filter.levelId);
      clauses.push(`EXISTS (
        SELECT 1 FROM subject_levels sl
        WHERE sl.subject_id = sub.id AND sl.level_id = $${params.length}
      )`);
    }
    if (filter.allowedIds) {
      params.push(filter.allowedIds);
      clauses.push(`sub.id = ANY($${params.length}::uuid[])`);
    }

    const where = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';

    return this.repo.query(
      `SELECT ${PROJECTION}
       FROM subjects sub
       ${LEVEL_JOIN}
       ${TEACHER_JOIN}
       WHERE sub.school_id = $1 AND sub.deleted_at IS NULL ${where}
       ORDER BY sub.name ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<SubjectDTO | null> {
    const rows: SubjectDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM subjects sub
       ${LEVEL_JOIN}
       ${TEACHER_JOIN}
       WHERE sub.school_id = $1 AND sub.id = $2 AND sub.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByCode(
    schoolId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Subject | null> {
    return this.repoFor(manager).findOne({ where: { schoolId, code } });
  }

  /**
   * The same lookup, but also seeing an archived subject — the unique index
   * on `(school_id, code)` is not partial on `deleted_at`, so a code still
   * held by a soft-deleted row is not actually free at the database, whatever
   * this plain `findByCode` says. A caller creating or renaming a subject
   * needs to know that before it reaches the database as a raw constraint
   * violation instead of a message the school can act on.
   */
  async findByCodeIncludingArchived(schoolId: string, code: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { schoolId, code }, withDeleted: true });
  }

  /** Looks up a whole spreadsheet's worth of subject codes at once. */
  async findManyByCode(
    schoolId: string,
    codes: string[],
    manager?: EntityManager,
  ): Promise<{ id: string; code: string }[]> {
    if (codes.length === 0) return [];
    return (manager ?? this.repo.manager).query(
      `SELECT id, code FROM subjects
        WHERE school_id = $1 AND deleted_at IS NULL AND code = ANY($2::text[])`,
      [schoolId, codes.map((code) => code.toUpperCase())],
    );
  }

  async create(data: DeepPartial<Subject>, manager?: EntityManager): Promise<Subject> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Subject>, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  /**
   * Answered fresh at delete time rather than trusted from whatever the
   * caller's list happened to show — a teacher could have been assigned to it
   * in the moment between the screen loading and the button being clicked.
   */
  async isReferenced(schoolId: string, id: string): Promise<boolean> {
    const [row] = await this.repo.query(
      `SELECT ${referenceExistsFor('sub')} AS referenced
       FROM subjects sub WHERE sub.school_id = $1 AND sub.id = $2`,
      [schoolId, id],
    );
    return Boolean(row?.referenced);
  }

  /**
   * A genuine, permanent delete — the one case `softDeleteScoped` is not used
   * for on this entity. Only ever called once `isReferenced` above has said
   * no: nothing depends on the row, so nothing is lost by it disappearing
   * outright, and its code is freed for reuse rather than blocked forever by
   * a soft-deleted row the school can no longer see (the unique index on
   * `(school_id, code)` is not partial on `deleted_at`).
   */
  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * Replaces the level set atomically, dropping ids that are not this school's.
   *
   * A caller already inside a transaction passes its manager, and the work joins
   * that transaction. Opening one of our own there would commit independently of
   * the caller's, which is exactly what a bulk import must not do.
   */
  async replaceLevels(
    schoolId: string,
    subjectId: string,
    levelIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      await em.delete(SubjectLevel, { subjectId });
      if (levelIds.length === 0) return;

      const rows: { id: string }[] = await em.query(
        `SELECT id FROM school_levels
         WHERE school_id = $1 AND deleted_at IS NULL AND id = ANY($2::uuid[])`,
        [schoolId, levelIds],
      );
      if (rows.length === 0) return;

      await em.insert(
        SubjectLevel,
        rows.map((row) => ({ schoolId, subjectId, levelId: row.id })),
      );
    };

    if (manager) return run(manager);
    await this.repo.manager.transaction(run);
  }

  /** The level a class sits at — asking for a class's subjects is asking for its level's. */
  async levelIdForClass(schoolId: string, classId: string): Promise<string | null> {
    const [row] = await this.repo.query(
      `SELECT level_id AS "levelId" FROM school_classes
       WHERE school_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [schoolId, classId],
    );
    return row?.levelId ?? null;
  }
}
