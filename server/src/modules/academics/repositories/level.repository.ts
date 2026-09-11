import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { SchoolLevel } from '../entities/schoolLevel.entity';
import type { SchoolLevelDTO } from '../dto/academics.dto';

/**
 * `gradingSchemeName` is null until grading schemes land in phase 3; the column
 * and the join are already here so the client contract is complete now.
 */
const PROJECTION = `
  l.id, l.school_id AS "schoolId", l.name, l.code, l.sequence,
  l.grading_scheme_id AS "gradingSchemeId",
  NULL::text AS "gradingSchemeName",
  (
    SELECT COUNT(*)::int FROM school_classes c
    WHERE c.level_id = l.id AND c.deleted_at IS NULL
  ) AS "classCount"
`;

export class LevelRepository extends TenantRepository<SchoolLevel> {
  static Instance = new LevelRepository();

  private constructor() {
    super(SchoolLevel, 'level');
  }

  /**
   * Every level, for resolving the names typed into a spreadsheet
   * ("JSS 1;JSS 2"). Fetched once per import and matched in memory — a school
   * has a handful of levels, and a query per row is not worth the round trips.
   */
  async findAllForMatching(
    schoolId: string,
    manager?: EntityManager,
  ): Promise<{ id: string; name: string }[]> {
    return (manager ?? this.repo.manager).query(
      `SELECT id, name FROM school_levels
        WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId],
    );
  }

  /**
   * @param visibleClassIds when set, only levels containing one of these classes
   *   are returned — so a junior-school teacher is never offered "SSS 3" in a
   *   filter that would only ever come back empty.
   */
  async fetchForSchool(
    schoolId: string,
    visibleClassIds: string[] | null,
  ): Promise<SchoolLevelDTO[]> {
    if (visibleClassIds && visibleClassIds.length === 0) return [];

    const params: unknown[] = [schoolId];
    let filter = '';
    if (visibleClassIds) {
      params.push(visibleClassIds);
      filter = `AND EXISTS (
        SELECT 1 FROM school_classes c
        WHERE c.level_id = l.id AND c.deleted_at IS NULL AND c.id = ANY($2::uuid[])
      )`;
    }

    return this.repo.query(
      `SELECT ${PROJECTION}
       FROM school_levels l
       WHERE l.school_id = $1 AND l.deleted_at IS NULL ${filter}
       ORDER BY l.sequence ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<SchoolLevelDTO | null> {
    const rows: SchoolLevelDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM school_levels l
       WHERE l.school_id = $1 AND l.id = $2 AND l.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByCode(schoolId: string, code: string): Promise<SchoolLevel | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  async nextSequence(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next
       FROM school_levels WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId],
    );
    return Number(row?.next ?? 1);
  }

  async countClasses(schoolId: string, levelId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS count FROM school_classes
       WHERE school_id = $1 AND level_id = $2 AND deleted_at IS NULL`,
      [schoolId, levelId],
    );
    return Number(row?.count ?? 0);
  }

  async create(data: DeepPartial<SchoolLevel>): Promise<SchoolLevel> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<SchoolLevel>): Promise<void> {
    await this.repo.update(id, patch as never);
  }
}
