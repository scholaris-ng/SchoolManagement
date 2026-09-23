import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from '@/lib/toast-bus';
import { WHATSAPP_PENDING_PAGE, whatsAppUrl } from '@/lib/whatsapp';
import type { WhatsAppShare } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';
import { FinanceEndpoints } from './finance.endpoints';

/**
 * "Send to WhatsApp" for a finance document.
 *
 * The server stores the document as a PDF and hands back the message to send,
 * link included; this opens WhatsApp with that message already typed. Nothing is
 * sent from here or from the server — the person presses Send in WhatsApp, which
 * is also their chance to check who it is going to.
 */
export function WhatsAppShareButton({
  share,
  onShared,
  'data-cy': dataCy,
}: {
  share: () => Promise<WhatsAppShare>;
  /**
   * Called once the server has prepared the message — for a caller that keeps
   * its own record of copies going out (see `ReceiptDeliveryLog`). Not a promise
   * that anything was sent: that still depends on the person in the other tab.
   */
  onShared?: () => void;
  'data-cy': string;
}) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // Opened now, inside the click. A tab opened after the request finishes no
    // longer counts as the person's own doing and the browser blocks it as a
    // pop-up, so this one is opened empty and pointed at WhatsApp afterwards.
    const tab = window.open('', '_blank');
    try {
      tab?.document.open();
      tab?.document.write(WHATSAPP_PENDING_PAGE);
      tab?.document.close();
    } catch {
      // A blank tab is still fine.
    }

    setBusy(true);
    try {
      const result = await share();
      onShared?.();
      const url = whatsAppUrl(result);
      if (result.notice) {
        // Said here, not in WhatsApp: a message opening on a list of contacts
        // looks like the lookup failed, when a guardian's number needs fixing.
        // Long-lived, because the person is in the other tab when it appears.
        toast.warning('Choose who to send it to', { description: result.notice, durationMs: 30_000 });
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
        return;
      }
      // Blocked anyway. A click on the toast is a fresh gesture, so this works.
      toast.warning('Your browser blocked the WhatsApp tab', {
        description: 'The message is ready. Open it from here.',
        durationMs: 20_000,
        action: { label: 'Open WhatsApp', onClick: () => window.open(url, '_blank', 'noopener') },
      });
    } catch (error) {
      tab?.close();
      toast.error('Could not prepare the WhatsApp message', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      data-cy={dataCy}
      variant="outline"
      loading={busy}
      loadingLabel="Preparing…"
      onClick={() => void open()}
    >
      <MessageCircle />
      Send to WhatsApp
    </Button>
  );
}

/** Held to the same permission as emailing the same document — the link it makes is public. */
export function ShareInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <PermissionGate require="invoice.manage">
      <WhatsAppShareButton
        data-cy="finance-invoice-detail-whatsapp"
        share={() => FinanceEndpoints.shareInvoiceWhatsApp(invoiceId)}
      />
    </PermissionGate>
  );
}

/** `includeCharges` follows the "show each invoice's charges" box, so the PDF matches the page. */
export function ShareReceiptButton({
  paymentId,
  includeCharges,
  onShared,
}: {
  paymentId: string;
  includeCharges: boolean;
  /** Lets the receipt page pick up the entry the server just added to its delivery register. */
  onShared?: () => void;
}) {
  return (
    <PermissionGate require={{ anyOf: ['payment.manage', 'invoice.manage'] }}>
      <WhatsAppShareButton
        data-cy="finance-receipt-whatsapp"
        share={() => FinanceEndpoints.shareReceiptWhatsApp(paymentId, includeCharges)}
        onShared={onShared}
      />
    </PermissionGate>
  );
}

export function ShareCustomBillButton({ billId }: { billId: string }) {
  return (
    <PermissionGate require="invoice.manage">
      <WhatsAppShareButton
        data-cy="custom-bill-print-whatsapp"
        share={() => FinanceEndpoints.shareCustomBillWhatsApp(billId)}
      />
    </PermissionGate>
  );
}

/** `note` is what is typed on the print page right now, so the PDF carries it as the paper would. */
export function ShareFeeScheduleButton({ structureId, note }: { structureId: string; note: string }) {
  return (
    <PermissionGate require={{ anyOf: ['fee.manage', 'invoice.manage'] }}>
      <WhatsAppShareButton
        data-cy="finance-structure-print-whatsapp"
        share={() => FinanceEndpoints.shareFeeStructureWhatsApp(structureId, note)}
      />
    </PermissionGate>
  );
}
