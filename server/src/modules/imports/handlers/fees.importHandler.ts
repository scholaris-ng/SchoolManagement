import type { EntityManager } from 'typeorm';
import type { RequestContext } from '../../../shared/types/context';
import { FeeItemRepository } from '../../finance/repositories/feeItem.repository';
import { FEE_CATEGORIES, type FeeCategory } from '../../finance/entities/feeItem.entity';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { normaliseSpacing, parseBooleanCell } from '../utils/cells';

interface FeeLookups {
  existingByCode: Map<string, { id: string }>;
}

/** Strips the grouping and currency marks a school may have typed: "₦85,000.00". */
function parseAmount(raw: string | undefined): number | null {
  const cleaned = (raw ?? '').replace(/[^\d.-]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function parseCategory(raw: string | undefined): FeeCategory | null {
  const text = (raw ?? '').trim().toUpperCase();
  return (FEE_CATEGORIES as readonly string[]).includes(text) ? (text as FeeCategory) : null;
}

/** Fee items: code is the key, amount and category are required and strict. */
export class FeesImportHandler implements ImportEntityHandler<FeeLookups> {
  readonly entity = 'FEES' as const;
  readonly naturalKeyField = 'code';
  readonly naturalKeyLabel = 'fee code';

  private readonly feeItems = FeeItemRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.code?.trim().toUpperCase() || null;
  }

  async prepare(
    context: RequestContext,
    rows: MappedRow[],
    manager?: EntityManager,
  ): Promise<FeeLookups> {
    const codes = rows.map((row) => this.naturalKey(row)).filter((code): code is string => Boolean(code));
    const existing = await this.feeItems.findManyByCode(context.schoolId, codes, manager);
    return { existingByCode: new Map(existing.map((row) => [row.code.toUpperCase(), { id: row.id }])) };
  }

  async check({ rowNumber, row, lookups }: RowContext<FeeLookups>): Promise<RowCheck> {
    const issues = [];
    const name = normaliseSpacing(row.name ?? '');
    const code = (row.code ?? '').trim().toUpperCase();

    if (!name) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A fee name is required.', 'name'));
    if (!code) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A fee code is required.', 'code'));
    if (code.length > 20) {
      issues.push(issue(rowNumber, 'ERROR', 'TOO_LONG', 'A fee code can be at most 20 characters.', 'code', code));
    }

    const amount = parseAmount(row.amount);
    if (amount === null) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_AMOUNT', 'Enter the amount as a number.', 'amount', row.amount));
    } else if (amount < 0) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_AMOUNT', 'An amount cannot be negative.', 'amount', row.amount));
    }

    // Required, so an unreadable value cannot quietly fall back to a default —
    // guessing which fee bucket a charge belongs in is not ours to do.
    const category = parseCategory(row.category);
    if (!category) {
      issues.push(
        issue(
          rowNumber,
          'ERROR',
          'INVALID_CATEGORY',
          `Use one of: ${FEE_CATEGORIES.join(', ')}.`,
          'category',
          row.category,
        ),
      );
    }

    const optional = parseBooleanCell(row.isOptional, false);
    if (optional.warning) {
      issues.push(issue(rowNumber, 'WARNING', 'UNREADABLE_BOOLEAN', optional.warning, 'isOptional', row.isOptional));
    }

    return {
      issues,
      willUpdate: Boolean(code && lookups.existingByCode.has(code)),
      // Every column the template offers appears here: the wizard draws one
      // cell per mapped column, so anything left out reads as blank to a
      // school checking its file.
      preview: {
        name,
        code,
        amount: amount === null ? '' : amount.toFixed(2),
        category: category ?? '',
        isOptional: optional.value ? 'TRUE' : 'FALSE',
        description: normaliseSpacing(row.description ?? ''),
      },
    };
  }

  async apply({ context, row, lookups, manager }: RowContext<FeeLookups>): Promise<'CREATED' | 'UPDATED'> {
    const name = normaliseSpacing(row.name);
    const code = row.code.trim().toUpperCase();
    const amount = (parseAmount(row.amount) ?? 0).toFixed(2);
    const category = parseCategory(row.category) as FeeCategory;
    const isOptional = parseBooleanCell(row.isOptional, false).value;
    const description = normaliseSpacing(row.description ?? '') || null;

    const existing = lookups.existingByCode.get(code);
    if (existing) {
      await this.feeItems.update(existing.id, { name, amount, category, isOptional, description }, manager);
      return 'UPDATED';
    }

    const created = await this.feeItems.create(
      {
        schoolId: context.schoolId,
        name,
        code,
        amount,
        category,
        isOptional,
        description,
        isRecurring: true,
        isActive: true,
      },
      manager,
    );
    // Keeps a code repeated later in the same file an update, not a second insert.
    lookups.existingByCode.set(code, { id: created.id });
    return 'CREATED';
  }
}
