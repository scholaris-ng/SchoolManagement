import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { PaymentReceipt } from '../entities/paymentReceipt.entity';
import type { PaymentReceiptDTO } from '../dto/finance.dto';

export type PaymentReceiptRow = PaymentReceiptDTO;

const PROJECTION = `
  pr.id, pr.school_id AS "schoolId", pr.student_id AS "studentId",
  COALESCE(s.first_name || ' ' || s.last_name, '—') AS "studentName",
  COALESCE(s.admission_no, '') AS "admissionNo",
  pr.invoice_id AS "invoiceId", i.invoice_no AS "invoiceNo",
  pr.amount::float AS amount, pr.method, pr.paid_at AS "paidAt",
  pr.reference, pr.note,
  pr.file_url AS "fileUrl", pr.mime_type AS "mimeType", pr.size_bytes AS "sizeBytes",
  pr.status,
  pr.submitted_by_name AS "submittedByName", pr.created_at AS "submittedAt",
  pr.reviewed_by_name AS "reviewedByName", pr.reviewed_at AS "reviewedAt", pr.review_note AS "reviewNote",
  pr.payment_id AS "paymentId"
`;

const JOINS = `
  FROM payment_receipts pr
  LEFT JOIN students s ON s.id = pr.student_id
  LEFT JOIN invoices i ON i.id = pr.invoice_id
`;

export interface PaymentReceiptFilter {
  page: number;
  pageSize: number;
  studentId?: string;
  status?: string;
  /** `null` is unrestricted; an empty array means the caller may see none. */
  visibleIds?: string[] | null;
}

/** `bigint` reaches the driver as a string; every row is normalised as it comes off the wire. */
function normalise(row: PaymentReceiptRow & { sizeBytes: string }): PaymentReceiptRow {
  return { ...row, sizeBytes: Number(row.sizeBytes) };
}

export class PaymentReceiptRepository extends TenantRepository<PaymentReceipt> {
  static Instance = new PaymentReceiptRepository();

  private constructor() {
    super(PaymentReceipt, 'paymentReceipt');
  }

  async create(data: DeepPartial<PaymentReceipt>): Promise<PaymentReceipt> {
    return this.repo.save(this.repo.create(data));
  }

  async findEntity(schoolId: string, id: string): Promise<PaymentReceipt | null> {
    return this.repo.findOne({ where: { schoolId, id } });
  }

  async findOneRow(schoolId: string, id: string): Promise<PaymentReceiptRow | null> {
    const rows = await this.repo.query(
      `SELECT ${PROJECTION} ${JOINS} WHERE pr.school_id = $1 AND pr.id = $2`,
      [schoolId, id],
    );
    return rows[0] ? normalise(rows[0]) : null;
  }

  async fetchPaginated(schoolId: string, filter: PaymentReceiptFilter): Promise<Paginated<PaymentReceiptRow>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<PaymentReceiptRow>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['pr.school_id = $1'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.visibleIds) add((i) => `pr.student_id = ANY($${i}::uuid[])`, filter.visibleIds);
    if (filter.studentId) add((i) => `pr.student_id = $${i}`, filter.studentId);
    if (filter.status) add((i) => `pr.status = $${i}`, filter.status);

    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${JOINS} WHERE ${whereSql}`,
      params,
    );
    const rows = await this.repo.query(
      `SELECT ${PROJECTION}
       ${JOINS}
       WHERE ${whereSql}
       -- Oldest pending first: whoever has been waiting longest gets looked at first.
       ORDER BY (pr.status = 'PENDING') DESC, pr.created_at ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows.map(normalise), filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /**
   * One conditional statement, so the same claim cannot be approved and
   * rejected by two bursars racing each other.
   */
  async markReviewed(
    schoolId: string,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewer: { userId: string; name: string },
    note: string | null,
    paymentId: string | null,
  ): Promise<boolean> {
    const result = await this.repo.update(
      { schoolId, id, status: 'PENDING' },
      {
        status,
        reviewedByUserId: reviewer.userId,
        reviewedByName: reviewer.name,
        reviewedAt: new Date(),
        reviewNote: note,
        paymentId,
      },
    );
    return (result.affected ?? 0) > 0;
  }
}
