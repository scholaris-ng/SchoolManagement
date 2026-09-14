import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { FeeStructure } from '../entities/feeStructure.entity';
import { FeeStructureLine } from '../entities/feeStructureLine.entity';
import type { FeeStructureDTO } from '../dto/finance.dto';

/**
 * The whole structure in one row.
 *
 * `lines`, `levelNames` and both totals are lateral subqueries rather than a
 * join plus a reshape in Node: a school has a handful of structures and each
 * has a handful of lines, and assembling them in SQL keeps the list one query
 * however many there are (spec section 43).
 *
 * `mandatoryTotal` is the figure the office quotes a parent — what every pupil
 * in scope is billed. `optionalTotal` is what a boarder or a bus user adds on
 * top, and is shown separately for exactly that reason.
 */
const PROJECTION = `
  fs.id, fs.school_id AS "schoolId", fs.name,
  fs.session_id AS "sessionId", ses.name AS "sessionName",
  fs.term_id AS "termId", t.name AS "termName",
  fs.level_ids AS "levelIds", fs.class_ids AS "classIds",
  COALESCE((
    SELECT json_agg(l.name ORDER BY l.sequence)
    FROM school_levels l
    WHERE l.school_id = fs.school_id
      AND l.deleted_at IS NULL
      AND l.id::text IN (SELECT jsonb_array_elements_text(fs.level_ids))
  ), '[]'::json) AS "levelNames",
  COALESCE(lines.rows, '[]'::json) AS lines,
  COALESCE(lines.mandatory, 0)::float AS "mandatoryTotal",
  COALESCE(lines.optional, 0)::float AS "optionalTotal",
  fs.is_active AS "isActive", fs.version
`;

const JOINS = `
  FROM fee_structures fs
  JOIN academic_sessions ses ON ses.id = fs.session_id
  LEFT JOIN terms t ON t.id = fs.term_id
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        json_build_object(
          'id', fsl.id,
          'feeItemId', fsl.fee_item_id,
          'feeItemName', fi.name,
          'amount', fsl.amount::float,
          'isOptional', fsl.is_optional,
          'bankName', fi.bank_name,
          'accountNumber', fi.account_number,
          'accountName', fi.account_name
        ) ORDER BY fsl.sort_order, fi.name
      ) AS rows,
      SUM(fsl.amount) FILTER (WHERE NOT fsl.is_optional) AS mandatory,
      SUM(fsl.amount) FILTER (WHERE fsl.is_optional) AS optional
    FROM fee_structure_lines fsl
    JOIN fee_items fi ON fi.id = fsl.fee_item_id
    WHERE fsl.fee_structure_id = fs.id
  ) lines ON TRUE
`;

export interface FeeStructureFilter {
  page: number;
  pageSize: number;
  sessionId?: string;
  termId?: string;
  isActive?: boolean;
  search?: string;
}

/** One line as the generator needs it — amount already a number. */
export interface FeeStructureLineDefinition {
  feeItemId: string;
  name: string;
  category: string;
  amount: number;
  isOptional: boolean;
  sortOrder: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

/** A pupil a bulk run is about to bill. */
export interface BillableStudent {
  studentId: string;
  classId: string | null;
  boardingStatus: 'DAY' | 'BOARDING';
}

export class FeeStructureRepository extends TenantRepository<FeeStructure> {
  static Instance = new FeeStructureRepository();

  private readonly lines = this.repo.manager.getRepository(FeeStructureLine);

  private constructor() {
    super(FeeStructure, 'feeStructure');
  }

  /* -- Reads ----------------------------------------------------------------- */

