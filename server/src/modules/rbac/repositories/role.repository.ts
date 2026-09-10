import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { Role } from '../entities/role.entity';

export interface RoleWithCount extends Role {
  memberCount: number;
}

export class RoleRepository {
  static Instance = new RoleRepository();

  private readonly repo = AppDataSource.getRepository(Role);

  private constructor() {}

  /**
   * A school's roles with how many people hold each.
   *
   * The count is a correlated subquery rather than a join with GROUP BY so a
   * role nobody holds still comes back, with zero.
   */
  async findForSchool(schoolId: string): Promise<RoleWithCount[]> {
    const rows = await this.repo.query(
      `
      SELECT
        r.id, r.school_id AS "schoolId", r.name, r.key, r.description,
        r.is_system AS "isSystem", r.permissions,
        r.created_at AS "createdAt", r.updated_at AS "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM membership_roles mr
          JOIN school_memberships m ON m.id = mr.membership_id AND m.deleted_at IS NULL
          WHERE mr.role_id = r.id
        ) AS "memberCount"
      FROM roles r
      WHERE r.school_id = $1 AND r.deleted_at IS NULL
      ORDER BY r.is_system DESC, r.name ASC
      `,
      [schoolId],
    );
    return rows as RoleWithCount[];
  }

  async findByIdScoped(schoolId: string, id: string): Promise<Role | null> {
    return this.repo.findOne({ where: { id, schoolId } });
  }

  async findByKey(schoolId: string, key: string): Promise<Role | null> {
    return this.repo.findOne({ where: { schoolId, key } });
  }

  async create(data: DeepPartial<Role>): Promise<Role> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Role>): Promise<Role | null> {
    await this.repo.update(id, patch as never);
    return this.repo.findOne({ where: { id } });
  }

  async countMembers(roleId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS count
       FROM membership_roles mr
       JOIN school_memberships m ON m.id = mr.membership_id AND m.deleted_at IS NULL
       WHERE mr.role_id = $1`,
      [roleId],
    );
    return row?.count ?? 0;
  }
}
