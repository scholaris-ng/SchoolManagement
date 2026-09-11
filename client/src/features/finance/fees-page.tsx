import { useState } from 'react';
import { Coins, Percent, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useDiscounts, useFeeItems, useFeeStructures, useSaveDiscount, useSaveFeeItem } from './api';
import type { Discount, FeeItem } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { FeeItemDialog, DiscountDialog } from './fees-page-parts';




type Tab = 'items' | 'structures' | 'discounts';

/**
 * What the school charges — kept strictly separate from what any family owes.
 *
 * Editing a fee item changes future invoices only; invoices already issued are
 * a record of what was billed at the time and are never rewritten underneath a
 * parent (spec section 26).
 */
export function FeesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('items');

  const feeItems = useFeeItems();
  const structures = useFeeStructures();
  const discounts = useDiscounts();

  const saveFeeItem = useSaveFeeItem();
  const saveDiscount = useSaveDiscount();

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: FeeItem }>({ open: false });
  const [discountDialog, setDiscountDialog] = useState<{ open: boolean; discount?: Discount }>({
    open: false,
  });

  const currency = 'NGN';
  const canManage = can('fee.manage');

  return (
    <PageContainer>
      <PageHeader
        title="Fees"
        description="Fee items, the structures that group them, and the discounts a school offers."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fees' }]}
        actions={
          canManage && (
            <Button
              data-cy="fees-new-item"
              onClick={() =>
                tab === 'discounts'
                  ? setDiscountDialog({ open: true })
                  : setItemDialog({ open: true })
              }
            >
              <Plus />
              {tab === 'discounts' ? 'New discount' : 'New fee item'}
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Fee configuration" className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { id: 'items' as const, label: 'Fee items' },
            { id: 'structures' as const, label: 'Fee structures' },
            { id: 'discounts' as const, label: 'Discounts' },
          ]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            data-cy={`fees-tab-${option.id}`}
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
              tab === option.id
                ? // White in dark mode, matching the sidebar's active item —
                  // see the identical note in `tab-strip.tsx`.
                  'text-primary after:bg-primary dark:text-white'
                : 'text-muted-foreground after:bg-transparent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <Card>
          <CardHeader>
            <CardTitle>Fee items</CardTitle>
            <CardDescription>
              The individual charges an invoice is built from. Optional items are only billed to
              families who take them, such as transport or boarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {feeItems.isPending ? (
              <LoadingState label="Loading fee items…" />
            ) : (feeItems.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Coins />}
                title="No fee items yet"
                description="Start with tuition, then add transport, boarding and one-off charges."
              />
            ) : (
              <ul className="divide-y divide-border">
                {feeItems.data?.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.name}
                        <span className="font-normal text-muted-foreground"> · {item.code}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.description ?? humanizeEnum(item.category)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{humanizeEnum(item.category)}</Badge>
                      {item.isOptional && <Badge tone="info">Optional</Badge>}
                      {item.isRecurring && <Badge tone="outline">Every term</Badge>}
                      {!item.isActive && <Badge tone="warning">Inactive</Badge>}
                    </div>
                    <span className="w-28 shrink-0 text-right font-medium tabular-nums">
                      {formatCurrency(item.amount, currency, { showDecimals: false })}
                    </span>
                    {canManage && (
                      <Button
                        data-cy="finance-fees-edit"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemDialog({ open: true, item })}
                      >
                        Edit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'structures' && (
        <Card>
          <CardHeader>
            <CardTitle>Fee structures</CardTitle>
            <CardDescription>
              A bundle of fee items applied to particular levels or classes for one term, which is
              what invoices are generated from.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {structures.isPending ? (
              <LoadingState label="Loading structures…" />
            ) : (structures.data?.items.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Coins />} title="No fee structures yet" />
            ) : (
              <ul className="divide-y divide-border">
                {structures.data?.items.map((structure) => (
                  <li key={structure.id} className="space-y-2 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{structure.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {structure.sessionName}
                          {structure.termName ? ` · ${structure.termName}` : ''} ·{' '}
                          {structure.levelNames.join(', ') || 'All levels'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium tabular-nums">
                          {formatCurrency(structure.mandatoryTotal, currency, { showDecimals: false })}
                        </p>
                        {structure.optionalTotal > 0 && (
                          <p className="text-xs text-muted-foreground">
                            + {formatCurrency(structure.optionalTotal, currency, { showDecimals: false })}{' '}
                            optional
                          </p>
                        )}
                      </div>
                      {!structure.isActive && <Badge tone="warning">Inactive</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {structure.lines.map((line) => (
                        <Badge key={line.id} tone={line.isOptional ? 'info' : 'neutral'}>
                          {line.feeItemName} ·{' '}
                          {formatCurrency(line.amount, currency, { compact: true })}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'discounts' && (
        <Card>
          <CardHeader>
            <CardTitle>Discounts and scholarships</CardTitle>
            <CardDescription>
              Sibling reductions, staff-child concessions and scholarships. Applying one to a
              student is recorded against their invoice, so the reason for a reduced bill is never
              lost.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {discounts.isPending ? (
              <LoadingState label="Loading discounts…" />
            ) : (discounts.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Percent />} title="No discounts configured" />
            ) : (
              <ul className="divide-y divide-border">
                {discounts.data?.map((discount) => (
                  <li key={discount.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{discount.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {discount.description ?? humanizeEnum(discount.type)}
                      </p>
                    </div>
                    <Badge tone="neutral">{humanizeEnum(discount.type)}</Badge>
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                      {discount.mode === 'PERCENTAGE'
                        ? `${discount.value}%`
                        : formatCurrency(discount.value, currency, { showDecimals: false })}
                    </span>
                    {canManage && (
                      <Button
                        data-cy="finance-fees-edit-2"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDiscountDialog({ open: true, discount })}
                      >
                        Edit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <FeeItemDialog
        key={itemDialog.item?.id ?? 'new-item'}
        state={itemDialog}
        onOpenChange={(open) => setItemDialog({ open })}
        onSave={(values) =>
          saveFeeItem
            .mutateAsync({ id: itemDialog.item?.id, values })
            .then(() => setItemDialog({ open: false }))
        }
        saving={saveFeeItem.isPending}
      />

      <DiscountDialog
        key={discountDialog.discount?.id ?? 'new-discount'}
        state={discountDialog}
        onOpenChange={(open) => setDiscountDialog({ open })}
        onSave={(values) =>
          saveDiscount
            .mutateAsync({ id: discountDialog.discount?.id, values })
            .then(() => setDiscountDialog({ open: false }))
        }
        saving={saveDiscount.isPending}
      />
    </PageContainer>
  );
}
