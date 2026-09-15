import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { CustomBill } from '../entities/customBill.entity';
import { PaymentDestinationRepository } from './paymentDestination.repository';
import type { CustomBillDTO, PaymentDestinationDTO } from '../dto/finance.dto';

/**
 * `total` is `numeric` in Postgres, which the driver hands back as a string
 * so no precision is lost on the way. It becomes a number exactly once,
 * here, at the boundary where a DTO is built.
 */
function toDTO(row: CustomBill, accounts: PaymentDestinationDTO[]): CustomBillDTO {
  return {
    id: row.id,
    schoolId: row.schoolId,
    payerName: row.payerName,
    lines: row.lines,
    total: Number(row.total),
    note: row.note,
    accounts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resolved accounts in the order the bill picked them, dangling ids dropped. */
function accountsFor(
  ids: string[],
  resolved: Map<string, PaymentDestinationDTO>,
): PaymentDestinationDTO[] {
  return ids.map((id) => resolved.get(id)).filter((account): account is PaymentDestinationDTO => Boolean(account));
}

export interface CustomBillFilter {
  page: number;
  pageSize: number;
  search?: string;
}

export class CustomBillRepository extends TenantRepository<CustomBill> {
  static Instance = new CustomBillRepository();

  private constructor(private readonly destinations = PaymentDestinationRepository.Instance) {
    super(CustomBill, 'customBill');
  }

  async fetchPaginated(
    schoolId: string,
    filter: CustomBillFilter,
  ): Promise<Paginated<CustomBillDTO>> {
    const qb = this.repo
      .createQueryBuilder('customBill')
      .where('customBill.schoolId = :schoolId', { schoolId });

    if (filter.search) {
      qb.andWhere('customBill.payerName ILIKE :search', { search: `%${filter.search}%` });
    }

    const [rows, total] = await qb
      .orderBy('customBill.createdAt', 'DESC')
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize)
      .getManyAndCount();

    const resolved = await this.destinations.resolveMany(
      schoolId,
      rows.flatMap((row) => row.paymentDestinationIds),
    );
    return paginatedResult(
      rows.map((row) => toDTO(row, accountsFor(row.paymentDestinationIds, resolved))),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<CustomBillDTO | null> {
    const row = await this.repo.findOne({ where: { schoolId, id } });
    if (!row) return null;

    const resolved = await this.destinations.resolveMany(schoolId, row.paymentDestinationIds);
    return toDTO(row, accountsFor(row.paymentDestinationIds, resolved));
  }

  async create(data: DeepPartial<CustomBill>): Promise<CustomBill> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<CustomBill>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  async delete(schoolId: string, id: string): Promise<void> {
    await this.repo.delete({ schoolId, id });
  }
}
