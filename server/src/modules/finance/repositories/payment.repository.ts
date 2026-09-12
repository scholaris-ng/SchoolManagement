import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Payment } from '../entities/payment.entity';
import { PaymentAccount } from '../entities/paymentAccount.entity';
import { PaymentAllocation } from '../entities/paymentAllocation.entity';
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
  pa.invoice_id AS "invoiceId",
  pa.created_at AS "createdAt"
`;

/**
 * `providerReference` falls back to the reference a member of staff typed in.
 *
 * The client shows one "reference" column and the office does not care which
 * of the two produced it — what they want is the number they can quote back to
 * the bank. The columns stay separate underneath because `provider_reference`
 * is unique per provider and a hand-keyed teller number cannot be.
 *
 * Allocations are a real subquery now that invoices exist, and
 * `unallocatedAmount` is what is left of the credit once they are taken off —
 * money on account, waiting for the office to say which bill it settles.
 */
const PAYMENT_PROJECTION = `
  p.id, p.school_id AS "schoolId", p.reference,
  COALESCE(p.provider_reference, p.external_reference) AS "providerReference",
  p.student_id AS "studentId",
  COALESCE(s.first_name || ' ' || s.last_name, p.payer_name, '—') AS "studentName",
  COALESCE(s.admission_no, '') AS "admissionNo",
  p.payer_name AS "guardianName",
  p.amount::float AS amount, p.method, p.provider, p.status,
  p.paid_at AS "paidAt",
  u.display_name AS "recordedByName",
  COALESCE(alloc.rows, '[]'::json) AS allocations,
  (p.amount - COALESCE(alloc.total, 0))::float AS "unallocatedAmount",
  p.is_reconciled AS "isReconciled",
  p.reference AS "receiptNo",
  p.note
`;

const JOINS = `
  FROM payments p
  LEFT JOIN students s ON s.id = p.student_id
  LEFT JOIN users u ON u.id = p.recorded_by_user_id
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object(
               'id', al.id,
               'invoiceId', al.invoice_id,
               'invoiceNo', i.invoice_no,
               'amount', al.amount::float
             ) ORDER BY i.invoice_no
           ) AS rows,
           SUM(al.amount) AS total
      FROM payment_allocations al
      JOIN invoices i ON i.id = al.invoice_id
     WHERE al.payment_id = p.id
  ) alloc ON TRUE
`;

const SORTABLE: Record<string, string> = {
  paidAt: 'p.paid_at',
  amount: 'p.amount',
};

export interface PaymentFilter {
  page: number;
  pageSize: number;
  studentId?: string;
  method?: string;
  provider?: string;
  status?: string;
  reconciled?: boolean;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** `null` is unrestricted; an empty array means the caller may see none. */
  visibleIds?: string[] | null;
}

export class PaymentRepository extends TenantRepository<Payment> {
  static Instance = new PaymentRepository();

  private readonly accounts = this.repo.manager.getRepository(PaymentAccount);
  private readonly allocations = this.repo.manager.getRepository(PaymentAllocation);

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

  /** The lookup a public receipt-verification page would use. Not routed yet. */
  async findByVerificationCode(verificationCode: string): Promise<Payment | null> {
    return this.repo.findOne({ where: { verificationCode } });
  }

  async findEntity(schoolId: string, id: string, manager?: EntityManager): Promise<Payment | null> {
    return this.repoFor(manager).findOne({ where: { schoolId, id } });
  }

  async create(data: DeepPartial<Payment>, manager?: EntityManager): Promise<Payment> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async createAllocations(
    rows: DeepPartial<PaymentAllocation>[],
    manager?: EntityManager,
  ): Promise<void> {
    if (rows.length === 0) return;
    const repo = manager ? manager.getRepository(PaymentAllocation) : this.allocations;
    await repo.insert(rows as never);
  }

  /**
   * One conditional statement, so a payment cannot be signed off twice.
   *
   * The `isReconciled: false` in the *where* clause is the whole mechanism: two
   * bursars clicking at once both run this, and exactly one updates a row. The
   * loser gets `affected === 0` and is told so, rather than both being left
   * believing they were the one who checked it.
   */
  async markReconciled(
    schoolId: string,
    id: string,
    userId: string,
    note: string | null,
  ): Promise<boolean> {
    const result = await this.repo.update(
      { schoolId, id, isReconciled: false },
      {
        isReconciled: true,
        reconciledAt: new Date(),
        reconciledByUserId: userId,
        // Left alone when the caller sent none — a reconciliation note must not
        // wipe whatever the desk wrote when the money came in.
        ...(note === null ? {} : { note }),
      },
    );
    return (result.affected ?? 0) > 0;
  }

  async findOneDTO(schoolId: string, id: string): Promise<PaymentDTO | null> {
    const rows: PaymentDTO[] = await this.repo.query(
      `SELECT ${PAYMENT_PROJECTION} ${JOINS} WHERE p.school_id = $1 AND p.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async fetchPaginated(schoolId: string, filter: PaymentFilter): Promise<Paginated<PaymentDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<PaymentDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['p.school_id = $1'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.visibleIds) add((i) => `p.student_id = ANY($${i}::uuid[])`, filter.visibleIds);
    if (filter.studentId) add((i) => `p.student_id = $${i}`, filter.studentId);
    if (filter.method) add((i) => `p.method = $${i}`, filter.method);
    if (filter.provider) add((i) => `p.provider = $${i}`, filter.provider);
    if (filter.status) add((i) => `p.status = $${i}`, filter.status);
    if (filter.reconciled !== undefined) add((i) => `p.is_reconciled = $${i}`, filter.reconciled);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(p.reference ILIKE $${i} OR p.provider_reference ILIKE $${i}
          OR p.external_reference ILIKE $${i} OR p.payer_name ILIKE $${i}
          OR s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const sortKey = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'paidAt');
    const direction = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${JOINS} WHERE ${whereSql}`,
      params,
    );
    const rows: PaymentDTO[] = await this.repo.query(
      `SELECT ${PAYMENT_PROJECTION}
       ${JOINS}
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[sortKey]} ${direction}, p.id ASC
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

  /** The bursar's "still to check" tile. */
  async unreconciledSummary(schoolId: string): Promise<{ count: number; amount: number }> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(p.amount), 0)::float AS amount
         FROM payments p
        WHERE p.school_id = $1 AND p.status = 'SUCCESSFUL' AND p.is_reconciled = false`,
      [schoolId],
    );
    return { count: Number(row?.count ?? 0), amount: Number(row?.amount ?? 0) };
  }

  /** The last few credits, newest first, for the bursar's landing screen. */
  async recentForDashboard(
    schoolId: string,
    limit: number,
  ): Promise<
    { id: string; studentName: string; amount: number; method: string; paidAt: string; isReconciled: boolean }[]
  > {
    return this.repo.query(
      `SELECT p.id,
              COALESCE(s.first_name || ' ' || s.last_name, p.payer_name, '—') AS "studentName",
              p.amount::float AS amount, p.method, p.paid_at AS "paidAt",
              p.is_reconciled AS "isReconciled"
         FROM payments p
         LEFT JOIN students s ON s.id = p.student_id
        WHERE p.school_id = $1 AND p.status = 'SUCCESSFUL'
        ORDER BY p.paid_at DESC, p.id ASC
        LIMIT $2`,
      [schoolId, limit],
    );
  }
}
