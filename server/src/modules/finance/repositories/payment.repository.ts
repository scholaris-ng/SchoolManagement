import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Payment } from '../entities/payment.entity';
import { PaymentAccount } from '../entities/paymentAccount.entity';
import type { PaymentAccountDTO, PaymentDTO } from '../dto/finance.dto';

/**
 * Both projections join the student so a list reads as names, not ids, and
 * `numeric` columns are cast in SQL so the driver hands back numbers rather
 * than strings — the same rule `feeItem.repository` follows at its boundary.
 */
const ACCOUNT_PROJECTION = `
  pa.id, pa.school_id AS "schoolId", pa.student_id AS "studentId",
  COALESCE(s.first_name || ' ' || s.last_name, '—') AS "studentName",
  COALESCE(s.admission_no, '') AS "admissionNo",
  pa.provider, pa.account_number AS "accountNumber", pa.account_name AS "accountName",
  pa.bank_name AS "bankName", pa.amount::float AS amount,
  COALESCE((
    SELECT SUM(p.amount) FROM payments p
    WHERE p.payment_account_id = pa.id AND p.status = 'SUCCESSFUL'
  ), 0)::float AS "amountPaid",
  pa.is_permanent AS "isPermanent", pa.status, pa.note,
  pa.created_at AS "createdAt"
`;

const PAYMENT_PROJECTION = `
  p.id, p.school_id AS "schoolId", p.reference, p.provider_reference AS "providerReference",
  p.student_id AS "studentId",
  COALESCE(s.first_name || ' ' || s.last_name, p.payer_name, '—') AS "studentName",
  COALESCE(s.admission_no, '') AS "admissionNo",
  p.payer_name AS "guardianName",
  p.amount::float AS amount, p.method, p.provider, p.status,
  p.paid_at AS "paidAt",
  u.display_name AS "recordedByName",
  '[]'::json AS allocations,
  p.amount::float AS "unallocatedAmount",
  p.is_reconciled AS "isReconciled",
  p.reference AS "receiptNo",
  p.note
`;

export interface PaymentFilter {
  page: number;
  pageSize: number;
  studentId?: string;
  method?: string;
  provider?: string;
  search?: string;
}

export class PaymentRepository extends TenantRepository<Payment> {
  static Instance = new PaymentRepository();

  private readonly accounts = this.repo.manager.getRepository(PaymentAccount);

  private constructor() {
    super(Payment, 'payment');
  }

  /* -- Collection accounts -------------------------------------------------- */

  async createAccount(data: DeepPartial<PaymentAccount>): Promise<PaymentAccount> {
    return this.accounts.save(this.accounts.create(data));
  }

  /**
   * The lookup a webhook depends on. Not scoped by school on purpose: the
   * account number is the only thing Raven tells us, and it is what says
   * which school — and which child — the money belongs to.
   */
  async findAccountByNumber(provider: string, accountNumber: string): Promise<PaymentAccount | null> {
    return this.accounts.findOne({ where: { provider: provider as 'RAVEN', accountNumber } });
  }

  async updateAccount(id: string, patch: DeepPartial<PaymentAccount>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(PaymentAccount) : this.accounts;
    await repo.update(id, patch as never);
  }

  async fetchAccountsForStudent(schoolId: string, studentId: string): Promise<PaymentAccountDTO[]> {
    return this.repo.query(
      `SELECT ${ACCOUNT_PROJECTION}
       FROM payment_accounts pa
       LEFT JOIN students s ON s.id = pa.student_id
       WHERE pa.school_id = $1 AND pa.student_id = $2
       ORDER BY pa.created_at DESC`,
      [schoolId, studentId],
    );
  }

  async findAccountDTO(schoolId: string, id: string): Promise<PaymentAccountDTO | null> {
    const rows: PaymentAccountDTO[] = await this.repo.query(
      `SELECT ${ACCOUNT_PROJECTION}
       FROM payment_accounts pa
       LEFT JOIN students s ON s.id = pa.student_id
       WHERE pa.school_id = $1 AND pa.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /* -- Payments -------------------------------------------------------------- */

  async findByProviderReference(provider: string, providerReference: string): Promise<Payment | null> {
    return this.repo.findOne({
      where: { provider: provider as 'RAVEN', providerReference },
    });
  }

  async create(data: DeepPartial<Payment>, manager?: EntityManager): Promise<Payment> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async findOneDTO(schoolId: string, id: string): Promise<PaymentDTO | null> {
    const rows: PaymentDTO[] = await this.repo.query(
      `SELECT ${PAYMENT_PROJECTION}
       FROM payments p
       LEFT JOIN students s ON s.id = p.student_id
       LEFT JOIN users u ON u.id = p.recorded_by_user_id
       WHERE p.school_id = $1 AND p.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async fetchPaginated(schoolId: string, filter: PaymentFilter): Promise<Paginated<PaymentDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['p.school_id = $1'];

    if (filter.studentId) {
      params.push(filter.studentId);
      where.push(`p.student_id = $${params.length}`);
    }
    if (filter.method) {
      params.push(filter.method);
      where.push(`p.method = $${params.length}`);
    }
    if (filter.provider) {
      params.push(filter.provider);
      where.push(`p.provider = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(p.reference ILIKE $${i} OR p.provider_reference ILIKE $${i} OR p.payer_name ILIKE $${i}
          OR s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const joins = `FROM payments p
       LEFT JOIN students s ON s.id = p.student_id
       LEFT JOIN users u ON u.id = p.recorded_by_user_id`;

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${joins} WHERE ${whereSql}`,
      params,
    );
    const rows: PaymentDTO[] = await this.repo.query(
      `SELECT ${PAYMENT_PROJECTION}
       ${joins}
       WHERE ${whereSql}
       ORDER BY p.paid_at DESC, p.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /** What has been collected, for the dashboards — successful credits only. */
  async sumCollected(schoolId: string, since?: Date): Promise<number> {
    const params: unknown[] = [schoolId];
    let where = `p.school_id = $1 AND p.status = 'SUCCESSFUL'`;
    if (since) {
      params.push(since);
      where += ` AND p.paid_at >= $${params.length}`;
    }
    const [row] = await this.repo.query(
      `SELECT COALESCE(SUM(p.amount), 0)::float AS total FROM payments p WHERE ${where}`,
      params,
    );
    return Number(row?.total ?? 0);
  }
}
