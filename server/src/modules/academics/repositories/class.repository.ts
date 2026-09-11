import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { SchoolClass } from '../entities/schoolClass.entity';
import { ClassFormTeacher } from '../entities/classFormTeacher.entity';
import type { SchoolClassDTO } from '../dto/academics.dto';

/**
 * Form teachers are aggregated in a lateral subquery rather than fetched per
 * class. A class list is on nearly every screen, so the alternative is a query
 * per row — the N+1 spec section 43 calls out by name.
 */
const PROJECTION = `
  c.id, c.school_id AS "schoolId", c.level_id AS "levelId",
  l.name AS "levelName", c.name, c.arm, c.code, c.capacity,
  c.enrolled_count AS "enrolledCount",
  COALESCE(ft.ids,   '{}') AS "formTeacherIds",
  COALESCE(ft.names, '{}') AS "formTeacherNames",
  c.room_id AS "roomId", c.is_active AS "isActive"
`;

const FORM_TEACHER_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      array_agg(s.id ORDER BY s.last_name)                                AS ids,
      array_agg(s.first_name || ' ' || s.last_name ORDER BY s.last_name)  AS names
    FROM class_form_teachers cft
    JOIN staff s ON s.id = cft.staff_id AND s.deleted_at IS NULL
    WHERE cft.class_id = c.id
  ) ft ON TRUE
`;

export interface ClassFilter {
  levelId?: string;
  includeInactive?: boolean;
  /** Null means unrestricted; an empty array means the caller sees none. */
  allowedIds: string[] | null;
}

export class ClassRepository extends TenantRepository<SchoolClass> {
  static Instance = new ClassRepository();

  private constructor() {
    super(SchoolClass, 'class');
  }

  /**
   * Resolves the name a school writes in a spreadsheet — "JSS 1 Gold" — to a class.
   *
   * Schools name classes two ways and both are in use: `name` "JSS 1" with `arm`
   * "Gold", and `name` "JSS 1 Gold" with the arm repeated. So the typed name is
   * matched against the name alone, the name and arm joined, and the class code,
   * and every hit is returned — an ambiguous name is the caller's to report
   * rather than something to pick a silent winner for.
   */
  async findByDisplayName(
    schoolId: string,
    displayName: string,
    manager?: EntityManager,
  ): Promise<{ id: string; levelId: string; displayName: string }[]> {
    return (manager ?? this.repo.manager).query(
      `WITH typed AS (SELECT LOWER(REGEXP_REPLACE(TRIM($2), '\\s+', ' ', 'g')) AS value)
       SELECT c.id,
              c.level_id AS "levelId",
              -- Some schools put the arm in the name as well; repeating it here
              -- would show a class back to them as "JSS 1 Gold Gold".
              CASE
                WHEN c.arm IS NULL OR c.arm = '' THEN TRIM(c.name)
                WHEN LOWER(TRIM(c.name)) LIKE '%' || LOWER(TRIM(c.arm)) THEN TRIM(c.name)
                ELSE TRIM(CONCAT_WS(' ', c.name, c.arm))
              END AS "displayName"
         FROM school_classes c, typed
        WHERE c.school_id = $1
          AND c.deleted_at IS NULL
          AND (
            LOWER(REGEXP_REPLACE(TRIM(c.name), '\\s+', ' ', 'g')) = typed.value
            OR LOWER(REGEXP_REPLACE(TRIM(CONCAT_WS(' ', c.name, c.arm)), '\\s+', ' ', 'g'))
               = typed.value
            OR LOWER(TRIM(c.code)) = typed.value
          )`,
      [schoolId, displayName],
    );
  }

  /**
   * Every class, with the spellings a spreadsheet might use for it.
   *
   * Bulk import resolves hundreds of rows against this, so it is fetched once
   * and matched in memory rather than queried per row.
   */
  async findAllForMatching(
    schoolId: string,
    manager?: EntityManager,
  ): Promise<{ id: string; levelId: string; name: string; arm: string | null; code: string; displayName: string }[]> {
    return (manager ?? this.repo.manager).query(
      `SELECT c.id,
              c.level_id AS "levelId",
              c.name,
              c.arm,
              c.code,
              CASE
                WHEN c.arm IS NULL OR c.arm = '' THEN TRIM(c.name)
                WHEN LOWER(TRIM(c.name)) LIKE '%' || LOWER(TRIM(c.arm)) THEN TRIM(c.name)
                ELSE TRIM(CONCAT_WS(' ', c.name, c.arm))
              END AS "displayName"
         FROM school_classes c
        WHERE c.school_id = $1 AND c.deleted_at IS NULL`,
      [schoolId],
    );
  }

  async fetchForSchool(schoolId: string, filter: ClassFilter): Promise<SchoolClassDTO[]> {
    if (filter.allowedIds && filter.allowedIds.length === 0) return [];

    const params: unknown[] = [schoolId];
    const clauses: string[] = [];

    if (filter.levelId) {
      params.push(filter.levelId);
      clauses.push(`c.level_id = $${params.length}`);
    }
    if (filter.allowedIds) {
      params.push(filter.allowedIds);
      clauses.push(`c.id = ANY($${params.length}::uuid[])`);
    }
    if (!filter.includeInactive) {
      clauses.push('c.is_active = TRUE');
    }

    const where = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';

    return this.repo.query(
      `SELECT ${PROJECTION}
       FROM school_classes c
       JOIN school_levels l ON l.id = c.level_id
       ${FORM_TEACHER_JOIN}
       WHERE c.school_id = $1 AND c.deleted_at IS NULL ${where}
       ORDER BY l.sequence ASC, c.name ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<SchoolClassDTO | null> {
    const rows: SchoolClassDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM school_classes c
       JOIN school_levels l ON l.id = c.level_id
       ${FORM_TEACHER_JOIN}
       WHERE c.school_id = $1 AND c.id = $2 AND c.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async nextCodeSuffix(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int + 1 AS next FROM school_classes
       WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId],
    );
    return Number(row?.next ?? 1);
  }

  async create(data: DeepPartial<SchoolClass>): Promise<SchoolClass> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<SchoolClass>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /**
   * Replaces the form-teacher set in one transaction. Assigning a class to a
   * new teacher must never leave it briefly with none.
   */
  async replaceFormTeachers(
    schoolId: string,
    classId: string,
    staffIds: string[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(ClassFormTeacher, { classId });
      if (staffIds.length === 0) return;
      await manager.insert(
        ClassFormTeacher,
        staffIds.map((staffId) => ({ schoolId, classId, staffId })),
      );
    });
  }

  /** Staff ids that exist in this school, so an unknown id is dropped, not stored. */
  async filterStaffIds(schoolId: string, staffIds: string[]): Promise<string[]> {
    if (staffIds.length === 0) return [];
    const rows: { id: string }[] = await this.repo.query(
      `SELECT id FROM staff
       WHERE school_id = $1 AND deleted_at IS NULL AND id = ANY($2::uuid[])`,
      [schoolId, staffIds],
    );
    return rows.map((row) => row.id);
  }

  /** Active classes, for the dashboard's "how much of the school is running" figures. */
  async countActive(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM school_classes
        WHERE school_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [schoolId],
    );
    return Number(row?.total ?? 0);
  }
}
