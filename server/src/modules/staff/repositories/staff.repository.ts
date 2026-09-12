import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Staff } from '../entities/staff.entity';
import type { StaffMemberDTO } from '../dto/staff.dto';

/** One employee, as the staff-performance analytics needs them. */
export interface StaffRosterRow {
  staffId: string;
  staffName: string;
  designation: string;
  classCount: number;
}

/**
 * The projection the client's `StaffMember` type expects.
 *
 * Roles, subjects, classes and the exact teaching assignments are all
 * one-to-many, and every one of them is aggregated in a lateral subquery rather
 * than fetched per employee. A staff list is small today and will not be in a
 * secondary school, and the N+1 habit does not announce itself when it starts
 * (spec section 43).
 *
 * `teachingAssignments` is sent as the real pairs, not as two flat lists the
 * client would have to cross-product — the client type says exactly why.
 */
const PROJECTION = `
  s.id, s.school_id AS "schoolId", s.user_id AS "userId",
  s.staff_no AS "staffNo",
  s.first_name AS "firstName", s.last_name AS "lastName",
  concat_ws(' ', s.first_name, s.last_name) AS "fullName",
  s.email, s.phone, s.gender,
  s.photo_url AS "photoUrl",
  s.designation, s.department,
  s.employment_type AS "employmentType",
  to_char(s.employment_date, 'YYYY-MM-DD') AS "employmentDate",
  s.status,
  COALESCE(r.names,  '{}') AS "roleNames",
  COALESCE(t.subject_ids,   '{}') AS "subjectIds",
  COALESCE(t.subject_names, '{}') AS "subjectNames",
  COALESCE(t.class_ids,     '{}') AS "classIds",
  COALESCE(t.class_names,   '{}') AS "classNames",
  COALESCE(t.pairs, '[]'::json) AS "teachingAssignments",
  COALESCE(ft.total, 0) > 0 AS "isFormTeacher",
  s.created_at AS "createdAt", s.version
`;

const JOINS = `
  LEFT JOIN LATERAL (
    /*
      The role key, not its display name. Everything that consumes this field
      treats it as the stable identifier: the write path resolves each entry
      with findByKey, the request schema validates against the role keys, and
      the import template documents TEACHER;FORM_TEACHER. Sending the display
      name back instead left the edit form holding values it could not match
      to a role, so the roles read as unset and the save was refused.
    */
    SELECT array_agg(DISTINCT ro.key) AS names
    FROM school_memberships sm
    JOIN membership_roles mr ON mr.membership_id = sm.id
    JOIN roles ro            ON ro.id = mr.role_id AND ro.deleted_at IS NULL
    WHERE sm.user_id = s.user_id AND sm.school_id = s.school_id
      AND sm.deleted_at IS NULL
  ) r ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      array_agg(DISTINCT ta.subject_id)  AS subject_ids,
      array_agg(DISTINCT sub.name)       AS subject_names,
      array_agg(DISTINCT ta.class_id)    AS class_ids,
      array_agg(DISTINCT cl.name)        AS class_names,
      json_agg(DISTINCT jsonb_build_object('classId', ta.class_id, 'subjectId', ta.subject_id))
                                         AS pairs
    FROM teaching_assignments ta
    JOIN subjects       sub ON sub.id = ta.subject_id AND sub.deleted_at IS NULL
    JOIN school_classes cl  ON cl.id  = ta.class_id   AND cl.deleted_at IS NULL
    WHERE ta.staff_id = s.id AND ta.school_id = s.school_id
  ) t ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM class_form_teachers cft
    JOIN school_classes c ON c.id = cft.class_id AND c.deleted_at IS NULL
    WHERE cft.staff_id = s.id
  ) ft ON TRUE
`;

/** Only indexed columns, so a sort cannot turn a list into a table scan. */
const SORTABLE: Record<string, string> = {
  fullName: 's.last_name',
  lastName: 's.last_name',
  staffNo: 's.staff_no',
  designation: 's.designation',
  department: 's.department',
  status: 's.status',
  employmentDate: 's.employment_date',
  createdAt: 's.created_at',
};

export interface StaffFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  status?: string;
  employmentType?: string;
  department?: string;
  classId?: string;
  subjectId?: string;
}

export class StaffRepository extends TenantRepository<Staff> {
  static Instance = new StaffRepository();

  private constructor() {
    super(Staff, 'staff');
  }

