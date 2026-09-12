import { useState } from 'react';
import { toDateInputValue } from '@/lib/format';
import { useTerms } from '@/features/academics/api';
import type { FeeStructure } from '@/types/finance';
import type { GenerateInvoicesInput } from './finance.endpoints';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** A month is the usual grace a Nigerian school gives on a term's fees. */
const DEFAULT_DUE_DAYS = 30;

/**
 * The confirmation before billing a cohort.
 *
 * Deliberately a dialog of its own rather than the shared `ConfirmDialog`:
 * this needs two answers, not a yes. The due date is the one every invoice in
 * the run carries, and a structure written for "any term" has to be told which
 * term it is billing — there is no safe default for that, and guessing the
 * current term would let a mis-set calendar bill the wrong one silently.
 *
 * Running it twice is harmless, which the copy says so nobody has to find out
 * by trying.
 */
export function GenerateInvoicesDialog({
  state,
  onOpenChange,
  onConfirm,
  saving,
}: {
  state: { open: boolean; structure?: FeeStructure };
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: GenerateInvoicesInput) => Promise<unknown>;
  saving: boolean;
}) {
  const structure = state.structure;
  const terms = useTerms(structure?.sessionId);

  const [dueDate, setDueDate] = useState(
    toDateInputValue(new Date(Date.now() + DEFAULT_DUE_DAYS * 86_400_000)),
  );
  const [termId, setTermId] = useState('');

  const needsTerm = Boolean(structure && !structure.termId);
  const valid = Boolean(dueDate) && (!needsTerm || Boolean(termId));

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Generate invoices</DialogTitle>
          <DialogDescription>
            {structure
              ? `One invoice per pupil covered by “${structure.name}”. Anyone already billed for this term is skipped, so running it again is safe.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {needsTerm && (
            <div className="space-y-1.5">
              <Label htmlFor="generate-term" required>
                Term
              </Label>
              <NativeSelect
                data-cy="generate-term"
                id="generate-term"
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
              >
                <option value="">Choose a term</option>
                {(terms.data ?? []).map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                This structure applies to any term, so say which one you are billing.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="generate-due-date" required>
              Due date
            </Label>
            <Input
              data-cy="generate-due-date"
              id="generate-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <Alert tone="info">
            Any balance a family still owes from an earlier term is carried onto the new invoice,
            and the older bill is closed against it.
          </Alert>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="generate-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="generate-confirm"
            loading={saving}
            disabled={!valid}
            onClick={() => void onConfirm({ dueDate, termId: termId || undefined })}
          >
            Generate invoices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
