import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { SchoolMembership } from '../entities/schoolMembership.entity';

/**
 * Row shape of the membership join, flattened for the session payload.
 *
 * A hand-written query rather than nested `relations`: this runs on every single
 * request, and the alternative is TypeORM issuing a query per membership per
 * role to assemble the same thing.
 */
export interface MembershipRow {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolSlug: string;
  schoolBranding: Record<string, unknown>;
  branchId: string | null;
  branchName: string | null;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  staffId: string | null;
  guardianId: string | null;
  studentId: string | null;
  staffStatus: 'ACTIVE' | 'ON_LEAVE' | 'EXITED' | null;
  roleKeys: string[];
  roleNames: string[];
  permissions: string[];
}

export class MembershipRepository {
  static Instance = new MembershipRepository();

  private readonly repo = AppDataSource.getRepository(SchoolMembership);

  private constructor() {}

  /**
   * Every membership a user holds, with its school, its roles and the union of
   * those roles' permissions — in one round trip.
   */
  async findForUser(userId: string): Promise<MembershipRow[]> {
    return this.repo.query(
      `
      SELECT
        m.id                                   AS "id",
        m.school_id                            AS "schoolId",
        s.name                                 AS "schoolName",
        s.short_name                           AS "schoolShortName",
        s.slug                                 AS "schoolSlug",
        s.branding                             AS "schoolBranding",
        m.branch_id                            AS "branchId",
        b.name                                 AS "branchName",
        m.status                               AS "status",
        m.staff_id                             AS "staffId",
        m.guardian_id                          AS "guardianId",
        m.student_id                           AS "studentId",
        st.status                              AS "staffStatus",
        COALESCE(r.role_keys,    '{}')         AS "roleKeys",
        COALESCE(r.role_names,   '{}')         AS "roleNames",
        COALESCE(r.permissions,  '{}')         AS "permissions"
      FROM school_memberships m
      JOIN schools s               ON s.id = m.school_id AND s.deleted_at IS NULL
      LEFT JOIN school_branches b  ON b.id = m.branch_id AND b.deleted_at IS NULL
      LEFT JOIN staff st           ON st.id = m.staff_id AND st.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          array_agg(DISTINCT ro.key)  AS role_keys,
          array_agg(DISTINCT ro.name) AS role_names,
          -- The union of every role's permission set. A person holding two
          -- roles gets both, which is what makes "form teacher who also runs
          -- admissions" work without inventing a combined role.
          array_agg(DISTINCT perm)    AS permissions
        FROM membership_roles mr
        JOIN roles ro ON ro.id = mr.role_id AND ro.deleted_at IS NULL
        LEFT JOIN LATERAL jsonb_array_elements_text(ro.permissions) AS perm ON TRUE
        WHERE mr.membership_id = m.id
      ) r ON TRUE
      WHERE m.user_id = $1
        AND m.deleted_at IS NULL
      ORDER BY s.name ASC
      `,
      [userId],
    );
  }

  /**
   * Everyone at a school holding any of these roles — the recipient list for a
   * notification aimed at a job rather than a person ("the administrators").
   *
   * Suspended and invited memberships are left out: someone who cannot sign in
   * yet, or has been suspended, should not be accumulating an inbox.
   */
  async findUserIdsByRoleKeys(schoolId: string, roleKeys: string[]): Promise<string[]> {
    if (roleKeys.length === 0) return [];
    const rows: { userId: string }[] = await this.repo.query(
      `
      SELECT DISTINCT m.user_id AS "userId"
      FROM school_memberships m
      JOIN membership_roles mr ON mr.membership_id = m.id
      JOIN roles ro            ON ro.id = mr.role_id AND ro.deleted_at IS NULL
      WHERE m.school_id = $1
        AND m.status = 'ACTIVE'
        AND m.deleted_at IS NULL
        AND ro.key = ANY($2::text[])
      `,
      [schoolId, roleKeys],
    );
    return rows.map((row) => row.userId);
  }
}
