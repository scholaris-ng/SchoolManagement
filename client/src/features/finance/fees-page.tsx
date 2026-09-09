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
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';

const CATEGORIES = ['TUITION', 'TRANSPORT', 'BOARDING', 'UNIFORM', 'EXAM', 'DEVELOPMENT', 'OTHER'];
const DISCOUNT_TYPES = ['SIBLING', 'STAFF_CHILD', 'SCHOLARSHIP', 'EARLY_PAYMENT', 'OTHER'];

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
                ? 'text-primary after:bg-primary'
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

function FeeItemDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  state: { open: boolean; item?: FeeItem };
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<FeeItem>) => Promise<unknown>;
  saving: boolean;
}) {
  const [name, setName] = useState(state.item?.name ?? '');
  const [code, setCode] = useState(state.item?.code ?? '');
  const [amount, setAmount] = useState(String(state.item?.amount ?? ''));
  const [category, setCategory] = useState(state.item?.category ?? 'TUITION');
  const [description, setDescription] = useState(state.item?.description ?? '');
  const [isOptional, setIsOptional] = useState(state.item?.isOptional ?? false);
  const [isRecurring, setIsRecurring] = useState(state.item?.isRecurring ?? true);
  const [isActive, setIsActive] = useState(state.item?.isActive ?? true);

  const valid = name.trim() && code.trim() && Number(amount) > 0;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.item ? 'Edit fee item' : 'New fee item'}</DialogTitle>
          <DialogDescription>
            Changing an amount affects invoices issued from now on — invoices already sent keep the
            amount they were billed at.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fee-name" required>
              Name
            </Label>
            <Input
              data-cy="fee-name"
              id="fee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Tuition"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-code" required>
              Code
            </Label>
            <Input data-cy="fee-code" id="fee-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-amount" required>
              Amount
            </Label>
            <Input
              data-cy="fee-amount"
              id="fee-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-category">Category</Label>
            <NativeSelect
              data-cy="fee-category"
              id="fee-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as FeeItem['category'])}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fee-description">Description</Label>
            <Textarea
              data-cy="fee-description"
              id="fee-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="sr-only">Fee item options</legend>
            <Toggle
              label="Optional charge"
              description="Only billed to families who opt in, such as the school bus."
              checked={isOptional}
              onChange={setIsOptional}
            />
            <Toggle
              label="Charged every term"
              checked={isRecurring}
              onChange={setIsRecurring}
            />
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="finance-fees-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="finance-fees-save"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                amount: Number(amount),
                category: category as FeeItem['category'],
                description: description.trim() || null,
                isOptional,
                isRecurring,
                isActive,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscountDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  state: { open: boolean; discount?: Discount };
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<Discount>) => Promise<unknown>;
  saving: boolean;
}) {
  const [name, setName] = useState(state.discount?.name ?? '');
  const [type, setType] = useState(state.discount?.type ?? 'SIBLING');
  const [mode, setMode] = useState(state.discount?.mode ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(state.discount?.value ?? ''));
  const [description, setDescription] = useState(state.discount?.description ?? '');
  const [isActive, setIsActive] = useState(state.discount?.isActive ?? true);

  const valid = name.trim() && Number(value) > 0;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.discount ? 'Edit discount' : 'New discount'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="discount-name" required>
              Name
            </Label>
            <Input
              data-cy="discount-name"
              id="discount-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Second child"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-type">Type</Label>
            <NativeSelect
              data-cy="discount-type"
              id="discount-type"
              value={type}
              onChange={(event) => setType(event.target.value as Discount['type'])}
            >
              {DISCOUNT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {humanizeEnum(option)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-mode">Applied as</Label>
            <NativeSelect
              data-cy="discount-mode"
              id="discount-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as Discount['mode'])}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-value" required>
              {mode === 'PERCENTAGE' ? 'Percentage' : 'Amount'}
            </Label>
            <Input
              data-cy="discount-value"
              id="discount-value"
              type="number"
              min={0}
              max={mode === 'PERCENTAGE' ? 100 : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="discount-description">Description</Label>
            <Textarea
              data-cy="discount-description"
              id="discount-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="finance-fees-cancel-2" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="finance-fees-save-2"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                name: name.trim(),
                type: type as Discount['type'],
                mode: mode as Discount['mode'],
                value: Number(value),
                description: description.trim() || null,
                isActive,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        data-cy="finance-fees-checked"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 rounded border-input"
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
