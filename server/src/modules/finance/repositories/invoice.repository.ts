import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceLine } from '../entities/invoiceLine.entity';
import type { InvoiceDTO } from '../dto/finance.dto';

/**
 * Everything the client's `Invoice` needs, assembled in SQL.
 *
 * Two things are computed rather than stored, on purpose:
 *
 * `amountPaid` is the sum of successful allocations against the row, read
 * through a lateral. Storing it would be a second source of truth that drifts
 * from `payments` the first time a write half-fails.
 *
 * `OVERDUE` is derived from the due date against today. It is a fact about the
 * calendar, not about the invoice, and storing it would mean a nightly job
 * whose failure silently mislabels every debtor in the school.
 *
 * Lists send `'[]'::json` for `lines` and only the detail read joins them —
 * the same precedent `admission.repository` sets for its timeline. A page of
 * fifty invoices does not need four hundred line rows crossing the wire.
 */
const PROJECTION = `
  i.id, i.school_id AS "schoolId", i.invoice_no AS "invoiceNo",
  i.student_id AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  s.admission_no AS "admissionNo",
  c.name AS "className",
  i.session_id AS "sessionId", ses.name AS "sessionName",
  i.term_id AS "termId", t.name AS "termName",
  -- A bare "date" column reaches the pg driver as a JS Date, not the string
  -- this projection's type promises; see the same note in admission.repository.
  to_char(i.issue_date, 'YYYY-MM-DD') AS "issueDate",
  to_char(i.due_date, 'YYYY-MM-DD') AS "dueDate",
  i.subtotal::float AS subtotal,
  i.discount_total::float AS "discountTotal",
  i.applied_discounts AS "appliedDiscounts",
  i.brought_forward::float AS "broughtForward",
  i.total::float AS total,
  COALESCE(pd.paid, 0)::float AS "amountPaid",
  (i.total - COALESCE(pd.paid, 0))::float AS balance,
  CASE
    WHEN i.status IN ('ISSUED', 'PART_PAID') AND i.due_date < CURRENT_DATE THEN 'OVERDUE'
    ELSE i.status
  END AS status,
  i.note, i.created_at AS "createdAt", i.version,
  -- Hard-delete is refused once any of these hold — see deleteMany() below
  -- and the note on the Invoice entity. Surfaced here so the list and
  -- detail screens can grey the option out instead of hitting the refusal.
  (
    NOT EXISTS (SELECT 1 FROM payment_allocations pa2 WHERE pa2.invoice_id = i.id)
    AND jsonb_array_length(COALESCE(i.brought_forward_from, '[]'::jsonb)) = 0
    AND i.carried_forward_to_invoice_id IS NULL
  ) AS deletable
`;

const JOINS = `
  FROM invoices i
  JOIN students s ON s.id = i.student_id
  JOIN academic_sessions ses ON ses.id = i.session_id
  JOIN terms t ON t.id = i.term_id
  LEFT JOIN school_classes c ON c.id = i.class_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(pa.amount), 0) AS paid
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
     WHERE pa.invoice_id = i.id
  ) pd ON TRUE
`;

/** Only indexed columns, plus the two derived money figures the list sorts on. */
const SORTABLE: Record<string, string> = {
  invoiceNo: 'i.invoice_no',
  dueDate: 'i.due_date',
  issueDate: 'i.issue_date',
  total: 'i.total',
  balance: '(i.total - COALESCE(pd.paid, 0))',
};

export interface InvoiceFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  /** Includes the two synthetic values `UNPAID` and `OVERDUE`. */
  status?: string;
  termId?: string;
  classId?: string;
  studentId?: string;
  /**
   * Row-level restriction for a parent or pupil, exactly as
   * `StudentRepository.fetchPaginated` uses it: `null` is unrestricted, and an
   * empty array means they may see none — which is not the same thing.
   */
  visibleIds: string[] | null;
}

/** The shape money validation and receipts need — no joins, no names. */
export interface InvoiceBrief {
  id: string;
  invoiceNo: string;
  studentId: string;
  termId: string;
  total: number;
  paid: number;
  status: string;
  termName: string;
  sessionName: string;
}

