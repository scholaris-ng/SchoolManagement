import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useMergePaymentDestinations, usePaymentDestinationDuplicates } from './use-payment-destinations';
import type { PaymentDestinationDuplicateGroup } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

/**
 * Duplicate accounts left over from before payment accounts were
 * centralised — the same bank and account number typed onto more than one
 * fee item, each copied into its own row here (see `PaymentDestination`).
 * Merging keeps one and repoints everything that referenced the others onto
 * it before deleting them, so editing that one account actually reaches
 * everywhere it is picked, which is the whole point of centralising them.
 */
export function DuplicatePaymentDestinations() {
  const duplicates = usePaymentDestinationDuplicates();
  const merge = useMergePaymentDestinations();
  const groups = duplicates.data ?? [];

  if (groups.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          <CardTitle>
            {groups.length} possible duplicate account{groups.length === 1 ? '' : 's'}
          </CardTitle>
        </div>
        <CardDescription>
          Each group below shares the same bank and account number — almost certainly the same real
          account, entered separately on more than one fee item before accounts moved here. Pick
          which one to keep; the others are removed and anything that pointed at them is repointed to
          the one you keep.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((group, index) => (
          <DuplicateGroupRow
            key={`${group.bankName}-${group.accountNumber}-${index}`}
            group={group}
            onMerge={(keepId, mergeIds) => merge.mutate({ keepId, mergeIds })}
            saving={merge.isPending}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DuplicateGroupRow({
  group,
  onMerge,
  saving,
}: {
  group: PaymentDestinationDuplicateGroup;
  onMerge: (keepId: string, mergeIds: string[]) => void;
  saving: boolean;
}) {
  const [keepId, setKeepId] = useState(group.destinations[0].id);
  const groupName = `keep-destination-${group.bankName}-${group.accountNumber}`;

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-sm font-medium">
        {group.bankName} · {group.accountNumber}
        <span className="ml-1 font-normal text-muted-foreground">
          ({group.destinations.length} copies)
        </span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {group.destinations.map((destination) => (
          <li key={destination.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                data-cy="duplicate-destination-keep"
                type="radio"
                name={groupName}
                className="size-4 border-input"
                checked={keepId === destination.id}
                onChange={() => setKeepId(destination.id)}
              />
              {destination.label ? `${destination.label} — ` : ''}
              {destination.accountName}
            </label>
          </li>
        ))}
      </ul>
      <Button
        data-cy="duplicate-destination-merge"
        size="sm"
        className="mt-2"
        loading={saving}
        onClick={() =>
          onMerge(
            keepId,
            group.destinations.map((destination) => destination.id).filter((id) => id !== keepId),
          )
        }
      >
        Merge into one
      </Button>
    </div>
  );
}
