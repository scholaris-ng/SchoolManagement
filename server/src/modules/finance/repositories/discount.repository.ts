import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Discount } from '../entities/discount.entity';
import type { DiscountDTO } from '../dto/finance.dto';

/**
 * `value` is `numeric` in Postgres, which the driver hands back as a string so
 * no precision is lost on the way. It becomes a number exactly once, here, at
 * the boundary where a DTO is built.
 */
function toDTO(row: Discount): DiscountDTO {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    type: row.type,
    mode: row.mode,
    value: Number(row.value),
    appliesToFeeItemIds: row.appliesToFeeItemIds,
    isActive: row.isActive,
    description: row.description,
  };
}

export class DiscountRepository extends TenantRepository<Discount> {
  static Instance = new DiscountRepository();

  private constructor() {
    super(Discount, 'discount');
  }

  async fetchForSchool(schoolId: string): Promise<DiscountDTO[]> {
    const rows = await this.repo.find({
      where: { schoolId },
      order: { name: 'ASC' },
    });
    return rows.map(toDTO);
  }

  async findOneDTO(schoolId: string, id: string): Promise<DiscountDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    return row ? toDTO(row) : null;
  }

  async create(data: DeepPartial<Discount>, manager?: EntityManager): Promise<Discount> {
    const repo = this.repoFor(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Discount>, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).update(id, patch as never);
  }

  toDTO = toDTO;
}
