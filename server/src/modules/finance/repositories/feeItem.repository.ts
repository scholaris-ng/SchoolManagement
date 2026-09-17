import { In, type DeepPartial, type EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { FeeItem } from '../entities/feeItem.entity';
import { PaymentDestinationRepository } from './paymentDestination.repository';
import type { FeeItemDTO, PaymentDestinationDTO } from '../dto/finance.dto';

/**
 * `amount` is `numeric` in Postgres, which the driver hands back as a string so
 * no precision is lost on the way. It becomes a number exactly once, here, at
 * the boundary where a DTO is built.
 */
function toDTO(row: FeeItem, accounts: PaymentDestinationDTO[]): FeeItemDTO {
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
    hasQuantity: row.hasQuantity,
    accounts,
  };
}

export class FeeItemRepository extends TenantRepository<FeeItem> {
  static Instance = new FeeItemRepository();

  private constructor(private readonly destinations = PaymentDestinationRepository.Instance) {
    super(FeeItem, 'feeItem');
  }

  async fetchForSchool(schoolId: string): Promise<FeeItemDTO[]> {
    const rows = await this.repo.find({
      where: { schoolId },
      order: { category: 'ASC', name: 'ASC' },
    });
    if (rows.length === 0) return [];

    const resolved = await this.destinations.resolveMany(
      schoolId,
      rows.flatMap((row) => row.paymentDestinationIds),
    );
    return rows.map((row) => toDTO(row, accountsFor(row.paymentDestinationIds, resolved)));
  }

  async findOneDTO(schoolId: string, id: string): Promise<FeeItemDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    if (!row) return null;

    const resolved = await this.destinations.resolveMany(schoolId, row.paymentDestinationIds);
    return toDTO(row, accountsFor(row.paymentDestinationIds, resolved));
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

  /** One id or a hundred — the delete button and "delete selected" both call this. */
  async softDeleteMany(schoolId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo.softDelete({ schoolId, id: In(ids) } as never);
  }

  async create(data: DeepPartial<FeeItem>, manager?: EntityManager): Promise<FeeItem> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: DeepPartial<FeeItem>, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }
}

/** Resolved accounts in the order the item picked them, dangling ids dropped. */
function accountsFor(
  ids: string[],
  resolved: Map<string, PaymentDestinationDTO>,
): PaymentDestinationDTO[] {
  return ids.map((id) => resolved.get(id)).filter((account): account is PaymentDestinationDTO => Boolean(account));
}
