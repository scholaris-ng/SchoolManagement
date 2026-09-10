import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Subject } from '../entities/subject.entity';
import { SubjectLevel } from '../entities/subjectLevel.entity';
import type { SubjectDTO } from '../dto/academics.dto';

const PROJECTION = `
  sub.id, sub.school_id AS "schoolId", sub.name, sub.code, sub.category,
  sub.is_core AS "isCore", sub.is_active AS "isActive", sub.schedule,
  COALESCE(lv.ids,   '{}') AS "levelIds",
  COALESCE(lv.names, '{}') AS "levelNames",
  (
    SELECT COUNT(DISTINCT ta.staff_id)::int
    FROM teaching_assignments ta
    WHERE ta.subject_id = sub.id
  ) AS "teacherCount"
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
       WHERE sub.school_id = $1 AND sub.id = $2 AND sub.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByCode(schoolId: string, code: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  async create(data: DeepPartial<Subject>): Promise<Subject> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Subject>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /** Replaces the level set atomically, dropping ids that are not this school's. */
  async replaceLevels(schoolId: string, subjectId: string, levelIds: string[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(SubjectLevel, { subjectId });
      if (levelIds.length === 0) return;

      const rows: { id: string }[] = await manager.query(
        `SELECT id FROM school_levels
         WHERE school_id = $1 AND deleted_at IS NULL AND id = ANY($2::uuid[])`,
        [schoolId, levelIds],
      );
      if (rows.length === 0) return;

      await manager.insert(
        SubjectLevel,
        rows.map((row) => ({ schoolId, subjectId, levelId: row.id })),
      );
    });
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
