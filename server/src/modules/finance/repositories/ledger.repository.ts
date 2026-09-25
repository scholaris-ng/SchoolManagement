import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { StudentFinanceSummaryDTO, StudentLedgerEntryDTO } from '../dto/finance.dto';

/**
 * Everything derived from invoices *against* payments — a statement, a
 * balance, a debtors list, the overview totals.
 *
 * Raw SQL throughout and no entity of its own, because none of this is a
 * table: every figure here is an aggregate across three of them, and a
 * repository that loaded rows to add them up in Node would mean three thousand
 * students' invoices crossing the wire to produce one number (spec section 43).
 *
 * ## The one identity everything here obeys
 *
 * ```
 * balance = Σ subtotal − Σ discount_total − Σ successful payments
 * ```
 *
 * over "real" invoices, where real means `REAL_INVOICE` below. That predicate
 * is the subtle part. Carrying a balance forward *cancels* the old invoice and
 * re-bills it inside the new one's `brought_forward`, so counting both would
 * double the debt; but the old invoice's own charges are the only record of
 * what was billed, so dropping it would lose them. The resolution: a
 * carried-forward invoice still counts as billing (hence the second half of
 * the predicate), and `brought_forward` is never counted at all — the debit is
 * always `subtotal`, never `total`.
 *
 * Payments are counted whole rather than through their allocations. Money paid
 * on account, sitting unallocated, is still money the family has handed over,
 * and a statement that ignored it would be telling a parent they owe what they
 * have already paid.
 */
const REAL_INVOICE = `(i.status <> 'CANCELLED' OR i.carried_forward_to_invoice_id IS NOT NULL)`;

const OPEN_AND_OVERDUE = `i.status IN ('ISSUED', 'PART_PAID') AND i.due_date < CURRENT_DATE`;

export interface DebtorFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  classId?: string;
  overdueOnly?: boolean;
  visibleIds: string[] | null;
}

export interface OverviewTotals {
  totalBilled: number;
  totalDiscount: number;
  debtorCount: number;
}

export interface TopDebtorRow {
  studentId: string;
  studentName: string;
  className: string | null;
  balance: number;
  daysOverdue: number;
}

export class LedgerRepository {
  static Instance = new LedgerRepository();

  private constructor(private readonly db = AppDataSource) {}

  /* -- One student ----------------------------------------------------------- */

  /**
   * The statement: every charge, waiver and credit in date order, with the
   * balance after each.
   *
   * The running total is a window function rather than a loop in Node, so the
   * figure on the last row is the same number `summaryFor` reports — computed
   * by the same database from the same rows, not by two pieces of arithmetic
   * that have to be kept in step.
   */
  async ledgerFor(schoolId: string, studentId: string): Promise<StudentLedgerEntryDTO[]> {
    return this.db.query(
      `WITH entries AS (
         SELECT i.id::text AS id,
                i.issue_date AS on_date,
                0 AS rank,
                'INVOICE' AS type,
                i.invoice_no AS reference,
                t.name || ' · ' || ses.name || ' fees' AS description,
                i.subtotal AS debit,
                0::numeric AS credit,
                -- Mirrors Invoice.deletable in invoice.repository.ts: hard-delete
                -- is refused once any of these hold, so the statement can grey
                -- the option out here too rather than only on the invoice screen.
                (
                  NOT EXISTS (SELECT 1 FROM payment_allocations pa2 WHERE pa2.invoice_id = i.id)
                  AND jsonb_array_length(COALESCE(i.brought_forward_from, '[]'::jsonb)) = 0
                  AND i.carried_forward_to_invoice_id IS NULL
                ) AS deletable
           FROM invoices i
           JOIN terms t ON t.id = i.term_id
           JOIN academic_sessions ses ON ses.id = i.session_id
          WHERE i.school_id = $1 AND i.student_id = $2 AND ${REAL_INVOICE}

         UNION ALL

         SELECT il.id::text,
                i.issue_date,
                1,
                'DISCOUNT',
                i.invoice_no,
                'Discount — ' || il.description,
                0::numeric,
                il.discount_amount,
                false
           FROM invoice_lines il
           JOIN invoices i ON i.id = il.invoice_id
          WHERE i.school_id = $1 AND i.student_id = $2 AND ${REAL_INVOICE}
            AND il.discount_amount > 0

         UNION ALL

         SELECT p.id::text,
                p.paid_at::date,
                2,
                'PAYMENT',
                p.reference,
                'Payment received · ' || initcap(replace(p.method, '_', ' ')),
                0::numeric,
                p.amount,
                false
           FROM payments p
          WHERE p.school_id = $1 AND p.student_id = $2 AND p.status = 'SUCCESSFUL'
       )
       SELECT id,
              to_char(on_date, 'YYYY-MM-DD') AS date,
              type, reference, description,
              debit::float AS debit,
              credit::float AS credit,
              deletable,
              SUM(debit - credit) OVER (ORDER BY on_date, rank, id)::float AS "runningBalance"
         FROM entries
        ORDER BY on_date, rank, id`,
      [schoolId, studentId],
    );
  }

