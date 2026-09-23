import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import { DEFAULT_TIMEZONE } from '../../../shared/utils/timezone';
import type { Paginated } from '../../../shared/response/apiResponse';
import { DocumentDelivery } from '../entities/documentDelivery.entity';
import type { DocumentDeliveryDTO } from '../dto/finance.dto';

/**
 * Every column is read off this one table: `document_label` and `student_name`
 * are captured at send time precisely so the register needs no joins — and so a
 * row survives the document it describes being deleted.
 */
const PROJECTION = `
  dd.id, dd.document_type AS "documentType", dd.document_id AS "documentId",
  dd.document_label AS "documentLabel",
  dd.student_id AS "studentId", dd.student_name AS "studentName",
  dd.channel, dd.print_format AS "printFormat", dd.status,
  dd.recipient_name AS "recipientName", dd.recipient_contact AS "recipientContact",
  dd.guardian_id AS "guardianId",
  dd.include_charges AS "includeCharges",
  dd.note, dd.failure_reason AS "failureReason",
  dd.sent_by_name AS "sentByName", dd.sent_at AS "sentAt",
  dd.confirmed_by_name AS "confirmedByName", dd.confirmed_at AS "confirmedAt"
`;

const SORTABLE: Record<string, string> = {
  sentAt: 'dd.sent_at',
  documentLabel: 'dd.document_label',
  studentName: 'dd.student_name',
};

/** The filters shared by a read of the register and a bulk write against it. */
export interface DeliveryScope {
  documentType?: string;
  channel?: string;
  printFormat?: string;
  studentId?: string;
  /** `YYYY-MM-DD`, inclusive, read as whole days in `timezone`. */
  dateFrom?: string;
  dateTo?: string;
  /** The school's own zone. Only read when a date bound is set. */
  timezone?: string;
  /** Matches a document number, a student's name or who it was sent to. */
  search?: string;
}

export interface DeliveryFilter extends DeliveryScope {
  page: number;
  pageSize: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** One row `confirmAll` actually changed — enough to write its own audit entry without a second read. */
export interface ConfirmedDelivery {
  id: string;
  documentType: string;
  documentLabel: string;
  channel: string;
}

export class DocumentDeliveryRepository extends TenantRepository<DocumentDelivery> {
  static Instance = new DocumentDeliveryRepository();

  private constructor() {
    super(DocumentDelivery, 'documentDelivery');
  }

  async create(data: DeepPartial<DocumentDelivery>): Promise<DocumentDelivery> {
    return this.repo.save(this.repo.create(data));
  }

  async findEntity(schoolId: string, id: string): Promise<DocumentDelivery | null> {
    return this.repo.findOne({ where: { schoolId, id } });
  }