/** One charge, for `findLinesForInvoices` — see its doc comment. */
export interface ReceiptLineRow {
  invoiceId: string;
  description: string;
  isOptional: boolean;
  amount: number;
}

/** An earlier bill about to be absorbed into a new one. */
export interface CarryForwardCandidate {
  id: string;
  invoiceNo: string;
  balance: number;
}

export class InvoiceRepository extends TenantRepository<Invoice> {
  static Instance = new InvoiceRepository();

  private readonly lines = this.repo.manager.getRepository(InvoiceLine);

  private constructor() {
    super(Invoice, 'invoice');
  }

  /* -- Reads ----------------------------------------------------------------- */

  async fetchPaginated(schoolId: string, filter: InvoiceFilter): Promise<Paginated<InvoiceDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<InvoiceDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['i.school_id = $1'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.visibleIds) add((i) => `i.student_id = ANY($${i}::uuid[])`, filter.visibleIds);
    if (filter.studentId) add((i) => `i.student_id = $${i}`, filter.studentId);
    if (filter.termId) add((i) => `i.term_id = $${i}`, filter.termId);
    if (filter.classId) add((i) => `i.class_id = $${i}`, filter.classId);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(i.invoice_no ILIKE $${i} OR s.first_name ILIKE $${i} OR s.last_name ILIKE $${i}
          OR s.admission_no ILIKE $${i})`,
      );
    }

    const statusClause = statusFilterSql(filter.status);
    if (statusClause) where.push(statusClause);

    const whereSql = where.join(' AND ');
    const sortKey = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'dueDate');
    const direction = filter.sortDir === 'desc' ? 'DESC' : 'ASC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${JOINS} WHERE ${whereSql}`,
      params,
    );
    const rows: InvoiceDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}, '[]'::json AS lines
       ${JOINS}
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[sortKey]} ${direction}, i.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /** The detail read — the only one that pays for the lines. */
  async findOneDTO(schoolId: string, id: string): Promise<InvoiceDTO | null> {
    const rows: InvoiceDTO[] = await this.repo.query(
      `SELECT ${PROJECTION},
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', il.id,
              'feeItemId', il.fee_item_id,
              'description', il.description,
              'quantity', il.quantity,
              'unitAmount', il.unit_amount::float,
              'discountAmount', il.discount_amount::float,
              'lineTotal', il.line_total::float,
              'isOptional', il.is_optional,
              'accounts', il.accounts
            ) ORDER BY il.sort_order, il.description
          )
          FROM invoice_lines il WHERE il.invoice_id = i.id
        ), '[]'::json) AS lines
       ${JOINS}
       WHERE i.school_id = $1 AND i.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findEntity(schoolId: string, id: string, manager?: EntityManager): Promise<Invoice | null> {
    return this.repoFor(manager).findOne({ where: { schoolId, id } });
  }

  /** Ids to briefs, for validating a payment's allocations in one round trip. */
  async findManyBrief(
    schoolId: string,
    ids: string[],
    manager?: EntityManager,
  ): Promise<InvoiceBrief[]> {
    if (ids.length === 0) return [];
    const runner = manager ?? this.repo.manager;
    return runner.query(
      `SELECT i.id, i.invoice_no AS "invoiceNo", i.student_id AS "studentId",
              i.term_id AS "termId",
              i.total::float AS total,
              COALESCE(pd.paid, 0)::float AS paid,
              i.status, t.name AS "termName", ses.name AS "sessionName"
         FROM invoices i
         JOIN terms t ON t.id = i.term_id
         JOIN academic_sessions ses ON ses.id = i.session_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(pa.amount), 0) AS paid
             FROM payment_allocations pa
             JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
            WHERE pa.invoice_id = i.id
         ) pd ON TRUE
        WHERE i.school_id = $1 AND i.id = ANY($2::uuid[])`,
      [schoolId, ids],
    );
  }

  /**
   * The charges behind a set of invoices — what a receipt's optional
   * itemised breakdown shows per invoice it was applied to. No accounts, no
   * quantity or discount: a receipt is proof of what was paid, not a second
   * copy of the bill.
   */
  async findLinesForInvoices(schoolId: string, ids: string[]): Promise<ReceiptLineRow[]> {
    if (ids.length === 0) return [];
    return this.repo.query(
      `SELECT il.invoice_id AS "invoiceId", il.description, il.is_optional AS "isOptional",
              il.line_total::float AS amount
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
        WHERE i.school_id = $1 AND il.invoice_id = ANY($2::uuid[])
        ORDER BY il.invoice_id, il.sort_order, il.description`,
      [schoolId, ids],
    );
  }

  /**
   * The same briefs, but with the rows locked for the rest of the transaction.
   *
   * Two payments allocated against one invoice at the same instant would each
   * see the other's balance as still owing and both succeed, over-paying the
   * bill. Locking the invoice row first makes the second wait and re-read.
   * The balance is fetched separately because `FOR UPDATE` and an aggregate do
   * not belong in one statement.
   */
  async lockForAllocation(
    manager: EntityManager,
    schoolId: string,
    ids: string[],
  ): Promise<InvoiceBrief[]> {
    if (ids.length === 0) return [];
    await manager.query(
      `SELECT i.id FROM invoices i
        WHERE i.school_id = $1 AND i.id = ANY($2::uuid[])
        ORDER BY i.id
        FOR UPDATE`,
      [schoolId, ids],
    );
    return this.findManyBrief(schoolId, ids, manager);
  }

  /* -- Numbering ------------------------------------------------------------- */

  /**
   * The next invoice number within a session, under an advisory lock held to
   * the end of the transaction — the same approach `AdmissionRepository`
   * takes, and for the same reason: `MAX + 1` without one hands two
   * simultaneous callers the same number, and the unique index then fails the
   * second one's whole bill.
   *
   * A bulk run takes this lock once and counts upward from what it returns.
   *
   * Backed by `invoice_number_counters`, not `MAX(sequence)` — a counter row
   * only ever increases, where the max over existing rows would go backwards
   * the moment the invoice holding it is deleted, handing its exact number to
   * a different bill (see `InvoiceNumberCounters1791900000000`). Seeding the
   * insert from the current max keeps this correct even for a school whose
   * counter row does not exist yet — the advisory lock is still taken first
   * so two callers seeding the same missing row at once cannot race.
   */
  async nextSequence(
    manager: EntityManager,
    schoolId: string,
    sessionId: string,
  ): Promise<number> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `invoice:${schoolId}:${sessionId}`,
    ]);
    const [row] = await manager.query(
      `INSERT INTO invoice_number_counters (school_id, session_id, last_sequence)
       VALUES (
         $1, $2,
         (SELECT COALESCE(MAX(sequence), 0) FROM invoices WHERE school_id = $1 AND session_id = $2) + 1
       )
       ON CONFLICT (school_id, session_id)
       DO UPDATE SET last_sequence = invoice_number_counters.last_sequence + 1, updated_at = now()
       RETURNING last_sequence AS next`,
      [schoolId, sessionId],
    );
    return Number(row?.next ?? 1);
  }

  /* -- Writes ---------------------------------------------------------------- */

  async create(data: DeepPartial<Invoice>, manager?: EntityManager): Promise<Invoice> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async createLines(rows: DeepPartial<InvoiceLine>[], manager?: EntityManager): Promise<void> {
    if (rows.length === 0) return;
    const repo = manager ? manager.getRepository(InvoiceLine) : this.lines;
    await repo.insert(rows as never);
  }

  /**
   * Re-derives one invoice's money state from its allocations.
   *
   * A single UPDATE, so the read and the write cannot be separated by another
   * transaction's allocation. An invoice with nothing to pay — a bill that was
   * entirely discounted, or a carry-forward of zero — lands on `PAID`, which is
   * true: nothing is owed.
   */
  async recalculateStatus(manager: EntityManager, invoiceId: string): Promise<void> {
    await manager.query(
      `UPDATE invoices i
          SET status = CASE
                WHEN i.status = 'CANCELLED' THEN 'CANCELLED'
                WHEN paid.total >= i.total THEN 'PAID'
                WHEN paid.total > 0 THEN 'PART_PAID'
                ELSE 'ISSUED'
              END,
              updated_at = now()
         FROM (
           SELECT COALESCE(SUM(pa.amount), 0) AS total
             FROM payment_allocations pa
             JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
            WHERE pa.invoice_id = $1
         ) paid
        WHERE i.id = $1`,
      [invoiceId],
    );
  }

  /**
   * The student's open bills from *strictly earlier* terms, locked.
   *
   * "Earlier" is ordered by the session's start date and then the term's
   * sequence, because term numbers restart every year: second term 2024/25
   * comes before first term 2025/26. Invoices in the same term are left alone
   * — a school that raises tuition and boarding as two bills in one term has
   * not created arrears.
   *
   * Locked in two statements for the reason `lockForAllocation` gives.
   */
  async lockOpenEarlierInvoices(
    manager: EntityManager,
    schoolId: string,
    studentId: string,
    before: { sessionStartDate: string; termSequence: number },
  ): Promise<CarryForwardCandidate[]> {
    const ids: { id: string }[] = await manager.query(
      `SELECT i.id
         FROM invoices i
         JOIN terms t ON t.id = i.term_id
         JOIN academic_sessions ses ON ses.id = i.session_id
        WHERE i.school_id = $1
          AND i.student_id = $2
          AND i.status IN ('ISSUED', 'PART_PAID')
          AND (ses.start_date, t.sequence) < ($3::date, $4::int)
        ORDER BY ses.start_date, t.sequence, i.id
        FOR UPDATE OF i`,
      [schoolId, studentId, before.sessionStartDate, before.termSequence],
    );
    if (ids.length === 0) return [];

    return manager.query(
      `SELECT i.id, i.invoice_no AS "invoiceNo",
              (i.total - COALESCE(pd.paid, 0))::float AS balance
         FROM invoices i
         JOIN terms t ON t.id = i.term_id
         JOIN academic_sessions ses ON ses.id = i.session_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(pa.amount), 0) AS paid
             FROM payment_allocations pa
             JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
            WHERE pa.invoice_id = i.id
         ) pd ON TRUE
        WHERE i.id = ANY($1::uuid[])
        ORDER BY ses.start_date, t.sequence, i.id`,
      [ids.map((row) => row.id)],
    );
  }

  /**
   * Closes the invoices whose balance has just moved onto a new one.
   *
   * `carried_forward_to_invoice_id` is what separates these from a bill
   * somebody withdrew: both read `CANCELLED`, but only this one still counts
   * as real billing in the ledger's totals.
   */
  async closeCarriedForward(
    manager: EntityManager,
    ids: string[],
    into: { invoiceId: string; invoiceNo: string },
    userId: string | null,
  ): Promise<void> {
    if (ids.length === 0) return;
    await manager.query(
      `UPDATE invoices
          SET status = 'CANCELLED',
              carried_forward_to_invoice_id = $2,
              cancelled_at = now(),
              cancel_reason = $3,
              cancelled_by_user_id = $4,
              updated_at = now()
        WHERE id = ANY($1::uuid[])`,
      [ids, into.invoiceId, `Balance carried forward to ${into.invoiceNo}`, userId],
    );
  }

  /**
   * Undoes the above when the invoice that absorbed them is itself cancelled.
   *
   * The ids are read before the update rather than out of a `RETURNING`
   * clause: `query()` does not hand back a plain row array for an UPDATE, and
   * a length check on what it does return is silently always true. Both
   * statements are inside the caller's transaction, so nothing can slip
   * between them.
   */
  async reopenCarriedForward(manager: EntityManager, invoiceId: string): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      `SELECT id FROM invoices WHERE carried_forward_to_invoice_id = $1 FOR UPDATE`,
      [invoiceId],
    );
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    await manager.query(
      `UPDATE invoices
          SET status = 'ISSUED',
              carried_forward_to_invoice_id = NULL,
              cancelled_at = NULL,
              cancel_reason = NULL,
              cancelled_by_user_id = NULL,
              updated_at = now()
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    // Reopened as ISSUED above; whatever had already been paid against them
    // puts them straight back to PART_PAID.
    for (const id of ids) await this.recalculateStatus(manager, id);
    return ids;
  }

  async cancel(
    manager: EntityManager,
    id: string,
    reason: string,
    userId: string | null,
  ): Promise<void> {
    await manager.query(
      `UPDATE invoices
          SET status = 'CANCELLED',
              cancelled_at = now(),
              cancel_reason = $2,
              cancelled_by_user_id = $3,
              updated_at = now()
        WHERE id = $1`,
      [id, reason, userId],
    );
  }

  /* -- Deleting and editing ---------------------------------------------------- */

  /**
   * The facts `InvoicesService.deleteInvoices` needs to decide, per id,
   * whether hard-deleting it is safe — see the three conditions on `deletable`
   * in `PROJECTION`, repeated here as booleans a service can branch on rather
   * than a single derived column.
   */
  async findManyForDeleteCheck(schoolId: string, ids: string[]): Promise<DeleteCheckRow[]> {
    if (ids.length === 0) return [];
    return this.repo.query(
      `SELECT i.id, i.invoice_no AS "invoiceNo",
              concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
              EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.invoice_id = i.id) AS "hasAllocations",
              jsonb_array_length(COALESCE(i.brought_forward_from, '[]'::jsonb)) > 0 AS "hasBroughtForwardFrom",
              i.carried_forward_to_invoice_id AS "carriedForwardToInvoiceId"
         FROM invoices i
         JOIN students s ON s.id = i.student_id
        WHERE i.school_id = $1 AND i.id = ANY($2::uuid[])`,
      [schoolId, ids],
    );
  }

  /** Cascades to `invoice_lines`; anything still pointing at these is `SET NULL`. */
  async deleteMany(ids: string[], manager?: EntityManager): Promise<void> {
    if (ids.length === 0) return;
    await this.repoFor(manager).delete(ids);
  }

  async deleteLines(invoiceId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(InvoiceLine) : this.lines;
    await repo.delete({ invoiceId });
  }

  async updateFields(
    id: string,
    fields: Partial<
      Pick<
        Invoice,
        'dueDate' | 'note' | 'subtotal' | 'discountTotal' | 'appliedDiscounts' | 'total' | 'status'
      >
    >,
    manager?: EntityManager,
  ): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    await this.repoFor(manager).update({ id }, fields);
  }
}

