import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  useCustomBills,
  useDeleteCustomBill,
  useSaveCustomBill,
} from './use-custom-bills';
import type { CustomBill } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { CustomBillDialog } from './custom-bill-dialog';

/**
 * One-off bills outside the real ledger — a contractor, a visitor, a charge
 * with no enrolled student behind it. See `CustomBill` for the reasoning.
 */
export function CustomBillsPage() {
  const bills = useCustomBills();
  const saveBill = useSaveCustomBill();
  const deleteBill = useDeleteCustomBill();

  const [dialog, setDialog] = useState<{ open: boolean; bill?: CustomBill; mode?: 'edit' | 'duplicate' }>({
    open: false,
  });
  const [pendingDelete, setPendingDelete] = useState<CustomBill | null>(null);

  const currency = 'NGN';

  return (
    <PageContainer>
      <PageHeader
        title="Custom bills"
        description="A bill for anyone or anything outside your enrolled students — a contractor, a visitor, a one-off charge. Never billed against a student's balance."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Custom bills' }]}
        actions={
          <Button data-cy="custom-bills-new" onClick={() => setDialog({ open: true })}>
            <Plus />
            New bill
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {bills.isPending ? (
            <LoadingState label="Loading bills…" />
          ) : (bills.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon={<FileText />}
              title="No custom bills yet"
              description="Create one for a contractor, a visitor, or any one-off charge."
            />
          ) : (
            <ul className="divide-y divide-border">
              {bills.data?.items.map((bill) => (
                <li key={bill.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{bill.payerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {bill.lines.length} charge{bill.lines.length === 1 ? '' : 's'} ·{' '}
                      {formatDate(bill.createdAt)}
                    </p>
                  </div>
                  <span className="w-32 shrink-0 text-right font-medium tabular-nums">
                    {formatCurrency(bill.total, currency, { showDecimals: false })}
                  </span>
                  <Button data-cy="custom-bill-print" variant="ghost" size="sm" asChild>
                    <Link to={`/finance/custom-bills/${bill.id}/print`}>
                      <Printer />
                      Print
                    </Link>
                  </Button>
                  <Button
                    data-cy="custom-bill-duplicate"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialog({ open: true, bill, mode: 'duplicate' })}
                  >
                    <Copy />
                    Duplicate
                  </Button>
                  <Button
                    data-cy="custom-bill-edit"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialog({ open: true, bill, mode: 'edit' })}
                  >
                    Edit
                  </Button>
                  <Button
                    data-cy="custom-bill-delete"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(bill)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CustomBillDialog
        key={
          dialog.mode === 'duplicate' ? `duplicate-${dialog.bill?.id}` : (dialog.bill?.id ?? 'new-bill')
        }
        state={dialog}
        onOpenChange={(open) => setDialog({ open })}
        onSave={(values) =>
          saveBill
            .mutateAsync({
              // A duplicate always creates, whatever id it was prefilled from.
              id: dialog.mode === 'duplicate' ? undefined : dialog.bill?.id,
              values,
            })
            .then(() => setDialog({ open: false }))
        }
        saving={saveBill.isPending}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this bill?"
        description={`"${pendingDelete?.payerName}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBill.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteBill.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PageContainer>
  );
}