  async findOneRow(schoolId: string, id: string): Promise<DocumentDeliveryDTO | null> {
    const rows = await this.repo.query(
      `SELECT ${PROJECTION} FROM document_deliveries dd WHERE dd.school_id = $1 AND dd.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * One document's whole delivery history, newest first — all of it, not a page:
   * a document sent more than a handful of times is already remarkable, and the
   * office wants to see every one of them.
   */
  async findForDocument(
    schoolId: string,
    documentType: string,
    documentId: string,
  ): Promise<DocumentDeliveryDTO[]> {
    return this.repo.query(
      `SELECT ${PROJECTION}
         FROM document_deliveries dd
        WHERE dd.school_id = $1 AND dd.document_type = $2 AND dd.document_id = $3
        ORDER BY dd.sent_at DESC`,
      [schoolId, documentType, documentId],
    );
  }

  /**
   * The `WHERE` clauses every read or bulk write against the register shares —
   * everything except `status`, which `fetchPaginated` and `confirmAll` each
   * pin to something different: whatever the office chose to look at, versus
   * exactly `PREPARED`, the only status a confirmation can ever apply to.
   */
  private applyScope(params: unknown[], where: string[], scope: DeliveryScope): void {
    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (scope.documentType) add((i) => `dd.document_type = $${i}`, scope.documentType);
    if (scope.channel) add((i) => `dd.channel = $${i}`, scope.channel);
    if (scope.printFormat) add((i) => `dd.print_format = $${i}`, scope.printFormat);
    if (scope.studentId) add((i) => `dd.student_id = $${i}`, scope.studentId);

    // `sent_at` is an instant, so "the 1st" has to mean midnight in the school's
    // own zone — the same reasoning, and the same shape, as
    // `PaymentRepository.fetchPaginated`: a bare range on the column, so the
    // `(school_id, sent_at)` index can still serve it.
    if (scope.dateFrom || scope.dateTo) {
      params.push(scope.timezone ?? DEFAULT_TIMEZONE);
      const zone = `$${params.length}::text`;
      if (scope.dateFrom) {
        add((i) => `dd.sent_at >= ($${i}::date)::timestamp AT TIME ZONE ${zone}`, scope.dateFrom);
      }
      if (scope.dateTo) {
        // Exclusive of the day after, which is how "through the 30th" includes 23:59.
        add((i) => `dd.sent_at < (($${i}::date) + 1)::timestamp AT TIME ZONE ${zone}`, scope.dateTo);
      }
    }

    if (scope.search) {
      add(
        (i) =>
          `(dd.document_label ILIKE $${i} OR dd.student_name ILIKE $${i} OR dd.recipient_name ILIKE $${i} OR dd.recipient_contact ILIKE $${i})`,
        `%${scope.search}%`,
      );
    }
  }

  /** The register: everything this school has sent, filtered and paged. */
  async fetchPaginated(
    schoolId: string,
    filter: DeliveryFilter,
  ): Promise<Paginated<DocumentDeliveryDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['dd.school_id = $1'];
    this.applyScope(params, where, filter);
    if (filter.status) {
      params.push(filter.status);
      where.push(`dd.status = $${params.length}`);
    }

    const whereSql = where.join(' AND ');
    const sortKey = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'sentAt');
    const direction = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM document_deliveries dd WHERE ${whereSql}`,
      params,
    );
    const rows = await this.repo.query(
      `SELECT ${PROJECTION}
         FROM document_deliveries dd
        WHERE ${whereSql}
        ORDER BY ${SORTABLE[sortKey]} ${direction}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /**
   * Marks a `PREPARED` copy as one the family has. Conditional on the current
   * status, so two people confirming the same print do not overwrite each
   * other's name on it — and so a `FAILED` send can never be confirmed into
   * looking successful.
   */
  async confirm(
    schoolId: string,
    id: string,
    by: { userId: string; name: string },
  ): Promise<boolean> {
    const result = await this.repo.update(
      { schoolId, id, status: 'PREPARED' },
      {
        status: 'CONFIRMED',
        confirmedByUserId: by.userId,
        confirmedByName: by.name,
        confirmedAt: new Date(),
      },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Confirms every `PREPARED` copy matching a scope in one statement — the
   * office's own "yes, all of these went out" rather than one click per row.
   *
   * Deliberately not built from `confirm`: a thousand individual `UPDATE`s for
   * a backlog is a thousand round trips, where this is one. Returns exactly
   * what changed, so the service can write one audit entry per confirmation
   * without a second read to find out what it just did.
   */
  async confirmAll(
    schoolId: string,
    scope: DeliveryScope,
    by: { userId: string; name: string },
  ): Promise<ConfirmedDelivery[]> {
    const params: unknown[] = [schoolId];
    const where = ['dd.school_id = $1', `dd.status = 'PREPARED'`];
    this.applyScope(params, where, scope);

    params.push(by.userId, by.name);
    const userIdIndex = params.length - 1;
    const nameIndex = params.length;

    // `pg`/TypeORM hands an `UPDATE` back as `[rows, affectedCount]`, not bare
    // rows the way a `SELECT` does — unlike every other query in this file.
    const [rows]: [ConfirmedDelivery[], number] = await this.repo.query(
      `UPDATE document_deliveries dd
          SET status = 'CONFIRMED',
              confirmed_by_user_id = $${userIdIndex},
              confirmed_by_name = $${nameIndex},
              confirmed_at = now()
        WHERE ${where.join(' AND ')}
        RETURNING dd.id, dd.document_type AS "documentType", dd.document_label AS "documentLabel", dd.channel`,
      params,
    );
    return rows;
  }
}
