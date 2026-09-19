import { useState } from 'react';
import { Percent, Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useRevokeStudentDiscount, useStudentDiscounts } from './api';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import type { StudentDiscount } from '@/types/finance';
import { GrantDiscountDialog } from './grant-discount-dialog';
import { describeDiscountValue, describeGrantScope } from './discount-scope';

/**
 * The discounts one student holds — the answer to "why is this family's bill
 * lower?" before any invoice exists, and where a bursar grants or removes one.
 *
 * Nothing here changes an invoice already issued: a grant is picked up by the
 * next bill raised for the student, by hand or in a bulk run.
 */
export function StudentDiscountsCard({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string;
}) {
  const { can } = useAuth();
  const canManage = can('discount.manage');
  const grants = useStudentDiscounts(studentId);
  const revoke = useRevokeStudentDiscount(studentId);
  const [granting, setGranting] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<StudentDiscount | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Discounts</CardTitle>
            <CardDescription>
              Applied automatically to invoices raised for this student. The reason is recorded on
              each invoice.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              data-cy="student-discounts-grant"
              variant="outline"
              size="sm"
              onClick={() => setGranting(true)}
            >
              <Plus />
              Grant discount
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {grants.isPending ? (
          <LoadingState label="Loading discounts…" />
        ) : grants.isError ? (
          <ErrorState error={grants.error} onRetry={() => void grants.refetch()} />
        ) : (grants.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon={<Percent />} title="No discounts granted" />
        ) : (
          <ul className="divide-y divide-border">
            {grants.data?.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{grant.discountName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {describeGrantScope(grant)} · granted by {grant.grantedByName} on{' '}
                    {formatDate(grant.grantedAt)}
                  </p>
                  {grant.note && (
                    <p className="truncate text-xs text-muted-foreground">{grant.note}</p>
                  )}
                </div>
                <Badge tone="neutral">{humanizeEnum(grant.type)}</Badge>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {describeDiscountValue(grant)}
                </span>
                {canManage && (
                  <Button
                    data-cy="student-discounts-remove"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${grant.discountName}`}
                    onClick={() => setPendingRevoke(grant)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {granting && (
        <GrantDiscountDialog
          studentId={studentId}
          studentName={studentName}
          open={granting}
          onOpenChange={setGranting}
        />
      )}

      <ConfirmDialog
        data-cy="student-discounts-remove-confirm"
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        tone="danger"
        title="Remove this discount?"
        description={`"${pendingRevoke?.discountName}" will stop applying to new invoices for this student. Invoices already issued keep the discount they were given.`}
        confirmLabel="Remove"
        loading={revoke.isPending}
        onConfirm={async () => {
          if (pendingRevoke) await revoke.mutateAsync(pendingRevoke.id);
          setPendingRevoke(null);
        }}
      />
    </Card>
  );
}