/** One invoice's facts for `findManyForDeleteCheck` — see its doc comment. */
export interface DeleteCheckRow {
  id: string;
  invoiceNo: string;
  studentName: string;
  hasAllocations: boolean;
  hasBroughtForwardFrom: boolean;
  carriedForwardToInvoiceId: string | null;
}

/**
 * The client filters by things that are not stored states.
 *
 * `UNPAID` is "anything still owing", and `OVERDUE` narrows that to bills past
 * their date. `ISSUED` and `PART_PAID` exclude the overdue ones, so the four
 * options partition the open invoices rather than overlapping — a list that
 * showed the same overdue bill under three filters would make the counts on
 * screen impossible to reconcile.
 */
function statusFilterSql(status: string | undefined): string | null {
  switch (status) {
    case undefined:
    case '':
      return null;
    case 'UNPAID':
      return `i.status IN ('ISSUED', 'PART_PAID')`;
    case 'OVERDUE':
      return `i.status IN ('ISSUED', 'PART_PAID') AND i.due_date < CURRENT_DATE`;
    case 'ISSUED':
    case 'PART_PAID':
      return `i.status = '${status}' AND i.due_date >= CURRENT_DATE`;
    case 'PAID':
    case 'CANCELLED':
      return `i.status = '${status}'`;
    default:
      // The validator's enum is the gate; anything else would be a bug here,
      // and interpolating it is only safe because nothing else can reach this.
      return null;
  }
}
