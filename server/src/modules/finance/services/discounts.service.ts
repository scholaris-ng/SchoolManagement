import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { DiscountRepository } from '../repositories/discount.repository';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import type { DiscountDTO } from '../dto/finance.dto';
import type { CreateDiscountInput, UpdateDiscountInput } from '../validators/discounts.schema';
import type { DiscountMode, DiscountType } from '../entities/discount.entity';

/**
 * Waivers a school may apply against fees.
 *
 * A discount is a definition, like a fee item — what could be waived, not
 * money that has moved. Applying one to a real invoice line waits on the
 * ledger existing.
 */
export class DiscountsService {
  static Instance = new DiscountsService();

  private constructor(
    private readonly discounts = DiscountRepository.Instance,
    private readonly feeItems = FeeItemRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /** The client types this as a bare array — small enough a school reads it whole. */
  async fetchAll(context: RequestContext): Promise<DiscountDTO[]> {
    return this.discounts.fetchForSchool(context.schoolId);
  }

  async create(context: RequestContext, input: CreateDiscountInput): Promise<DiscountDTO> {
    await this.assertFeeItemsExist(context.schoolId, input.appliesToFeeItemIds);

    const created = await this.discounts.create({
      schoolId: context.schoolId,
      name: input.name,
      type: input.type as DiscountType,
      mode: input.mode as DiscountMode,
      value: input.value.toFixed(2),
      appliesToFeeItemIds: input.appliesToFeeItemIds,
      description: input.description ?? null,
      isActive: input.isActive,
    });

    await this.audit.record(context, {
      action: 'discount.created',
      entityType: 'Discount',
      entityId: created.id,
      entityLabel: created.name,
      after: { type: created.type, mode: created.mode, value: created.value },
    });

    return this.requireDTO(context, created.id);
  }

  async update(
    context: RequestContext,
    id: string,
    patch: UpdateDiscountInput,
  ): Promise<DiscountDTO> {
    const existing = await this.discounts.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Discount');

    if (patch.appliesToFeeItemIds) {
      await this.assertFeeItemsExist(context.schoolId, patch.appliesToFeeItemIds);
    }

    const mode = (patch.mode ?? existing.mode) as DiscountMode;
    const value = patch.value ?? Number(existing.value);
    if (mode === 'PERCENTAGE' && value > 100) {
      throw AppError.badRequest('A percentage discount cannot exceed 100.');
    }

    await this.discounts.update(id, {
      ...patch,
      type: patch.type as DiscountType | undefined,
      mode: patch.mode as DiscountMode | undefined,
      value: patch.value === undefined ? undefined : patch.value.toFixed(2),
    });

    await this.audit.record(context, {
      action: 'discount.updated',
      entityType: 'Discount',
      entityId: id,
      entityLabel: patch.name ?? existing.name,
      after: patch,
    });

    return this.requireDTO(context, id);
  }

  private async assertFeeItemsExist(schoolId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.feeItems.countExisting(schoolId, ids);
    if (found !== ids.length) {
      throw AppError.badRequest('One or more fee items could not be found.');
    }
  }

  private async requireDTO(context: RequestContext, id: string): Promise<DiscountDTO> {
    const dto = await this.discounts.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Discount');
    return dto;
  }
}