  /**
   * People actually working at the school today. Those on leave or exited are
   * excluded — a headcount that includes someone who left last term is not a
   * headcount anybody can act on.
   */
  async countActive(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM staff
        WHERE school_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [schoolId],
    );
    return Number(row?.total ?? 0);
  }

  async findByStaffNo(schoolId: string, staffNo: string): Promise<Staff | null> {
    return this.repo.findOne({ where: { schoolId, staffNo }, withDeleted: true });
  }

  /**
   * Looks up a whole spreadsheet's worth of staff numbers at once. Includes
   * soft-deleted rows, as `findByStaffNo` does — the number is still taken.
   */
  async findManyByStaffNo(
    schoolId: string,
    staffNos: string[],
  ): Promise<{ id: string; staffNo: string; email: string; deletedAt: Date | null }[]> {
    if (staffNos.length === 0) return [];
    return this.repo.query(
      `SELECT id, staff_no AS "staffNo", email, deleted_at AS "deletedAt"
         FROM staff WHERE school_id = $1 AND staff_no = ANY($2::text[])`,
      [schoolId, staffNos],
    );
  }

  async findByEmail(schoolId: string, email: string): Promise<Staff | null> {
    return this.repo.findOne({ where: { schoolId, email }, withDeleted: true });
  }

  async create(data: DeepPartial<Staff>): Promise<Staff> {
    return this.repo.save(this.repo.create(data));
  }

  /** Guarded by the version the caller loaded (spec section 34). */
  async updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    patch: DeepPartial<Staff>,
  ): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Staff)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async update(id: string, patch: DeepPartial<Staff>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /**
   * Carries a change to the person onto every employee row that is theirs.
   *
   * Deliberately not school-scoped, and the only method here that is not:
   * someone editing their own account is not acting inside one school, and a
   * person can be on staff at more than one. Their name has to follow them
   * into every directory they appear in, or an administrator goes on seeing
   * whatever was typed for them on the day they were added.
   *
   * The version is bumped like any other write, so an administrator holding
   * the edit form is told their copy is stale rather than silently putting
   * the old name back.
   */
  async updateForUser(userId: string, patch: DeepPartial<Staff>): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.repo
      .createQueryBuilder()
      .update(Staff)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('user_id = :userId AND deleted_at IS NULL', { userId })
      .execute();
  }

  async fetchPaginated(schoolId: string, filter: StaffFilter): Promise<Paginated<StaffMemberDTO>> {
    const params: unknown[] = [schoolId];
    const where: string[] = ['s.school_id = $1', 's.deleted_at IS NULL'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.status) add((i) => `s.status = $${i}`, filter.status);
    if (filter.employmentType) add((i) => `s.employment_type = $${i}`, filter.employmentType);
    if (filter.department) add((i) => `s.department = $${i}`, filter.department);

    /**
     * Given together, these narrow to staff assigned that exact pairing, not
     * to anyone who teaches the class and, unrelatedly, teaches the subject
     * elsewhere — the same distinction `teachingAssignments` protects on the
     * read side (a teacher who has Biology in JSS 1 and Mathematics in SSS 1
     * must not appear under "Mathematics" + "JSS 1").
     */
    if (filter.classId && filter.subjectId) {
      params.push(filter.classId, filter.subjectId);
      const [classIndex, subjectIndex] = [params.length - 1, params.length];
      where.push(
        `EXISTS (SELECT 1 FROM teaching_assignments ta
                  WHERE ta.staff_id = s.id AND ta.class_id = $${classIndex} AND ta.subject_id = $${subjectIndex})`,
      );
    } else if (filter.classId) {
      add(
        (i) => `EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.staff_id = s.id AND ta.class_id = $${i})`,
        filter.classId,
      );
    } else if (filter.subjectId) {
      add(
        (i) => `EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.staff_id = s.id AND ta.subject_id = $${i})`,
        filter.subjectId,
      );
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i}
          OR s.staff_no ILIKE $${i} OR s.email ILIKE $${i} OR s.designation ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const orderBy = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'lastName');
    const direction = filter.sortDir === 'desc' ? 'DESC' : 'ASC';

    // Counted without the lateral joins: they only widen each row, never
    // multiply them, so joining for a COUNT would be work with no effect.
    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM staff s WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRow?.total ?? 0);

    const rows: StaffMemberDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM staff s ${JOINS}
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[orderBy]} ${direction}, s.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows.map(normalise), filter.page, filter.pageSize, total);
  }

  async findOneDTO(schoolId: string, id: string): Promise<StaffMemberDTO | null> {
    const rows: StaffMemberDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM staff s ${JOINS}
       WHERE s.school_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
      [schoolId, id],
    );
    const row = rows[0];
    return row ? normalise(row) : null;
  }

  /**
   * The active roster with each person's form-teacher load, for the staff
   * analytics table. Deliberately narrower than the list above: that screen
   * ranks people by compliance and has no use for contact details.
   */
  async fetchRoster(schoolId: string): Promise<StaffRosterRow[]> {
    return this.repo.query(
      `SELECT
         s.id                                AS "staffId",
         s.first_name || ' ' || s.last_name  AS "staffName",
         s.designation,
         COALESCE(ft.total, 0)::int          AS "classCount"
       FROM staff s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total
         FROM class_form_teachers cft
         JOIN school_classes c ON c.id = cft.class_id AND c.deleted_at IS NULL
         WHERE cft.staff_id = s.id
       ) ft ON TRUE
       WHERE s.school_id = $1 AND s.status = 'ACTIVE' AND s.deleted_at IS NULL
       ORDER BY s.last_name, s.first_name`,
      [schoolId],
    );
  }
}

/**
 * An employee with no user account has no membership, so the roles aggregate
 * comes back as a single NULL element rather than an empty array. The same is
 * true of every other `array_agg` here when the teacher has no assignments.
 */
function normalise(row: StaffMemberDTO): StaffMemberDTO {
  const clean = <T>(values: (T | null)[] | null): T[] =>
    (values ?? []).filter((value): value is T => value !== null);

  return {
    ...row,
    roleNames: clean(row.roleNames),
    subjectIds: clean(row.subjectIds),
    subjectNames: clean(row.subjectNames),
    classIds: clean(row.classIds),
    classNames: clean(row.classNames),
    teachingAssignments: clean(row.teachingAssignments).filter((pair) => pair.classId !== null),
  };
}
