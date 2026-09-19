import { useMemo, useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { useCurrentTerm, useTerms } from '@/features/academics/api';
import { useDiscounts, useGrantStudentDiscount } from './api';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { FormError } from '@/components/forms/form-actions';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { describeDiscountValue } from './discount-scope';

/** One select carries the whole scope: `ALWAYS`, `session:<id>` or `term:<id>`. */
const ALWAYS = 'ALWAYS';

export function GrantDiscountDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: {
  studentId: string;
  studentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const discounts = useDiscounts();
  const terms = useTerms();
  const currentTerm = useCurrentTerm();
  const grant = useGrantStudentDiscount(studentId);

  const [discountId, setDiscountId] = useState('');
  const [scope, setScope] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const active = useMemo(
    () => (discounts.data ?? []).filter((discount) => discount.isActive),
    [discounts.data],
  );
  const sessions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const term of terms.data ?? []) seen.set(term.sessionId, term.sessionName);
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [terms.data]);

  // The safest default is the term being billed now: a discount left running
  // by accident quietly under-bills a family for years.
  const effectiveScope = scope ?? (currentTerm.data ? `term:${currentTerm.data.id}` : ALWAYS);
  const picked = active.find((discount) => discount.id === discountId);

  const submit = async () => {
    const [kind, id] = effectiveScope.split(':');
    await grant.mutateAsync({
      discountId,
      termId: kind === 'term' ? id : null,
      sessionId: kind === 'session' ? id : null,
      note: note.trim() || null,
    });
    setDiscountId('');
    setScope(null);
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Grant a discount</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} will` : 'This student will'} get it automatically on
            every invoice raised while it applies. Invoices already issued are not changed.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FormError error={grant.error} />

          <div className="space-y-1.5">
            <Label htmlFor="grant-discount" required>
              Discount
            </Label>
            <NativeSelect
              data-cy="grant-discount-id"
              id="grant-discount"
              value={discountId}
              onChange={(event) => setDiscountId(event.target.value)}
            >
              <option value="">Select a discount</option>
              {active.map((discount) => (
                <option key={discount.id} value={discount.id}>
                  {discount.name} — {describeDiscountValue(discount)}
                </option>
              ))}
            </NativeSelect>
            {picked && (
              <p className="text-xs text-muted-foreground">
                {humanizeEnum(picked.type)} ·{' '}
                {picked.mode === 'PERCENTAGE'
                  ? 'taken off each charge it covers'
                  : 'taken off once per invoice'}{' '}
                · {picked.appliesToFeeItemIds.length === 0 ? 'all charges' : 'selected charges only'}
              </p>
            )}
            {!discounts.isPending && active.length === 0 && (
              <p className="text-xs text-muted-foreground">
                There are no active discounts yet. Create one under Finance → Fees → Discounts.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-scope">Applies to</Label>
            <NativeSelect
              data-cy="grant-discount-scope"
              id="grant-scope"
              value={effectiveScope}
              onChange={(event) => setScope(event.target.value)}
            >
              <optgroup label="One term">
                {(terms.data ?? []).map((term) => (
                  <option key={term.id} value={`term:${term.id}`}>
                    {term.name} · {term.sessionName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="A whole session">
                {sessions.map((session) => (
                  <option key={session.id} value={`session:${session.id}`}>
                    Every term of {session.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ongoing">
                <option value={ALWAYS}>Every term until removed</option>
              </optgroup>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-note">Note</Label>
            <Textarea
              data-cy="grant-discount-note"
              id="grant-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional — e.g. mother is on the teaching staff."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="grant-discount-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="grant-discount-save"
            loading={grant.isPending}
            disabled={!discountId}
            onClick={() => void submit().catch(() => undefined)}
          >
            Grant discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