  async fetchPaginated(
    schoolId: string,
    filter: FeeStructureFilter,
  ): Promise<Paginated<FeeStructureDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['fs.school_id = $1'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.sessionId) add((i) => `fs.session_id = $${i}`, filter.sessionId);
    if (filter.termId) add((i) => `fs.term_id = $${i}`, filter.termId);
    if (filter.isActive !== undefined) add((i) => `fs.is_active = $${i}`, filter.isActive);
    if (filter.search) add((i) => `fs.name ILIKE $${i}`, `%${filter.search}%`);

    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM fee_structures fs WHERE ${whereSql}`,
      params,
    );
    const rows: FeeStructureDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} ${JOINS}
       WHERE ${whereSql}
       ORDER BY ses.start_date DESC, fs.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findOneDTO(schoolId: string, id: string): Promise<FeeStructureDTO | null> {
    const rows: FeeStructureDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} ${JOINS} WHERE fs.school_id = $1 AND fs.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /** The lines as the invoice generator wants them: numbers, with the item's category. */
  async lineDefinitions(
    schoolId: string,
    structureId: string,
    manager?: EntityManager,
  ): Promise<FeeStructureLineDefinition[]> {
    const runner = manager ?? this.repo.manager;
    return runner.query(
      `SELECT fsl.fee_item_id AS "feeItemId", fi.name, fi.category,
              fsl.amount::float AS amount, fsl.is_optional AS "isOptional",
              fsl.sort_order AS "sortOrder",
              fi.bank_name AS "bankName", fi.account_number AS "accountNumber",
              fi.account_name AS "accountName"
         FROM fee_structure_lines fsl
         JOIN fee_items fi ON fi.id = fsl.fee_item_id
        WHERE fsl.school_id = $1 AND fsl.fee_structure_id = $2
        ORDER BY fsl.sort_order, fi.name`,
      [schoolId, structureId],
    );
  }

  /**
   * Who this structure still has to bill for this term.
   *
   * Enrolment is the authority on where a pupil sits *in a session* — the
   * class on the student row is a denormalised pointer that promotion moves —
   * so the level and class filters read the enrolment for the structure's
   * session, and fall back to `current_class_id` for a pupil admitted before
   * the enrolment was written.
   *
   * The `NOT EXISTS` is what makes a second run of the same button a no-op
   * rather than a second bill. The partial unique index on `invoices` catches
   * the same thing a millisecond later if two bursars press it at once.
   */
  async studentsToBill(
    schoolId: string,
    structure: { id: string; sessionId: string; levelIds: string[]; classIds: string[] },
    termId: string,
    manager?: EntityManager,
  ): Promise<BillableStudent[]> {
    const runner = manager ?? this.repo.manager;
    return runner.query(
      `SELECT s.id AS "studentId",
              COALESCE(e.class_id, s.current_class_id) AS "classId",
              s.boarding_status AS "boardingStatus"
         FROM students s
         LEFT JOIN LATERAL (
           SELECT en.class_id, en.level_id
             FROM student_enrollments en
            WHERE en.school_id = s.school_id
              AND en.student_id = s.id
              AND en.session_id = $2
              AND en.status = 'ACTIVE'
            ORDER BY en.created_at DESC
            LIMIT 1
         ) e ON TRUE
         LEFT JOIN school_classes c ON c.id = COALESCE(e.class_id, s.current_class_id)
        WHERE s.school_id = $1
          AND s.deleted_at IS NULL
          AND s.status = 'ACTIVE'
          AND (
            COALESCE(array_length($3::uuid[], 1), 0) = 0
            OR COALESCE(e.level_id, c.level_id) = ANY($3::uuid[])
          )
          AND (
            COALESCE(array_length($4::uuid[], 1), 0) = 0
            OR COALESCE(e.class_id, s.current_class_id) = ANY($4::uuid[])
          )
          AND NOT EXISTS (
            SELECT 1 FROM invoices i
             WHERE i.fee_structure_id = $5
               AND i.student_id = s.id
               AND i.term_id = $6
               AND i.status <> 'CANCELLED'
          )
        ORDER BY s.last_name, s.first_name, s.id`,
      [schoolId, structure.sessionId, structure.levelIds, structure.classIds, structure.id, termId],
    );
  }

  /**
   * How many pupils this structure has *already* billed for a term — the
   * "skipped" half of a generate run's answer, counted before the run so the
   * office is told what happened rather than just what changed.
   */
  async countAlreadyBilled(
    schoolId: string,
    structureId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const runner = manager ?? this.repo.manager;
    const [row] = await runner.query(
      `SELECT COUNT(DISTINCT i.student_id)::int AS total
         FROM invoices i
        WHERE i.school_id = $1 AND i.fee_structure_id = $2 AND i.term_id = $3
          AND i.status <> 'CANCELLED'`,
      [schoolId, structureId, termId],
    );
    return Number(row?.total ?? 0);
  }

  /**
   * Whether this structure has ever produced a real invoice, cancelled ones
   * included — deleting one that has would sever the pointer an issued bill
   * uses to say what it was raised from (`Invoice.feeStructureId`).
   */
  async hasInvoices(schoolId: string, structureId: string): Promise<boolean> {
    const [row] = await this.repo.query(
      `SELECT EXISTS (
         SELECT 1 FROM invoices WHERE school_id = $1 AND fee_structure_id = $2
       ) AS exists`,
      [schoolId, structureId],
    );
    return Boolean(row?.exists);
  }

  /* -- Writes ---------------------------------------------------------------- */

  async create(data: DeepPartial<FeeStructure>, manager?: EntityManager): Promise<FeeStructure> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  /** Its lines cascade with it (`FK_fee_structure_lines_structure`). */
  async delete(schoolId: string, id: string): Promise<void> {
    await this.repo.delete({ schoolId, id });
  }

  async update(
    id: string,
    patch: DeepPartial<FeeStructure>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  /**
   * Lines are replaced wholesale, never patched one at a time.
   *
   * A structure's line set is a single decision — "this is what the term
   * costs" — and diffing it row by row would let a half-applied edit leave a
   * charge behind that nobody chose. Cheap, too: a structure has a dozen lines
   * at most.
   */
  async replaceLines(
    schoolId: string,
    structureId: string,
    lines: { feeItemId: string; amount: number; isOptional: boolean }[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(FeeStructureLine) : this.lines;
    await repo.delete({ schoolId, feeStructureId: structureId });
    if (lines.length === 0) return;

    await repo.insert(
      lines.map((line, index) => ({
        schoolId,
        feeStructureId: structureId,
        feeItemId: line.feeItemId,
        amount: line.amount.toFixed(2),
        isOptional: line.isOptional,
        sortOrder: index,
      })),
    );
  }
}
