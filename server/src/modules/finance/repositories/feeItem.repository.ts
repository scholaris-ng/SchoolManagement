import { In, type DeepPartial, type EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { FeeItem } from '../entities/feeItem.entity';
import { FeeItemPaymentAccount } from '../entities/feeItemPaymentAccount.entity';
import type { FeeItemAccountInput } from '../validators/feeItems.schema';
import type { FeeItemDTO, FeeItemPaymentAccountDTO } from '../dto/finance.dto';

/**
 * `amount` is `numeric` in Postgres, which the driver hands back as a string so
 * no precision is lost on the way. It becomes a number exactly once, here, at
 * the boundary where a DTO is built.
 */
function toDTO(row: FeeItem, accounts: FeeItemPaymentAccountDTO[]): FeeItemDTO {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    code: row.code,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    isOptional: row.isOptional,
    isRecurring: row.isRecurring,
    isActive: row.isActive,
    accounts,
  };
}

function toAccountDTO(row: FeeItemPaymentAccount): FeeItemPaymentAccountDTO {
  return {
    id: row.id,
    label: row.label,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
  };
}

export class FeeItemRepository extends TenantRepository<FeeItem> {
  static Instance = new FeeItemRepository();

  private readonly accounts = this.repo.manager.getRepository(FeeItemPaymentAccount);

  private constructor() {
    super(FeeItem, 'feeItem');
  }

  async fetchForSchool(schoolId: string): Promise<FeeItemDTO[]> {
    const rows = await this.repo.find({
      where: { schoolId },
      order: { category: 'ASC', name: 'ASC' },
    });
    if (rows.length === 0) return [];

    const accountsByItem = await this.accountsFor(
      schoolId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toDTO(row, accountsByItem.get(row.id) ?? []));
  }

  async findOneDTO(schoolId: string, id: string): Promise<FeeItemDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    if (!row) return null;

    const accountsByItem = await this.accountsFor(schoolId, [id]);
    return toDTO(row, accountsByItem.get(id) ?? []);
  }

  /** Every account on a set of items, grouped back by `feeItemId`. */
  private async accountsFor(
    schoolId: string,
    feeItemIds: string[],
  ): Promise<Map<string, FeeItemPaymentAccountDTO[]>> {
    const rows = await this.accounts.find({
      where: { schoolId, feeItemId: In(feeItemIds) },
      order: { sortOrder: 'ASC' },
    });
    const byItem = new Map<string, FeeItemPaymentAccountDTO[]>();
    for (const row of rows) {
      const list = byItem.get(row.feeItemId) ?? [];
      list.push(toAccountDTO(row));
      byItem.set(row.feeItemId, list);
    }
    return byItem;
  }

  async findByCode(
    schoolId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<FeeItem | null> {
    return this.repoFor(manager).findOne({ where: { schoolId, code } });
  }

  /** Looks up a whole spreadsheet's worth of fee codes at once. */
  async findManyByCode(
    schoolId: string,
    codes: string[],
    manager?: EntityManager,
  ): Promise<{ id: string; code: string }[]> {
    if (codes.length === 0) return [];
    return (manager ?? this.repo.manager).query(
      `SELECT id, code FROM fee_items
        WHERE school_id = $1 AND deleted_at IS NULL AND code = ANY($2::text[])`,
      [schoolId, codes.map((code) => code.toUpperCase())],
    );
  }

  /** How many of these ids are real fee items belonging to this school. */
  async countExisting(schoolId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.repo.count({ where: { schoolId, id: In(ids) } });
  }

  async create(data: DeepPartial<FeeItem>, manager?: EntityManager): Promise<FeeItem> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: DeepPartial<FeeItem>, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  /**
   * Replaces a fee item's whole account list at once, the same way
   * `FeeStructureRepository.replaceLines` treats a structure's charges: which
   * accounts apply is one decision, not a list of rows to patch individually.
   */
  async replaceAccounts(
    schoolId: string,
    feeItemId: string,
    accounts: FeeItemAccountInput[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(FeeItemPaymentAccount) : this.accounts;
    await repo.delete({ schoolId, feeItemId });
    if (accounts.length === 0) return;

    await repo.insert(
      accounts.map((account, index) => ({
        schoolId,
        feeItemId,
        label: account.label ?? null,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        sortOrder: index,
      })),
    );
  }
}
