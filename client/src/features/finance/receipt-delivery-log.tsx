import { useState } from 'react';
import { Check, Mail, MessageCircle, Printer, Send, SendHorizonal } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import type { ReceiptDelivery, ReceiptDeliveryChannel } from '@/types/finance';
import { useConfirmReceiptDelivery, useReceiptDeliveries } from './use-receipt-deliveries';
import { RecordDeliveryDialog } from './record-delivery-dialog';

const CHANNEL_LABEL: Record<ReceiptDeliveryChannel, string> = {
  PRINT: 'Printed',
  EMAIL: 'Emailed',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Sent another way',
};

function ChannelIcon({ channel }: { channel: ReceiptDeliveryChannel }) {
  const className = 'size-4 shrink-0 text-muted-foreground';
  if (channel === 'PRINT') return <Printer className={className} aria-hidden="true" />;
  if (channel === 'EMAIL') return <Mail className={className} aria-hidden="true" />;
  if (channel === 'WHATSAPP') return <MessageCircle className={className} aria-hidden="true" />;
  return <SendHorizonal className={className} aria-hidden="true" />;
}

/**
 * How many copies of this receipt the family can be taken to hold — for the
 * page header, so the answer is visible before anybody scrolls.
 *
 * A failed send is not a copy. A `PREPARED` one is counted but named as
 * unconfirmed, because the office did do something with it and hiding that
 * would send somebody to re-send a receipt that is already on the printer.
 */
export function deliverySummary(deliveries: ReceiptDelivery[]): {
  tone: 'success' | 'warning' | 'neutral';
  label: string;
} {
  const real = deliveries.filter((delivery) => delivery.status !== 'FAILED');
  if (real.length === 0) return { tone: 'warning', label: 'Not sent yet' };
  const confirmed = real.filter((delivery) => delivery.status === 'CONFIRMED').length;
  if (confirmed === 0) {
    return { tone: 'neutral', label: `Sent ${real.length}× · unconfirmed` };
  }
  return { tone: 'success', label: `Sent ${real.length}×` };
}

/**
 * Every copy of this receipt that has left the office.
 *
 * The office's answer to "did they ever get it?" — a question that otherwise
 * ends in guesswork, because a printed receipt, an email and a WhatsApp
 * message leave no shared trace. Printing and sharing write their own entries
 * as they happen; anything sent by other means is added here by hand.
 *
 * What each entry claims is limited to what is actually known. An email the
 * mail server accepted says "Delivered". A print or a WhatsApp message says
 * "Not confirmed" until somebody at the desk says the family has it — that
 * confirmation is the one thing no amount of server code could supply.
 */
export function ReceiptDeliveryLog({
  paymentId,
  studentId,
  includeCharges,
  sendable = true,
}: {
  paymentId: string;
  studentId: string;
  /** Mirrors the "show charges" box, so a recorded copy says which shape went out. */
  includeCharges: boolean;
  /**
   * `false` for a reversed receipt: what already went out still needs reading —
   * a family may be holding a copy — but nothing new may be recorded as sent,
   * which the server enforces too.
   */
  sendable?: boolean;
}) {
  const deliveries = useReceiptDeliveries(paymentId);
  const confirm = useConfirmReceiptDelivery(paymentId);
  const [recordOpen, setRecordOpen] = useState(false);

  const rows = deliveries.data ?? [];

  return (
    <>
      <Card className="no-print" data-cy="finance-receipt-deliveries">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>Sent to the family</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every copy of this receipt that has gone out, and by whose hand.
            </p>
          </div>
          {sendable && (
            <Button
              data-cy="finance-receipt-delivery-record"
              variant="outline"
              size="sm"
              onClick={() => setRecordOpen(true)}
            >
              <Send />
              Record a delivery
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {deliveries.isPending ? (
            <LoadingState label="Loading the delivery record…" />
          ) : deliveries.isError ? (
            <ErrorState error={deliveries.error} onRetry={() => void deliveries.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={<Send />}
              title="No copy has gone out yet"
              description={
                sendable
                  ? 'Print it, email it or send it on WhatsApp and it will be logged here. A copy you sent another way can be recorded by hand.'
                  : 'This payment was reversed before any copy of its receipt went out.'
              }
              data-cy="finance-receipt-deliveries-empty"
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((delivery) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  onConfirm={() => confirm.mutate(delivery.id)}
                  confirming={confirm.isPending && confirm.variables === delivery.id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RecordDeliveryDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        paymentId={paymentId}
        studentId={studentId}
        includeCharges={includeCharges}
      />
    </>
  );
}

function DeliveryRow({
  delivery,
  onConfirm,
  confirming,
}: {
  delivery: ReceiptDelivery;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const failed = delivery.status === 'FAILED';

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-sm">
      <span className="mt-0.5">
        <ChannelIcon channel={delivery.channel} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{CHANNEL_LABEL[delivery.channel]}</span>
          {delivery.recipientName && (
            <span className="truncate text-muted-foreground">{delivery.recipientName}</span>
          )}
          <StatusBadge status={delivery.status} />
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {delivery.recipientContact && <span>{delivery.recipientContact} · </span>}
          {formatDateTime(delivery.sentAt)} · by {delivery.sentByName}
          {delivery.includeCharges && <span> · with itemised charges</span>}
        </p>

        {/* The reason a send was refused is the whole value of keeping it. */}
        {failed && delivery.failureReason && (
          <p className="mt-0.5 text-xs text-danger">{delivery.failureReason}</p>
        )}
        {delivery.note && <p className="mt-0.5 text-xs text-muted-foreground">{delivery.note}</p>}
        {delivery.confirmedByName && (
          <p className="mt-0.5 text-xs text-success">
            Confirmed by {delivery.confirmedByName}
            {delivery.confirmedAt ? ` · ${formatDateTime(delivery.confirmedAt)}` : ''}
          </p>
        )}
      </div>

      {delivery.status === 'PREPARED' && (
        <Button
          data-cy="finance-receipt-delivery-confirm"
          variant="ghost"
          size="sm"
          loading={confirming}
          onClick={onConfirm}
        >
          <Check />
          Mark delivered
        </Button>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: ReceiptDelivery['status'] }) {
  if (status === 'CONFIRMED') return <Badge tone="success">Delivered</Badge>;
  if (status === 'FAILED') return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="warning">Not confirmed</Badge>;
}
