import { useMemo, useState } from 'react';
import { Check, FileText, Paperclip, X } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';
import { useListQuery } from '@/hooks/use-list-query';
import {
  usePaymentReceipts,
  useApprovePaymentReceipt,
  useRejectPaymentReceipt,
} from './use-payment-receipts';
import type { PaymentReceiptSubmission } from '@/types/finance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

/**
 * Evidence families submitted for a payment they say they already made — a
 * bank slip, a transfer alert — waiting on somebody here to check it against
 * the bank statement (spec section 27). Approving writes a real payment;
 * rejecting does not, and either way the family is told.
 */
export function PaymentReceiptsPage() {
  const list = useListQuery({ filterKeys: ['status'] });
  const receipts = usePaymentReceipts({ ...list.query, status: list.filters.status });
  const approve = useApprovePaymentReceipt();
  const reject = useRejectPaymentReceipt();

  const [reviewing, setReviewing] = useState<{ receipt: PaymentReceiptSubmission; mode: 'approve' | 'reject' } | null>(
    null,
  );

  const columns = useMemo<Column<PaymentReceiptSubmission>[]>(
    () => [
      {
        id: 'slip',
        header: 'Slip',
        cell: (row) => (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <FileText className="size-4" />
            View
          </a>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate">{row.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.admissionNo}</p>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount claimed',
        align: 'right',
        cell: (row) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.amount, 'NGN', { showDecimals: false })}
          </span>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        hideOnMobile: true,
        cell: (row) => (
          <div className="min-w-0">
            <p>{humanizeEnum(row.method)}</p>
            <p className="truncate text-xs text-muted-foreground">
              Paid {formatDate(row.paidAt)}
              {row.invoiceNo ? ` · ${row.invoiceNo}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'submitted',
        header: 'Submitted',
        hideOnMobile: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate">{row.submittedByName}</p>
            <p className="truncate text-xs text-muted-foreground">{formatDateTime(row.submittedAt)}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <div className="space-y-1">
            <StatusBadge status={row.status} />
            {row.status !== 'PENDING' && row.reviewedByName && (
              <p className="text-xs text-muted-foreground">by {row.reviewedByName}</p>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        cell: (row) =>
          row.status === 'PENDING' ? (
            <div className="flex justify-end gap-1">
              <Button
                data-cy="payment-receipt-approve"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setReviewing({ receipt: row, mode: 'approve' });
                }}
              >
                <Check className="text-success" />
                Approve
              </Button>
              <Button
                data-cy="payment-receipt-reject"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setReviewing({ receipt: row, mode: 'reject' });
                }}
              >
                <X className="text-danger" />
                Decline
              </Button>
            </div>
          ) : null,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Payment receipts"
        description="Slips families have submitted as proof of payment made outside the portal, waiting to be checked against the bank statement."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payment receipts' }]}
      />

      <FilterBar
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
        ]}
      />

      <DataTable
        data-cy="payment-receipts-table"
        caption="Payment receipts submitted by families, with amount, method and review status"
        data={receipts.data?.items}
        meta={receipts.data?.meta}
        columns={columns}
        rowKey={(row) => row.id}
        isLoading={receipts.isPending}
        isFetching={receipts.isFetching}
        error={receipts.error}
        onRetry={() => void receipts.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyIcon={<Paperclip />}
        emptyTitle={list.isFiltered ? 'No receipts match that filter' : 'Nothing submitted yet'}
        emptyDescription="Slips families submit as proof of payment will appear here."
      />

      <ReviewDialog
        reviewing={reviewing}
        onClose={() => setReviewing(null)}
        onApprove={(id, note) => approve.mutateAsync({ id, note })}
        onReject={(id, note) => reject.mutateAsync({ id, note })}
        isPending={approve.isPending || reject.isPending}
        error={approve.error ?? reject.error}
      />
    </PageContainer>
  );
}

function ReviewDialog({
  reviewing,
  onClose,
  onApprove,
  onReject,
  isPending,
  error,
}: {
  reviewing: { receipt: PaymentReceiptSubmission; mode: 'approve' | 'reject' } | null;
  onClose: () => void;
  onApprove: (id: string, note?: string) => Promise<unknown>;
  onReject: (id: string, note: string) => Promise<unknown>;
  isPending: boolean;
  error: unknown;
}) {
  const [note, setNote] = useState('');

  const close = (open: boolean) => {
    if (!open) {
      setNote('');
      onClose();
    }
  };

  const isReject = reviewing?.mode === 'reject';
  const canConfirm = !isReject || note.trim().length > 0;

  const confirm = async () => {
    if (!reviewing) return;
    if (reviewing.mode === 'approve') {
      await onApprove(reviewing.receipt.id, note.trim() || undefined);
    } else {
      await onReject(reviewing.receipt.id, note.trim());
    }
    setNote('');
    onClose();
  };

  return (
    <Dialog open={Boolean(reviewing)} onOpenChange={close}>
      <DialogContent size="sm" data-cy="payment-receipt-review-dialog">
        <DialogHeader>
          <DialogTitle>
            {isReject ? 'Decline this receipt?' : 'Approve this receipt?'}
          </DialogTitle>
          <DialogDescription>
            {reviewing && (
              <>
                {reviewing.receipt.studentName} ·{' '}
                {formatCurrency(reviewing.receipt.amount, 'NGN', { showDecimals: false })} ·{' '}
                {humanizeEnum(reviewing.receipt.method)} on {formatDate(reviewing.receipt.paidAt)}.{' '}
                {isReject
                  ? 'This does not record a payment — the family is told why.'
                  : 'This records the payment and, if it names an invoice, settles it.'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          <label className="text-sm font-medium" htmlFor="review-note">
            {isReject ? 'Reason for declining' : 'Note (optional)'}
          </label>
          <Textarea
            id="review-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={isReject ? 'e.g. Amount on the slip does not match' : undefined}
          />
          {error !== null && error !== undefined && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(error, 'Could not save this review. Please try again.')}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isReject ? 'danger' : 'primary'}
            onClick={() => void confirm()}
            loading={isPending}
            disabled={!canConfirm}
          >
            {isReject ? 'Decline' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
