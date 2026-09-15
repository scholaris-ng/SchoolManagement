import { In, type DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { PaymentDestination } from '../entities/paymentDestination.entity';
import type { PaymentDestinationDTO } from '../dto/finance.dto';

function toDTO(row: PaymentDestination): PaymentDestinationDTO {
  return {
    id: row.id,
    schoolId: row.schoolId,
    label: row.label,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    sortOrder: row.sortOrder,
  };
}

/**
 * Every place an id from this table can be referenced, for `merge` to
 * repoint before deleting the rows it folds away. Named as bare table and
 * column identifiers rather than by importing each referencing repository,
 * since this only ever needs to read and rewrite one jsonb array column.
 */
const REFERENCING_TABLES = [
  { table: 'fee_items', column: 'payment_destination_ids' },
  { table: 'custom_bills', column: 'payment_destination_ids' },
  { table: 'fee_structure_lines', column: 'account_ids' },
] as const;

export class PaymentDestinationRepository extends TenantRepository<PaymentDestination> {
  static Instance = new PaymentDestinationRepository();

  private constructor() {
    super(PaymentDestination, 'paymentDestination');
  }

  async fetchForSchool(schoolId: string): Promise<PaymentDestinationDTO[]> {
    const rows = await this.repo.find({
      where: { schoolId },
      order: { sortOrder: 'ASC', bankName: 'ASC' },
    });
    return rows.map(toDTO);
  }

  async findOneDTO(schoolId: string, id: string): Promise<PaymentDestinationDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    return row ? toDTO(row) : null;
  }

  /**
   * Resolves a set of ids into their accounts, keyed by id, for whoever is
   * pointing at them — a fee item, a fee structure line, a custom bill. An id
   * that no longer matches anything (the account was since deleted) is simply
   * absent from the map rather than an error: callers already skip ids they
   * can't resolve, the same way `FeeStructureRepository`'s SQL joins do.
   */
  async resolveMany(schoolId: string, ids: string[]): Promise<Map<string, PaymentDestinationDTO>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repo.find({ where: { schoolId, id: In(ids) } });
    return new Map(rows.map((row) => [row.id, toDTO(row)]));
  }

  /** How many of these ids are real accounts belonging to this school. */
  async countExisting(schoolId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.repo.count({ where: { schoolId, id: In(ids) } });
  }

  /** An existing account with the same bank and number, for the duplicate check in `create`. */
  async findMatch(
    schoolId: string,
    bankName: string,
    accountNumber: string,
  ): Promise<PaymentDestination | null> {
    return this.repo.findOne({ where: { schoolId, bankName, accountNumber } });
  }

  /**
   * Groups of accounts that share a bank and account number — almost
   * certainly the same real account, typed in more than once back when each
   * fee item held its own private copy. Only groups with more than one row
   * are returned; a bursar merges each from the "Payment accounts" screen.
   */
  async findDuplicateGroups(schoolId: string): Promise<PaymentDestinationDTO[][]> {
    const rows = await this.fetchForSchool(schoolId);
    const groups = new Map<string, PaymentDestinationDTO[]>();
    for (const row of rows) {
      const key = `${row.bankName.trim().toLowerCase()}::${row.accountNumber.trim()}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }

  async create(data: DeepPartial<PaymentDestination>): Promise<PaymentDestination> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<PaymentDestination>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  async remove(schoolId: string, id: string): Promise<void> {
    await this.repo.delete({ schoolId, id });
  }

  /**
   * Folds a group of duplicate accounts into one survivor: every fee item,
   * custom bill and fee structure line that pointed at one of `mergeIds` is
   * repointed to `keepId` first — de-duplicated, order otherwise preserved —
   * before the now-unreferenced rows are deleted. One transaction, so a
   * failure partway through never leaves a reference pointing at a row that
   * no longer exists.
   */
  async merge(schoolId: string, keepId: string, mergeIds: string[]): Promise<void> {
    const mergeSet = new Set(mergeIds);
    await this.repo.manager.transaction(async (manager) => {
      for (const { table, column } of REFERENCING_TABLES) {
        const rows: { id: string; ids: string[] }[] = await manager.query(
          `SELECT id, ${column} AS ids FROM ${table}
            WHERE school_id = $1
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(${column}) AS val
                 WHERE val = ANY($2::text[])
              )`,
          [schoolId, mergeIds],
        );
        for (const row of rows) {
          const next: string[] = [];
          for (const id of row.ids) {
            const mapped = mergeSet.has(id) ? keepId : id;
            if (!next.includes(mapped)) next.push(mapped);
          }
          await manager.query(`UPDATE ${table} SET ${column} = $1::jsonb WHERE id = $2`, [
            JSON.stringify(next),
            row.id,
          ]);
        }
      }
      await manager.getRepository(PaymentDestination).delete({ schoolId, id: In(mergeIds) });
    });
  }

  toDTO = toDTO;
}
