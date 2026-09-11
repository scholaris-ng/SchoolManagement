import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { FeeItem } from '../entities/feeItem.entity';
import type { FeeItemDTO } from '../dto/finance.dto';

/**
 * `amount` is `numeric` in Postgres, which the driver hands back as a string so
 * no precision is lost on the way. It becomes a number exactly once, here, at
 * the boundary where a DTO is built.
 */
function toDTO(row: FeeItem): FeeItemDTO {
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
  };
}

export class FeeItemRepository extends TenantRepository<FeeItem> {
  static Instance = new FeeItemRepository();

  private constructor() {
    super(FeeItem, 'feeItem');
  }

  async fetchForSchool(schoolId: string): Promise<FeeItemDTO[]> {
    const rows = await this.repo.find({
      where: { schoolId },
      order: { category: 'ASC', name: 'ASC' },
    });
    return rows.map(toDTO);
  }

  async findOneDTO(schoolId: string, id: string): Promise<FeeItemDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    return row ? toDTO(row) : null;
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

  async create(data: DeepPartial<FeeItem>, manager?: EntityManager): Promise<FeeItem> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: DeepPartial<FeeItem>, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  toDTO = toDTO;
}
