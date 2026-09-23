import { useState } from 'react';
import { Check, Mail, MessageCircle, Printer, Send, SendHorizonal } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import type {
  DeliveryChannel,
  DeliveryDocumentType,
  DocumentDelivery,
  PrintFormat,
} from '@/types/finance';
import { useConfirmDelivery, useDocumentDeliveries } from './use-document-deliveries';
import { RecordDeliveryDialog } from './record-delivery-dialog';

export const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  PRINT: 'Printed',
  EMAIL: 'Emailed',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Sent another way',
};

/** How the two shapes of paper read on screen — the width is what identifies a POS slip. */
export const PRINT_FORMAT_LABEL: Record<PrintFormat, string> = {
  POS: 'POS slip (78mm)',
  FULL_PAGE: 'Full page',
};

export const DOCUMENT_TYPE_LABEL: Record<DeliveryDocumentType, string> = {
  RECEIPT: 'Receipt',
  INVOICE: 'Invoice',
  BILL: 'Bill',
  FEE_SCHEDULE: 'Fee schedule',
};

export function ChannelIcon({ channel, className }: { channel: DeliveryChannel; className?: string }) {
  const classes = className ?? 'size-4 shrink-0 text-muted-foreground';
  if (channel === 'PRINT') return <Printer className={classes} aria-hidden="true" />;
  if (channel === 'EMAIL') return <Mail className={classes} aria-hidden="true" />;
  if (channel === 'WHATSAPP') return <MessageCircle className={classes} aria-hidden="true" />;
  return <SendHorizonal className={classes} aria-hidden="true" />;
}

export function DeliveryStatusBadge({ status }: { status: DocumentDelivery['status'] }) {
  if (status === 'CONFIRMED') return <Badge tone="success">Delivered</Badge>;
  if (status === 'FAILED') return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="warning">Not confirmed</Badge>;
}

/**
 * How many copies of a document the family can be taken to hold — for a page
 * header, so the answer is visible before anybody scrolls.
 *
 * A failed send is not a copy. A `PREPARED` one is counted but named as
 * unconfirmed, because the office did do something with it and hiding that would
 * send somebody to re-send a document already sitting on the printer.
 */
export function deliverySummary(deliveries: DocumentDelivery[]): {
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
 * Every copy of one document that has left the office.
 *
 * The office's answer to "did they ever get it?" — a question that otherwise
 * ends in guesswork, because a printed page, an email and a WhatsApp message
 * leave no shared trace. Printing and sharing write their own entries as they
 * happen; anything sent by other means is added here by hand.
 *
 * What each entry claims is limited to what is actually known. An email the mail
 * server accepted says "Delivered". A print or a WhatsApp message says "Not
 * confirmed" until somebody at the desk says the family has it — that
 * confirmation is the one thing no amount of server code could supply.
 */
export function DocumentDeliveryLog({
  documentType,
  documentId,
  studentId,
  includeCharges = false,
  sendable = true,
}: {
  documentType: DeliveryDocumentType;
  documentId: string;
  /** Offers the student's guardians as recipients. Absent for a bill or a fee schedule. */
  studentId?: string | null;
  /** Mirrors a receipt's "show charges" box, so a recorded copy says which shape went out. */
  includeCharges?: boolean;
  /**
   * `false` once the document may no longer be sent — a reversed receipt, a
   * cancelled invoice. What already went out still needs reading, since a family
   * may be holding a copy, but nothing new may be recorded as sent, which the
   * server enforces too.
   */
  sendable?: boolean;
}) {
  const deliveries = useDocumentDeliveries(documentType, documentId);
  const confirm = useConfirmDelivery(documentType, documentId);
  const [recordOpen, setRecordOpen] = useState(false);

  const rows = deliveries.data ?? [];
  const noun = DOCUMENT_TYPE_LABEL[documentType].toLowerCase();

  return (
    <>
      <Card className="no-print" data-cy="finance-document-deliveries">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>Sent to the family</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every copy of this {noun} that has gone out, and by whose hand.
            </p>
          </div>
          {sendable && (
            <Button
              data-cy="finance-delivery-record"
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
                  ? `Print it, email it or send it on WhatsApp and it will be logged here. A copy you sent another way can be recorded by hand.`
                  : `No copy of this ${noun} went out before it was withdrawn.`
              }
              data-cy="finance-document-deliveries-empty"
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
        documentType={documentType}
        documentId={documentId}
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
  delivery: DocumentDelivery;
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
          <span className="font-medium">
            {CHANNEL_LABEL[delivery.channel]}
            {/* Which paper came out, right beside "Printed": a till slip and a
                filed document are not the same thing to a family. */}
            {delivery.printFormat && (
              <span className="font-normal text-muted-foreground">
                {' · '}
                {PRINT_FORMAT_LABEL[delivery.printFormat]}
              </span>
            )}
          </span>
          {delivery.recipientName && (
            <span className="truncate text-muted-foreground">{delivery.recipientName}</span>
          )}
          <DeliveryStatusBadge status={delivery.status} />
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
          data-cy="finance-delivery-confirm"
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
