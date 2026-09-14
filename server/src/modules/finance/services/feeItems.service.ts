import { AppError } from '../../../shared/errors/AppError';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { RequestContext } from '../../../shared/types/context';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import type { FeeItemDTO } from '../dto/finance.dto';
import type {
  BulkDeleteFeeItemsInput,
  CreateFeeItemInput,
  UpdateFeeItemInput,
} from '../validators/feeItems.schema';
import type { FeeCategory } from '../entities/feeItem.entity';

/**
 * What a school charges for.
 *
 * Fee items are definitions, not money that has moved. An invoice built from
 * one copies its name and amount rather than pointing at it, so editing an
 * amount here changes what is billed from now on and never rewrites a bill a
 * parent is already holding (spec section 26).
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

    const created = await AppDataSource.transaction(async (manager) => {
      const item = await this.feeItems.create(
        {
          schoolId: context.schoolId,
          name: input.name,
          code: input.code,
          description: input.description ?? null,
          amount: input.amount.toFixed(2),
          category: input.category as FeeCategory,
          isOptional: input.isOptional,
          isRecurring: input.isRecurring,
          isActive: input.isActive,
        },
        manager,
      );
      if (input.accounts) {
        await this.feeItems.replaceAccounts(context.schoolId, item.id, input.accounts, manager);
      }
      return item;
    });

    await this.audit.record(context, {
      action: 'feeItem.created',
      entityType: 'FeeItem',
      entityId: created.id,
      entityLabel: `${created.name} (${created.code})`,
      after: {
        code: created.code,
        amount: created.amount,
        category: created.category,
        accounts: input.accounts?.length ?? 0,
      },
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

    const { accounts, ...fields } = patch;

    await AppDataSource.transaction(async (manager) => {
      await this.feeItems.update(
        id,
        {
          ...fields,
          amount: fields.amount === undefined ? undefined : fields.amount.toFixed(2),
          category: fields.category as FeeCategory | undefined,
        },
        manager,
      );
      // Omitted means "leave the accounts as they are" — present, even `[]`,
      // replaces the whole set, the same as a fee structure's `lines`.
      if (accounts !== undefined) {
        await this.feeItems.replaceAccounts(context.schoolId, id, accounts, manager);
      }
    });

    await this.audit.record(context, {
      action: 'feeItem.updated',
      entityType: 'FeeItem',
      entityId: id,
      entityLabel: `${patch.name ?? existing.name} (${patch.code ?? existing.code})`,
      after: { ...fields, accounts: accounts?.length },
    });

    return this.requireDTO(context, id);
  }

  /**
   * A soft delete, never a hard one: `invoice_lines` already snapshots the
   * name, category and amount at issue time (spec section 26), so an item
   * used on a real bill is never actually read back through here again —
   * removing it from the list a bursar picks from is all this needs to do,
   * and it stays reversible if that turns out to be a mistake.
   */
  async removeMany(context: RequestContext, input: BulkDeleteFeeItemsInput): Promise<void> {
    const found = await this.feeItems.countExisting(context.schoolId, input.ids);
    if (found !== input.ids.length) {
      throw AppError.notFound('Fee item');
    }

    await this.feeItems.softDeleteMany(context.schoolId, input.ids);

    await this.audit.record(context, {
      action: 'feeItem.deleted',
      entityType: 'FeeItem',
      entityId: input.ids[0],
      entityLabel: `${input.ids.length} fee item${input.ids.length === 1 ? '' : 's'}`,
      after: { ids: input.ids },
    });
  }

  private async requireDTO(context: RequestContext, id: string): Promise<FeeItemDTO> {
    const dto = await this.feeItems.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Fee item');
    return dto;
  }
}
