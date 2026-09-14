import { useState } from 'react';
import { Clipboard, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { Toggle } from './fees-page-parts';
import type { FeeItem } from '@/types/finance';
import type { FeeItemInput } from './finance.endpoints';
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
 * Marks clipboard text as one fee item's payment accounts rather than
 * whatever else a bursar might have copied — pasting a stray bit of text
 * into a run of bank-detail fields silently would be worse than doing nothing.
 */
const PAYMENT_ACCOUNTS_CLIPBOARD_KIND = 'scholaris.feeItemPaymentAccounts';

interface AccountDraft {
  label: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

const BLANK_ACCOUNT: AccountDraft = { label: '', bankName: '', accountNumber: '', accountName: '' };

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
  onSave: (values: Partial<FeeItemInput>) => Promise<unknown>;
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
  const [accounts, setAccounts] = useState<AccountDraft[]>(
    (state.item?.accounts ?? []).map((account) => ({
      label: account.label ?? '',
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
    })),
  );

  const valid = name.trim() && code.trim() && Number(amount) > 0;

  const addAccount = () => setAccounts((current) => [...current, { ...BLANK_ACCOUNT }]);
  const removeAccount = (index: number) =>
    setAccounts((current) => current.filter((_, position) => position !== index));
  const patchAccount = (index: number, patch: Partial<AccountDraft>) =>
    setAccounts((current) =>
      current.map((account, position) => (position === index ? { ...account, ...patch } : account)),
    );

  const copyPaymentAccounts = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ kind: PAYMENT_ACCOUNTS_CLIPBOARD_KIND, accounts }),
      );
      toast.success(`${accounts.length} payment account${accounts.length === 1 ? '' : 's'} copied`, {
        description: 'Paste into another fee item from its own dialog.',
      });
    } catch {
      toast.error('Could not copy', { description: 'The browser refused clipboard access.' });
    }
  };

  const pastePaymentAccounts = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text) as { kind?: string; accounts?: Partial<AccountDraft>[] };
      if (data.kind !== PAYMENT_ACCOUNTS_CLIPBOARD_KIND || !Array.isArray(data.accounts)) {
        throw new Error('not payment accounts');
      }
      setAccounts(
        data.accounts.map((account) => ({
          label: account.label ?? '',
          bankName: account.bankName ?? '',
          accountNumber: account.accountNumber ?? '',
          accountName: account.accountName ?? '',
        })),
      );
      toast.success('Payment accounts pasted');
    } catch {
      toast.error('Nothing to paste', {
        description: 'Copy payment accounts from another fee item first.',
      });
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
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

          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Payment accounts
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional — shown on invoices so families know where to pay this charge)
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Tooltip content="Copy these accounts">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={accounts.length === 0}
                    onClick={() => void copyPaymentAccounts()}
                    aria-label="Copy payment accounts"
                  >
                    <Clipboard />
                  </Button>
                </Tooltip>
                <Tooltip content="Paste accounts copied from another fee item">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void pastePaymentAccounts()}
                    aria-label="Paste payment accounts"
                  >
                    <ClipboardPaste />
                  </Button>
                </Tooltip>
              </span>
            </legend>

            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment accounts added yet.</p>
            ) : (
              <ul className="space-y-3">
                {accounts.map((account, index) => (
                  <li key={index} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={`account-label-${index}`}>Label</Label>
                        <Input
                          data-cy="fee-account-label"
                          id={`account-label-${index}`}
                          value={account.label}
                          onChange={(event) => patchAccount(index, { label: event.target.value })}
                          placeholder="e.g. Main account, PTA account"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6"
                        onClick={() => removeAccount(index)}
                        aria-label={`Remove ${account.label || `account ${index + 1}`}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`account-bank-${index}`} required>
                          Bank name
                        </Label>
                        <Input
                          data-cy="fee-bank-name"
                          id={`account-bank-${index}`}
                          value={account.bankName}
                          onChange={(event) => patchAccount(index, { bankName: event.target.value })}
                          placeholder="e.g. GTBank"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`account-number-${index}`} required>
                          Account number
                        </Label>
                        <Input
                          data-cy="fee-account-number"
                          id={`account-number-${index}`}
                          value={account.accountNumber}
                          onChange={(event) => patchAccount(index, { accountNumber: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`account-name-${index}`} required>
                          Account name
                        </Label>
                        <Input
                          data-cy="fee-account-name"
                          id={`account-name-${index}`}
                          value={account.accountName}
                          onChange={(event) => patchAccount(index, { accountName: event.target.value })}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addAccount}>
              <Plus />
              Add account
            </Button>
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
                // Rows missing a bank name, number or account name are
                // dropped rather than blocking save — a bursar who added a
                // second row and changed their mind should not have to
                // delete it by hand first.
                accounts: accounts
                  .filter((account) => account.bankName.trim() && account.accountNumber.trim() && account.accountName.trim())
                  .map((account) => ({
                    label: account.label.trim() || null,
                    bankName: account.bankName.trim(),
                    accountNumber: account.accountNumber.trim(),
                    accountName: account.accountName.trim(),
                  })),
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
