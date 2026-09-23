import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Copy, Landmark, Percent, Plus, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { describeDiscountScope } from './discount-scope';
import {
  useDeleteFeeItems,
  useDeleteFeeStructure,
  useDeletePaymentDestination,
  useDiscounts,
  useFeeItems,
  useFeeStructures,
  useGenerateInvoices,
  usePaymentDestinations,
  useSaveDiscount,
  useSaveFeeItem,
  useSaveFeeStructure,
  useSavePaymentDestination,
} from './api';
import type { Discount, FeeItem, FeeStructure, PaymentDestination } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/data/pagination';
import { FilterBar } from '@/components/data/filter-bar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import {
  FeeItemDialog,
  DiscountDialog,
  FeeStructureDialog,
  GenerateInvoicesDialog,
  PaymentDestinationDialog,
  DuplicatePaymentDestinations,
} from './fees-page-parts';




type Tab = 'items' | 'structures' | 'discounts' | 'accounts';

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

  const feeItemsList = useListQuery({ namespace: 'items', defaultPageSize: 20 });
  const feeItems = useFeeItems(feeItemsList.query);
  // A discount's scope can name any fee item, not just whatever page of the
  // paginated list above happens to be showing — fetched separately so the
  // discounts tab can label a scoped discount correctly regardless.
  const allFeeItems = useFeeItems();
  const feeItemNameById = useMemo(
    () => new Map((allFeeItems.data?.items ?? []).map((item) => [item.id, item.name])),
    [allFeeItems.data],
  );
  const structures = useFeeStructures();
  const discounts = useDiscounts();
  const paymentDestinations = usePaymentDestinations();

  const saveFeeItem = useSaveFeeItem();
  const deleteFeeItems = useDeleteFeeItems();
  const saveDiscount = useSaveDiscount();
  const saveStructure = useSaveFeeStructure();
  const deleteStructure = useDeleteFeeStructure();
  const generateInvoices = useGenerateInvoices();
  const savePaymentDestination = useSavePaymentDestination();
  const deletePaymentDestination = useDeletePaymentDestination();

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: FeeItem }>({ open: false });
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pendingDeleteItems, setPendingDeleteItems] = useState<FeeItem[] | null>(null);
  const [discountDialog, setDiscountDialog] = useState<{ open: boolean; discount?: Discount }>({
    open: false,
  });
  const [structureDialog, setStructureDialog] = useState<{
    open: boolean;
    structure?: FeeStructure;
    mode?: 'edit' | 'duplicate';
  }>({ open: false });
  const [generateDialog, setGenerateDialog] = useState<{
    open: boolean;
    structure?: FeeStructure;
  }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<FeeStructure | null>(null);
  const [destinationDialog, setDestinationDialog] = useState<{
    open: boolean;
    destination?: PaymentDestination;
  }>({ open: false });
  const [pendingDeleteDestination, setPendingDeleteDestination] = useState<PaymentDestination | null>(
    null,
  );

  const currency = 'NGN';
  const canManage = can('fee.manage');
  /**
   * Billing is a separate permission from defining what the school charges: a
   * clerk may keep the fee list tidy without being able to raise four hundred
   * claims against families.
   */
  const canBill = can('invoice.manage');

  const newLabel =
    tab === 'discounts'
      ? 'New discount'
      : tab === 'structures'
        ? 'New fee structure'
        : tab === 'accounts'
          ? 'New payment account'
          : 'New fee item';

  const toggleItemSelected = (id: string) =>
    setSelectedItemIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const allItemIds = feeItems.data?.items.map((item) => item.id) ?? [];
  const allItemsSelected = allItemIds.length > 0 && allItemIds.every((id) => selectedItemIds.includes(id));
  const toggleAllItemsSelected = () => setSelectedItemIds(allItemsSelected ? [] : allItemIds);

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
              onClick={() => {
                if (tab === 'discounts') return setDiscountDialog({ open: true });
                if (tab === 'structures') return setStructureDialog({ open: true });
                if (tab === 'accounts') return setDestinationDialog({ open: true });
                return setItemDialog({ open: true });
              }}
            >
              <Plus />
              {newLabel}
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
            { id: 'accounts' as const, label: 'Payment accounts' },
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Fee items</CardTitle>
                <CardDescription>
                  The individual charges an invoice is built from. Optional items are only billed
                  to families who take them, such as transport or boarding.
                </CardDescription>
              </div>
              {canManage && selectedItemIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedItemIds.length} selected
                  </span>
                  <Button
                    data-cy="finance-fees-clear-selection"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItemIds([])}
                  >
                    Clear
                  </Button>
                  <Button
                    data-cy="finance-fees-delete-selected"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPendingDeleteItems(
                        (feeItems.data?.items ?? []).filter((item) => selectedItemIds.includes(item.id)),
                      )
                    }
                  >
                    <Trash2 />
                    Delete selected
                  </Button>
                </div>
              )}
            </div>
            <FilterBar
              search={feeItemsList.search}
              onSearchChange={feeItemsList.setSearch}
              searchPlaceholder="Search by name, code or description…"
              isSearching={feeItemsList.isSearchPending || feeItems.isFetching}
            />
          </CardHeader>
          <CardContent className="p-0">
            {feeItems.isPending ? (
              <LoadingState label="Loading fee items…" />
            ) : (feeItems.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Coins />}
                title={feeItemsList.search ? 'No fee items match your search' : 'No fee items yet'}
                description={
                  feeItemsList.search
                    ? 'Try a different name, code or description.'
                    : 'Start with tuition, then add transport, boarding and one-off charges.'
                }
              />
            ) : (
              <>
                {canManage && (
                  <label className="flex items-center gap-2 border-b border-border px-5 py-2 text-xs text-muted-foreground">
                    <input
                      data-cy="finance-fees-select-all"
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={allItemsSelected}
                      onChange={toggleAllItemsSelected}
                    />
                    Select all
                  </label>
                )}
                <ul className="divide-y divide-border">
                  {feeItems.data?.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      {canManage && (
                        <input
                          data-cy="finance-fees-select"
                          type="checkbox"
                          className="size-4 shrink-0 rounded border-input"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => toggleItemSelected(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {item.name}
                          {item.code && (
                            <span className="font-normal text-muted-foreground"> · {item.code}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.description ?? humanizeEnum(item.category)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{humanizeEnum(item.category)}</Badge>
                        {item.isOptional && <Badge tone="info">Optional</Badge>}
                        {item.isRecurring && <Badge tone="outline">Every term</Badge>}
                        {item.hasQuantity && <Badge tone="outline">By quantity</Badge>}
                        {item.priceOptions.length > 0 && (
                          <Badge tone="outline">
                            +{item.priceOptions.length} price{item.priceOptions.length === 1 ? '' : 's'}
                          </Badge>
                        )}
                        {!item.isActive && <Badge tone="warning">Inactive</Badge>}
                      </div>
                      <span className="w-28 shrink-0 text-right font-medium tabular-nums">
                        {formatCurrency(item.amount, currency, { showDecimals: false })}
                      </span>
                      {canManage && (
                        <>
                          <Button
                            data-cy="finance-fees-edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => setItemDialog({ open: true, item })}
                          >
                            Edit
                          </Button>
                          <Button
                            data-cy="finance-fees-delete"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeleteItems([item])}
                          >
                            <Trash2 />
                            Delete
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {feeItems.data?.meta && (
                  <Pagination
                    meta={feeItems.data.meta}
                    onPageChange={feeItemsList.setPage}
                    onPageSizeChange={feeItemsList.setPageSize}
                    isFetching={feeItems.isFetching}
                  />
                )}
              </>
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
                      <Button
                        data-cy="finance-structure-print"
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/finance/fee-structures/${structure.id}/print`}>
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            data-cy="finance-structure-duplicate"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setStructureDialog({
                                open: true,
                                structure: { ...structure, name: `Copy of ${structure.name}` },
                                mode: 'duplicate',
                              })
                            }
                          >
                            <Copy />
                            Duplicate
                          </Button>
                          <Button
                            data-cy="finance-structure-edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => setStructureDialog({ open: true, structure, mode: 'edit' })}
                          >
                            Edit
                          </Button>
                          <Button
                            data-cy="finance-structure-delete"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDelete(structure)}
                          >
                            <Trash2 />
                            Delete
                          </Button>
                        </>
                      )}
                      {canBill && structure.isActive && (
                        <Button
                          data-cy="finance-structure-generate"
                          variant="outline"
                          size="sm"
                          onClick={() => setGenerateDialog({ open: true, structure })}
                        >
                          <ReceiptText />
                          Generate invoices
                        </Button>
                      )}
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
                      <p className="truncate text-xs text-muted-foreground">
                        Applies to {describeDiscountScope(discount, feeItemNameById)}
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

      {tab === 'accounts' && (
        <>
          <DuplicatePaymentDestinations />
          <Card>
            <CardHeader>
              <CardTitle>Payment accounts</CardTitle>
              <CardDescription>
                The school's own bank accounts, kept in one place. A fee item or a custom bill picks
                from this list rather than owning its own copy, so editing an account here updates it
                everywhere it is picked — a bill already issued keeps the details it was raised
                under.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {paymentDestinations.isPending ? (
                <LoadingState label="Loading payment accounts…" />
              ) : (paymentDestinations.data?.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={<Landmark />}
                  title="No payment accounts yet"
                  description="Add the school's bank accounts here, then pick from them on a fee item or a custom bill."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {paymentDestinations.data?.map((destination) => (
                    <li key={destination.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {destination.label || destination.bankName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {destination.bankName} · {destination.accountNumber} ·{' '}
                          {destination.accountName}
                        </p>
                      </div>
                      {canManage && (
                        <>
                          <Button
                            data-cy="finance-destination-edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDestinationDialog({ open: true, destination })}
                          >
                            Edit
                          </Button>
                          <Button
                            data-cy="finance-destination-delete"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeleteDestination(destination)}
                          >
                            <Trash2 />
                            Delete
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
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

      <ConfirmDialog
        open={Boolean(pendingDeleteItems)}
        onOpenChange={(open) => !open && setPendingDeleteItems(null)}
        title={
          pendingDeleteItems && pendingDeleteItems.length > 1
            ? `Delete ${pendingDeleteItems.length} fee items?`
            : 'Delete this fee item?'
        }
        description={
          pendingDeleteItems && pendingDeleteItems.length > 1
            ? `"${pendingDeleteItems.map((item) => item.name).join('", "')}" will be removed from this list. Invoices already raised with any of these charges keep them exactly as billed.`
            : `"${pendingDeleteItems?.[0]?.name}" will be removed from this list. Invoices already raised with this charge keep it exactly as billed.`
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteFeeItems.isPending}
        onConfirm={async () => {
          if (pendingDeleteItems) {
            await deleteFeeItems.mutateAsync(pendingDeleteItems.map((item) => item.id));
            setSelectedItemIds([]);
          }
          setPendingDeleteItems(null);
        }}
      />

      <FeeStructureDialog
        key={
          structureDialog.mode === 'duplicate'
            ? `duplicate-${structureDialog.structure?.id}`
            : (structureDialog.structure?.id ?? 'new-structure')
        }
        state={structureDialog}
        onOpenChange={(open) => setStructureDialog({ open })}
        onSave={(values) =>
          saveStructure
            .mutateAsync({
              // A duplicate always creates, whatever id it was prefilled from.
              id: structureDialog.mode === 'duplicate' ? undefined : structureDialog.structure?.id,
              values,
            })
            .then(() => setStructureDialog({ open: false }))
        }
        saving={saveStructure.isPending}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this fee structure?"
        description={`"${pendingDelete?.name}" will be permanently removed. This is refused if it has already been used to generate any invoices — turn it off instead of deleting one of those.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteStructure.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteStructure.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <GenerateInvoicesDialog
        key={generateDialog.structure?.id ?? 'generate'}
        state={generateDialog}
        onOpenChange={(open) => setGenerateDialog({ open })}
        onConfirm={(input) =>
          generateInvoices
            .mutateAsync({ id: generateDialog.structure!.id, input })
            .then(() => setGenerateDialog({ open: false }))
        }
        saving={generateInvoices.isPending}
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

      <PaymentDestinationDialog
        key={destinationDialog.destination?.id ?? 'new-destination'}
        state={destinationDialog}
        onOpenChange={(open) => setDestinationDialog({ open })}
        onSave={(values) =>
          savePaymentDestination
            .mutateAsync({ id: destinationDialog.destination?.id, values })
            .then(() => setDestinationDialog({ open: false }))
        }
        saving={savePaymentDestination.isPending}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteDestination)}
        onOpenChange={(open) => !open && setPendingDeleteDestination(null)}
        title="Delete this payment account?"
        description={`"${pendingDeleteDestination?.label || pendingDeleteDestination?.bankName}" will be removed. Any fee item or custom bill that pointed at it simply shows one fewer account from now on — a bill already issued keeps the details it was raised under.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletePaymentDestination.isPending}
        onConfirm={async () => {
          if (pendingDeleteDestination) {
            await deletePaymentDestination.mutateAsync(pendingDeleteDestination.id);
          }
          setPendingDeleteDestination(null);
        }}
      />
    </PageContainer>
  );
}
