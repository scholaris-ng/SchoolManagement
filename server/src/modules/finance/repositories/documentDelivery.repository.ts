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

export interface DeliveryFilter {
  page: number;
  pageSize: number;
  documentType?: string;
  channel?: string;
  printFormat?: string;
  status?: string;
  studentId?: string;
  /** `YYYY-MM-DD`, inclusive, read as whole days in `timezone`. */
  dateFrom?: string;
  dateTo?: string;
  /** The school's own zone. Only read when a date bound is set. */
  timezone?: string;
  /** Matches a document number, a student's name or who it was sent to. */
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
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

  /** The register: everything this school has sent, filtered and paged. */
  async fetchPaginated(
    schoolId: string,
    filter: DeliveryFilter,
  ): Promise<Paginated<DocumentDeliveryDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['dd.school_id = $1'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.documentType) add((i) => `dd.document_type = $${i}`, filter.documentType);
    if (filter.channel) add((i) => `dd.channel = $${i}`, filter.channel);
    if (filter.printFormat) add((i) => `dd.print_format = $${i}`, filter.printFormat);
    if (filter.status) add((i) => `dd.status = $${i}`, filter.status);
    if (filter.studentId) add((i) => `dd.student_id = $${i}`, filter.studentId);

    // `sent_at` is an instant, so "the 1st" has to mean midnight in the school's
    // own zone — the same reasoning, and the same shape, as
    // `PaymentRepository.fetchPaginated`: a bare range on the column, so the
    // `(school_id, sent_at)` index can still serve it.
    if (filter.dateFrom || filter.dateTo) {
      params.push(filter.timezone ?? DEFAULT_TIMEZONE);
      const zone = `$${params.length}::text`;
      if (filter.dateFrom) {
        add((i) => `dd.sent_at >= ($${i}::date)::timestamp AT TIME ZONE ${zone}`, filter.dateFrom);
      }
      if (filter.dateTo) {
        // Exclusive of the day after, which is how "through the 30th" includes 23:59.
        add((i) => `dd.sent_at < (($${i}::date) + 1)::timestamp AT TIME ZONE ${zone}`, filter.dateTo);
      }
    }

    if (filter.search) {
      add(
        (i) =>
          `(dd.document_label ILIKE $${i} OR dd.student_name ILIKE $${i} OR dd.recipient_name ILIKE $${i} OR dd.recipient_contact ILIKE $${i})`,
        `%${filter.search}%`,
      );
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
}
