import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Guardian } from '../entities/guardian.entity';
import { StudentGuardian } from '../entities/studentGuardian.entity';
import type { GuardianDTO, StudentGuardianLinkDTO } from '../dto/guardians.dto';

const PROJECTION = `
  g.id, g.school_id AS "schoolId", g.user_id AS "userId", g.title,
  g.first_name AS "firstName", g.last_name AS "lastName",
  concat_ws(' ', NULLIF(g.title, ''), g.first_name, g.last_name) AS "fullName",
  g.email, g.phone, g.alt_phone AS "altPhone", g.occupation, g.address,
  g.photo_url AS "photoUrl", g.has_portal_access AS "hasPortalAccess",
  u.last_login_at AS "lastLoginAt",
  (
    SELECT COUNT(*)::int FROM student_guardians sg WHERE sg.guardian_id = g.id
  ) AS "studentCount",
  g.created_at AS "createdAt", g.version
`;

/** Both sides of the join, so one shape serves a child's list and a parent's. */
const LINK_PROJECTION = `
  sg.id,
  sg.student_id AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  s.admission_no AS "studentAdmissionNo",
  s.photo_url AS "studentPhotoUrl",
  sg.guardian_id AS "guardianId",
  concat_ws(' ', NULLIF(g.title, ''), g.first_name, g.last_name) AS "guardianName",
  g.phone AS "guardianPhone",
  g.email AS "guardianEmail",
  sg.relationship,
  sg.is_primary_contact AS "isPrimaryContact",
  sg.is_emergency_contact AS "isEmergencyContact",
  sg.is_financially_responsible AS "isFinanciallyResponsible",
  sg.can_pick_up AS "canPickUp"
`;

const SORTABLE: Record<string, string> = {
  fullName: 'g.last_name',
  lastName: 'g.last_name',
  email: 'g.email',
  createdAt: 'g.created_at',
};

export interface GuardianFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  /** Null means unrestricted; a parent may only ever see their own record. */
  visibleIds: string[] | null;
}

export class GuardianRepository extends TenantRepository<Guardian> {
  static Instance = new GuardianRepository();

  private constructor() {
    super(Guardian, 'guardian');
  }

  async fetchPaginated(
    schoolId: string,
    filter: GuardianFilter,
  ): Promise<Paginated<GuardianDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<GuardianDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['g.school_id = $1', 'g.deleted_at IS NULL'];

    if (filter.visibleIds) {
      params.push(filter.visibleIds);
      where.push(`g.id = ANY($${params.length}::uuid[])`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(g.first_name ILIKE $${i} OR g.last_name ILIKE $${i} OR g.email ILIKE $${i} OR g.phone ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const orderBy = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'lastName');
    const direction = filter.sortDir === 'desc' ? 'DESC' : 'ASC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM guardians g WHERE ${whereSql}`,
      params,
    );

    const rows: GuardianDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM guardians g
       LEFT JOIN users u ON u.id = g.user_id
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[orderBy]} ${direction}, g.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findOneDTO(schoolId: string, id: string): Promise<GuardianDTO | null> {
    const rows: GuardianDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM guardians g
       LEFT JOIN users u ON u.id = g.user_id
       WHERE g.school_id = $1 AND g.id = $2 AND g.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByEmail(
    schoolId: string,
    email: string,
    manager?: EntityManager,
  ): Promise<Guardian | null> {
    return this.repoFor(manager).findOne({
      where: { schoolId, email: email.toLowerCase() },
    });
  }

  /** Looks up a whole spreadsheet's worth of guardian emails at once. */
  async findManyByEmail(
    schoolId: string,
    emails: string[],
    manager?: EntityManager,
  ): Promise<{ id: string; email: string }[]> {
    if (emails.length === 0) return [];
    return (manager ?? this.repo.manager).query(
      `SELECT id, email FROM guardians
        WHERE school_id = $1 AND deleted_at IS NULL AND email = ANY($2::text[])`,
      [schoolId, emails.map((email) => email.toLowerCase())],
    );
  }

  async create(data: DeepPartial<Guardian>, manager?: EntityManager): Promise<Guardian> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create({ ...data, email: data.email?.toLowerCase() }));
  }

  async update(
    id: string,
    patch: DeepPartial<Guardian>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  async updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    patch: DeepPartial<Guardian>,
  ): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Guardian)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // ─── The join ──────────────────────────────────────────────────────────────

  async linksForStudent(schoolId: string, studentId: string): Promise<StudentGuardianLinkDTO[]> {
    return this.repo.query(
      `SELECT ${LINK_PROJECTION}
       FROM student_guardians sg
       JOIN students  s ON s.id = sg.student_id  AND s.deleted_at IS NULL
       JOIN guardians g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
       WHERE sg.school_id = $1 AND sg.student_id = $2
       ORDER BY sg.is_primary_contact DESC, g.last_name ASC`,
      [schoolId, studentId],
    );
  }

  async linksForGuardian(schoolId: string, guardianId: string): Promise<StudentGuardianLinkDTO[]> {
    return this.repo.query(
      `SELECT ${LINK_PROJECTION}
       FROM student_guardians sg
       JOIN students  s ON s.id = sg.student_id  AND s.deleted_at IS NULL
       JOIN guardians g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
       WHERE sg.school_id = $1 AND sg.guardian_id = $2
       ORDER BY s.last_name ASC`,
      [schoolId, guardianId],
    );
  }

  async findLink(schoolId: string, id: string): Promise<StudentGuardian | null> {
    return this.repo.manager.getRepository(StudentGuardian).findOne({ where: { schoolId, id } });
  }

  async findLinkByPair(
    schoolId: string,
    studentId: string,
    guardianId: string,
    manager?: EntityManager,
  ): Promise<StudentGuardian | null> {
    return (manager ?? this.repo.manager)
      .getRepository(StudentGuardian)
      .findOne({ where: { schoolId, studentId, guardianId } });
  }

  async createLink(
    data: DeepPartial<StudentGuardian>,
    manager?: EntityManager,
  ): Promise<StudentGuardian> {
    const repo = (manager ?? this.repo.manager).getRepository(StudentGuardian);
    return repo.save(repo.create(data));
  }

  /** How many guardians a child already has — the first one linked becomes primary. */
  async countLinksForStudent(
    schoolId: string,
    studentId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return (manager ?? this.repo.manager)
      .getRepository(StudentGuardian)
      .count({ where: { schoolId, studentId } });
  }

  async deleteLink(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.manager
      .getRepository(StudentGuardian)
      .delete({ schoolId, id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Clears the primary flag from a child's other guardians.
   *
   * "Who do we call first" has exactly one answer, so setting a new primary
   * demotes the previous one rather than leaving two.
   */
  async clearOtherPrimaries(
    schoolId: string,
    studentId: string,
    keepId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await (manager ?? this.repo.manager).query(
      `UPDATE student_guardians
          SET is_primary_contact = FALSE, updated_at = now()
        WHERE school_id = $1 AND student_id = $2 AND id <> $3 AND is_primary_contact`,
      [schoolId, studentId, keepId],
    );
  }

  async findLinkDTO(schoolId: string, id: string): Promise<StudentGuardianLinkDTO | null> {
    const rows: StudentGuardianLinkDTO[] = await this.repo.query(
      `SELECT ${LINK_PROJECTION}
       FROM student_guardians sg
       JOIN students  s ON s.id = sg.student_id
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE sg.school_id = $1 AND sg.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }
}