  /** The same numbers as one row, for the card above the statement. */
  async summaryFor(
    schoolId: string,
    studentId: string,
  ): Promise<StudentFinanceSummaryDTO | null> {
    const rows: StudentFinanceSummaryDTO[] = await this.db.query(
      `SELECT s.id AS "studentId",
              concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
              s.admission_no AS "admissionNo",
              c.name AS "className",
              COALESCE(b.billed, 0)::float AS "totalBilled",
              COALESCE(b.discount, 0)::float AS "totalDiscount",
              COALESCE(p.paid, 0)::float AS "totalPaid",
              (COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0))::float AS balance,
              p.last_paid AS "lastPaymentAt",
              COALESCE(b.overdue, 0)::int AS "overdueInvoices"
         FROM students s
         LEFT JOIN school_classes c ON c.id = s.current_class_id
         LEFT JOIN LATERAL (
           SELECT SUM(i.subtotal) AS billed,
                  SUM(i.discount_total) AS discount,
                  COUNT(*) FILTER (WHERE ${OPEN_AND_OVERDUE}) AS overdue
             FROM invoices i
            WHERE i.school_id = s.school_id AND i.student_id = s.id AND ${REAL_INVOICE}
         ) b ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(pay.amount) AS paid, MAX(pay.paid_at) AS last_paid
             FROM payments pay
            WHERE pay.school_id = s.school_id AND pay.student_id = s.id
              AND pay.status = 'SUCCESSFUL'
         ) p ON TRUE
        WHERE s.school_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
      [schoolId, studentId],
    );
    return rows[0] ?? null;
  }

  /**
   * What the family owed the moment a given payment landed — the figure
   * printed under "balance after" on the receipt.
   *
   * The payment's own id is included explicitly alongside the timestamp
   * comparison: two credits recorded in the same second would otherwise make
   * the receipt's own payment a coin toss to include.
   *
   * An invoice counts as billed if it was issued by then *or* if a payment
   * counted below is allocated to it. A payment dated before the invoice it
   * settles (a desk entry backdated to when the money actually arrived) would
   * otherwise be subtracted from a bill this query never added, printing a
   * negative "balance after" for a family that owes nothing — or, for a
   * part-payment, understating what is still owed.
   */
  async balanceAsOf(
    schoolId: string,
    studentId: string,
    at: Date,
    includePaymentId: string,
  ): Promise<number> {
    const [row] = await this.db.query(
      `SELECT (COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0))::float AS balance
         FROM (
           SELECT SUM(i.subtotal) AS billed, SUM(i.discount_total) AS discount
             FROM invoices i
            WHERE i.school_id = $1 AND i.student_id = $2 AND ${REAL_INVOICE}
              AND (
                i.issue_date <= $3::date
                OR EXISTS (
                  SELECT 1
                    FROM payment_allocations pa
                    JOIN payments pay2 ON pay2.id = pa.payment_id
                   WHERE pa.invoice_id = i.id
                     AND pay2.status = 'SUCCESSFUL'
                     AND (pay2.paid_at <= $3::timestamptz OR pay2.id = $4::uuid)
                )
              )
         ) b
         CROSS JOIN (
           SELECT SUM(pay.amount) AS paid
             FROM payments pay
            WHERE pay.school_id = $1 AND pay.student_id = $2 AND pay.status = 'SUCCESSFUL'
              AND (pay.paid_at <= $3::timestamptz OR pay.id = $4::uuid)
         ) p`,
      [schoolId, studentId, at, includePaymentId],
    );
    return Number(row?.balance ?? 0);
  }

  /* -- Who owes -------------------------------------------------------------- */

  /**
   * Every family with money outstanding, biggest first by default.
   *
   * The two aggregates are computed per student in CTEs and only then joined,
   * rather than as correlated subqueries per row: the balance is what the list
   * is *filtered* by, so it has to exist before the WHERE, not after it.
   */
  async fetchDebtors(
    schoolId: string,
    filter: DebtorFilter,
  ): Promise<Paginated<StudentFinanceSummaryDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<StudentFinanceSummaryDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['s.school_id = $1', 's.deleted_at IS NULL'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.visibleIds) add((i) => `s.id = ANY($${i}::uuid[])`, filter.visibleIds);
    if (filter.classId) add((i) => `s.current_class_id = $${i}`, filter.classId);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i})`,
      );
    }
    if (filter.overdueOnly) where.push('COALESCE(b.overdue, 0) > 0');

    // The whole point of the list: somebody who owes nothing is not a debtor.
    where.push('(COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0)) > 0');

    const sortable: Record<string, string> = {
      balance: 'balance',
      studentName: '"studentName"',
      className: '"className"',
      overdueInvoices: '"overdueInvoices"',
    };
    const sortKey = sortable[filter.sortBy ?? ''] ?? 'balance';
    const direction = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

    const body = `
      FROM students s
      LEFT JOIN school_classes c ON c.id = s.current_class_id
      LEFT JOIN LATERAL (
        SELECT SUM(i.subtotal) AS billed,
               SUM(i.discount_total) AS discount,
               COUNT(*) FILTER (WHERE ${OPEN_AND_OVERDUE}) AS overdue,
               MIN(i.due_date) FILTER (WHERE ${OPEN_AND_OVERDUE}) AS oldest_overdue
          FROM invoices i
         WHERE i.school_id = s.school_id AND i.student_id = s.id AND ${REAL_INVOICE}
      ) b ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(pay.amount) AS paid, MAX(pay.paid_at) AS last_paid
          FROM payments pay
         WHERE pay.school_id = s.school_id AND pay.student_id = s.id
           AND pay.status = 'SUCCESSFUL'
      ) p ON TRUE
      WHERE ${where.join(' AND ')}
    `;

    const [countRow] = await this.db.query(`SELECT COUNT(*)::int AS total ${body}`, params);
    const rows: StudentFinanceSummaryDTO[] = await this.db.query(
      `SELECT s.id AS "studentId",
              concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
              s.admission_no AS "admissionNo",
              c.name AS "className",
              COALESCE(b.billed, 0)::float AS "totalBilled",
              COALESCE(b.discount, 0)::float AS "totalDiscount",
              COALESCE(p.paid, 0)::float AS "totalPaid",
              (COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0))::float AS balance,
              p.last_paid AS "lastPaymentAt",
              COALESCE(b.overdue, 0)::int AS "overdueInvoices"
       ${body}
       ORDER BY ${sortKey} ${direction}, s.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /** The bursar's card: the biggest arrears, with how long they have run. */
  async topDebtors(schoolId: string, limit: number): Promise<TopDebtorRow[]> {
    return this.db.query(
      `SELECT s.id AS "studentId",
              concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
              c.name AS "className",
              (COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0))::float AS balance,
              GREATEST(COALESCE(CURRENT_DATE - b.oldest_overdue, 0), 0)::int AS "daysOverdue"
         FROM students s
         LEFT JOIN school_classes c ON c.id = s.current_class_id
         LEFT JOIN LATERAL (
           SELECT SUM(i.subtotal) AS billed,
                  SUM(i.discount_total) AS discount,
                  MIN(i.due_date) FILTER (WHERE ${OPEN_AND_OVERDUE}) AS oldest_overdue
             FROM invoices i
            WHERE i.school_id = s.school_id AND i.student_id = s.id AND ${REAL_INVOICE}
         ) b ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(pay.amount) AS paid
             FROM payments pay
            WHERE pay.school_id = s.school_id AND pay.student_id = s.id
              AND pay.status = 'SUCCESSFUL'
         ) p ON TRUE
        WHERE s.school_id = $1 AND s.deleted_at IS NULL
          AND (COALESCE(b.billed, 0) - COALESCE(b.discount, 0) - COALESCE(p.paid, 0)) > 0
        ORDER BY balance DESC, s.id ASC
        LIMIT $2`,
      [schoolId, limit],
    );
  }

  /* -- The whole school ------------------------------------------------------ */

  /** Billed, waived, and how many families are behind. Scoped to a term if asked. */
  async overviewTotals(schoolId: string, termId?: string): Promise<OverviewTotals> {
    const params: unknown[] = [schoolId];
    let termClause = '';
    if (termId) {
      params.push(termId);
      termClause = ` AND i.term_id = $${params.length}`;
    }

    const [row] = await this.db.query(
      `SELECT COALESCE(SUM(i.subtotal), 0)::float AS "totalBilled",
              COALESCE(SUM(i.discount_total), 0)::float AS "totalDiscount"
         FROM invoices i
        WHERE i.school_id = $1 AND ${REAL_INVOICE}${termClause}`,
      params,
    );

    // Debtors are counted across the whole ledger even when the rest of the
    // card is scoped to a term: a family that owes for last term is still a
    // debtor today, and a term-scoped count would quietly forgive them.
    const [debtors] = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM (
         SELECT i.student_id
           FROM invoices i
          WHERE i.school_id = $1 AND ${REAL_INVOICE}
          GROUP BY i.student_id
         HAVING SUM(i.subtotal) - SUM(i.discount_total) > COALESCE((
                  SELECT SUM(p.amount) FROM payments p
                   WHERE p.school_id = $1 AND p.student_id = i.student_id
                     AND p.status = 'SUCCESSFUL'
                ), 0)
       ) owing`,
      [schoolId],
    );

    return {
      totalBilled: Number(row?.totalBilled ?? 0),
      totalDiscount: Number(row?.totalDiscount ?? 0),
      debtorCount: Number(debtors?.total ?? 0),
    };
  }

  /**
   * What came in. Unscoped that is every successful credit; scoped to a term
   * it has to be the allocations, because a payment carries no term of its own
   * — only the bill it settled does.
   */
  async collectedTotal(schoolId: string, termId?: string): Promise<number> {
    if (!termId) {
      const [row] = await this.db.query(
        `SELECT COALESCE(SUM(p.amount), 0)::float AS total
           FROM payments p
          WHERE p.school_id = $1 AND p.status = 'SUCCESSFUL'`,
        [schoolId],
      );
      return Number(row?.total ?? 0);
    }

    const [row] = await this.db.query(
      `SELECT COALESCE(SUM(pa.amount), 0)::float AS total
         FROM payment_allocations pa
         JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
         JOIN invoices i ON i.id = pa.invoice_id
        WHERE pa.school_id = $1 AND i.term_id = $2`,
      [schoolId, termId],
    );
    return Number(row?.total ?? 0);
  }

  /**
   * Twelve months of billed against collected, zero-filled.
   *
   * `generate_series` supplies the months rather than the data doing it: a
   * quiet August must appear as a zero on the chart, not as a gap that makes
   * July look adjacent to September.
   */
  async monthlyTrend(
    schoolId: string,
  ): Promise<{ label: string; billed: number; collected: number }[]> {
    return this.db.query(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         ) AS month
       )
       SELECT to_char(m.month, 'Mon') AS label,
              COALESCE(b.billed, 0)::float AS billed,
              COALESCE(p.collected, 0)::float AS collected
         FROM months m
         LEFT JOIN LATERAL (
           SELECT SUM(i.subtotal - i.discount_total) AS billed
             FROM invoices i
            WHERE i.school_id = $1 AND ${REAL_INVOICE}
              AND date_trunc('month', i.issue_date) = m.month
         ) b ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(pay.amount) AS collected
             FROM payments pay
            WHERE pay.school_id = $1 AND pay.status = 'SUCCESSFUL'
              AND date_trunc('month', pay.paid_at) = m.month
         ) p ON TRUE
        ORDER BY m.month`,
      [schoolId],
    );
  }

  /**
   * Billed and collected per fee category.
   *
   * Billed is a plain sum of the snapshot lines. Collected has to be
   * apportioned: a family pays one amount against a whole invoice and never
   * says "this part is the bus", so each payment is split across the invoice's
   * lines in the ratio they make up of it. `NULLIF` guards the invoice whose
   * total is zero, which a fully-discounted bill genuinely can be.
   */
  async byCategory(
    schoolId: string,
    termId?: string,
  ): Promise<{ category: string; billed: number; collected: number }[]> {
    const params: unknown[] = [schoolId];
    let termClause = '';
    if (termId) {
      params.push(termId);
      termClause = ` AND i.term_id = $${params.length}`;
    }

    return this.db.query(
      `SELECT il.category,
              COALESCE(SUM(il.line_total), 0)::float AS billed,
              COALESCE(SUM(
                COALESCE(alloc.paid, 0) * (il.line_total / NULLIF(i.total, 0))
              ), 0)::float AS collected
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         LEFT JOIN LATERAL (
           SELECT SUM(pa.amount) AS paid
             FROM payment_allocations pa
             JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
            WHERE pa.invoice_id = i.id
         ) alloc ON TRUE
        WHERE i.school_id = $1 AND ${REAL_INVOICE}${termClause}
          AND il.carried_from_invoice_id IS NULL
        GROUP BY il.category
        ORDER BY billed DESC`,
      params,
    );
  }

  /**
   * The five fee items billed for the most money — "top fee items" beside
   * `byCategory` on the same card, at the individual-item level instead of
   * the category one. Same billed/collected shape and the same pro-rata
   * apportionment of collected money across an invoice's lines, so the two
   * views read as one system rather than two different measures.
   *
   * Joined to `fee_items` for the name rather than reading `invoice_lines`'
   * own snapshot description: a fee item's `RESTRICT` delete means the row
   * always exists for any line that references it, and its current name is
   * what a bursar recognises even where an old invoice line's snapshot text
   * has since drifted (a renamed item, a class suffix appended per line).
   */
  async topFeeItems(
    schoolId: string,
    termId?: string,
    limit = 5,
  ): Promise<{ feeItemId: string; name: string; billed: number; collected: number }[]> {
    const params: unknown[] = [schoolId];
    let termClause = '';
    if (termId) {
      params.push(termId);
      termClause = ` AND i.term_id = $${params.length}`;
    }
    params.push(limit);

    return this.db.query(
      `SELECT il.fee_item_id AS "feeItemId",
              fi.name AS name,
              COALESCE(SUM(il.line_total), 0)::float AS billed,
              COALESCE(SUM(
                COALESCE(alloc.paid, 0) * (il.line_total / NULLIF(i.total, 0))
              ), 0)::float AS collected
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN fee_items fi ON fi.id = il.fee_item_id
         LEFT JOIN LATERAL (
           SELECT SUM(pa.amount) AS paid
             FROM payment_allocations pa
             JOIN payments p ON p.id = pa.payment_id AND p.status = 'SUCCESSFUL'
            WHERE pa.invoice_id = i.id
         ) alloc ON TRUE
        WHERE i.school_id = $1 AND ${REAL_INVOICE}${termClause}
          AND il.carried_from_invoice_id IS NULL
        GROUP BY il.fee_item_id, fi.name
        ORDER BY billed DESC
        LIMIT $${params.length}`,
      params,
    );
  }
}
