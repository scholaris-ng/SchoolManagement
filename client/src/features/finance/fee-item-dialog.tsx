import { useState } from 'react';
import { Clipboard, ClipboardPaste } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { Toggle } from './fees-page-parts';
import type { FeeItem } from '@/types/finance';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/feedback';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORIES } from './fees-page-constants';

/**
 * Marks clipboard text as one fee item's payment account rather than
 * whatever else a bursar might have copied — pasting a stray line of text
 * into three bank-detail fields silently would be worse than doing nothing.
 */
const PAYMENT_ACCOUNT_CLIPBOARD_KIND = 'scholaris.feeItemPaymentAccount';

interface PaymentAccountDraft {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/**
 * Pieces used by `fees-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function FeeItemDialog({
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
  const [bankName, setBankName] = useState(state.item?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(state.item?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(state.item?.accountName ?? '');

  const valid = name.trim() && code.trim() && Number(amount) > 0;
  const hasPaymentAccount = Boolean(bankName.trim() || accountNumber.trim() || accountName.trim());

  const copyPaymentAccount = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({
          kind: PAYMENT_ACCOUNT_CLIPBOARD_KIND,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        }),
      );
      toast.success('Payment account copied', {
        description: 'Paste it into another fee item from its own dialog.',
      });
    } catch {
      toast.error('Could not copy', { description: 'The browser refused clipboard access.' });
    }
  };

  const pastePaymentAccount = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text) as Partial<PaymentAccountDraft> & { kind?: string };
      if (data.kind !== PAYMENT_ACCOUNT_CLIPBOARD_KIND) throw new Error('not a payment account');
      setBankName(data.bankName ?? '');
      setAccountNumber(data.accountNumber ?? '');
      setAccountName(data.accountName ?? '');
      toast.success('Payment account pasted');
    } catch {
      toast.error('Nothing to paste', {
        description: 'Copy a payment account from another fee item first.',
      });
    }
  };

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
          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 sm:col-span-3">
              <span className="text-sm font-medium">
                Payment account
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional — shown on invoices so families know where to pay this charge)
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Tooltip content="Copy these account details">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!hasPaymentAccount}
                    onClick={() => void copyPaymentAccount()}
                    aria-label="Copy payment account"
                  >
                    <Clipboard />
                  </Button>
                </Tooltip>
                <Tooltip content="Paste account details copied from another fee item">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void pastePaymentAccount()}
                    aria-label="Paste payment account"
                  >
                    <ClipboardPaste />
                  </Button>
                </Tooltip>
              </span>
            </legend>
            <div className="space-y-1.5">
              <Label htmlFor="fee-bank-name">Bank name</Label>
              <Input
                data-cy="fee-bank-name"
                id="fee-bank-name"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                placeholder="e.g. GTBank"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-account-number">Account number</Label>
              <Input
                data-cy="fee-account-number"
                id="fee-account-number"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-account-name">Account name</Label>
              <Input
                data-cy="fee-account-name"
                id="fee-account-name"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
              />
            </div>
          </fieldset>
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
                bankName: bankName.trim() || null,
                accountNumber: accountNumber.trim() || null,
                accountName: accountName.trim() || null,
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
