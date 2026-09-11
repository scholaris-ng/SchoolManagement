import { AppError } from '../../../shared/errors/AppError';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import type { FeeItemDTO } from '../dto/finance.dto';
import type { CreateFeeItemInput, UpdateFeeItemInput } from '../validators/feeItems.schema';
import type { FeeCategory } from '../entities/feeItem.entity';

/**
 * What a school charges for.
 *
 * Fee items are definitions, not money that has moved — an invoice or a
 * payment is a claim about a family and stays unbuilt until the ledger lands.
 */
export class FeeItemsService {
  static Instance = new FeeItemsService();

  private constructor(
    private readonly feeItems = FeeItemRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchAll(
    context: RequestContext,
    page: number,
    pageSize: number,
  ): Promise<Paginated<FeeItemDTO>> {
    // Small enough a list that a school reads it whole; paged to keep the
    // client's contract rather than because the volume demands it.
    const items = await this.feeItems.fetchForSchool(context.schoolId);
    const start = (page - 1) * pageSize;
    return paginatedResult(items.slice(start, start + pageSize), page, pageSize, items.length);
  }

  async create(context: RequestContext, input: CreateFeeItemInput): Promise<FeeItemDTO> {
    const clash = await this.feeItems.findByCode(context.schoolId, input.code);
    if (clash) throw AppError.conflict('A fee item with that code already exists.');

    const created = await this.feeItems.create({
      schoolId: context.schoolId,
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      amount: input.amount.toFixed(2),
      category: input.category as FeeCategory,
      isOptional: input.isOptional,
      isRecurring: input.isRecurring,
      isActive: input.isActive,
    });

    await this.audit.record(context, {
      action: 'feeItem.created',
      entityType: 'FeeItem',
      entityId: created.id,
      entityLabel: `${created.name} (${created.code})`,
      after: { code: created.code, amount: created.amount, category: created.category },
    });

    return this.requireDTO(context, created.id);
  }

  async update(
    context: RequestContext,
    id: string,
    patch: UpdateFeeItemInput,
  ): Promise<FeeItemDTO> {
    const existing = await this.feeItems.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Fee item');

    if (patch.code && patch.code !== existing.code) {
      const clash = await this.feeItems.findByCode(context.schoolId, patch.code);
      if (clash) throw AppError.conflict('A fee item with that code already exists.');
    }

    await this.feeItems.update(id, {
      ...patch,
      amount: patch.amount === undefined ? undefined : patch.amount.toFixed(2),
      category: patch.category as FeeCategory | undefined,
    });

    await this.audit.record(context, {
      action: 'feeItem.updated',
      entityType: 'FeeItem',
      entityId: id,
      entityLabel: `${patch.name ?? existing.name} (${patch.code ?? existing.code})`,
      after: patch,
    });

    return this.requireDTO(context, id);
  }

  private async requireDTO(context: RequestContext, id: string): Promise<FeeItemDTO> {
    const dto = await this.feeItems.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Fee item');
    return dto;
  }
}
