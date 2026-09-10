import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Staff } from '../entities/staff.entity';

/**
 * The staff module has no service or routes yet — this exists so the admin
 * dashboard can count employees without reaching into another module's table.
 * It will grow into the full repository when staff management lands.
 */
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
}
