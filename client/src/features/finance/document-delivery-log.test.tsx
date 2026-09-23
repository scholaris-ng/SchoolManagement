import { describe, expect, it } from 'vitest';
import { deliverySummary } from './document-delivery-log';
import type { DocumentDelivery } from '@/types/finance';

function delivery(overrides: Partial<DocumentDelivery> = {}): DocumentDelivery {
  return {
    id: 'del-1',
    documentType: 'RECEIPT',
    documentId: 'pay-1',
    documentLabel: 'PAY-20260919-3F9A2C',
    channel: 'EMAIL',
    status: 'CONFIRMED',
    includeCharges: false,
    sentByName: 'Ada Okon',
    sentAt: '2026-09-21T10:15:00.000Z',
    ...overrides,
  };
}

describe('deliverySummary', () => {
  it('says a document has not gone out when nothing has been logged', () => {
    const summary = deliverySummary([]);
    expect(summary.label).toBe('Not sent yet');
    expect(summary.tone).toBe('warning');
  });

  it('counts a confirmed send', () => {
    expect(deliverySummary([delivery()])).toEqual({ tone: 'success', label: 'Sent 1×' });
  });

  it('counts every copy that went out, however many', () => {
    expect(deliverySummary([delivery(), delivery({ id: 'del-2', channel: 'PRINT' })]).label).toBe(
      'Sent 2×',
    );
  });

  /**
   * A print or an unsent WhatsApp draft is real enough to show — hiding it would
   * send somebody to re-send a document already sitting on the printer — but it
   * is not a copy the family can be said to hold, and it must not read as one.
   */
  it('marks copies nobody has confirmed as unconfirmed', () => {
    const summary = deliverySummary([delivery({ status: 'PREPARED', channel: 'PRINT' })]);
    expect(summary.label).toBe('Sent 1× · unconfirmed');
    expect(summary.tone).toBe('neutral');
  });

  it('counts unconfirmed copies alongside confirmed ones', () => {
    const summary = deliverySummary([
      delivery(),
      delivery({ id: 'del-2', status: 'PREPARED', channel: 'WHATSAPP' }),
    ]);
    expect(summary).toEqual({ tone: 'success', label: 'Sent 2×' });
  });

  /** A bounced email is not a copy anybody holds, so it must not count as one. */
  it('ignores a failed send entirely', () => {
    expect(deliverySummary([delivery({ status: 'FAILED' })])).toEqual({
      tone: 'warning',
      label: 'Not sent yet',
    });
  });

  it('does not let a failed send inflate the count of real copies', () => {
    const summary = deliverySummary([delivery(), delivery({ id: 'del-2', status: 'FAILED' })]);
    expect(summary.label).toBe('Sent 1×');
  });

  /** The same summary serves an invoice's header as a receipt's. */
  it('reads the same for any kind of document', () => {
    const summary = deliverySummary([
      delivery({ documentType: 'INVOICE', documentLabel: 'INV-2026-0007' }),
    ]);
    expect(summary).toEqual({ tone: 'success', label: 'Sent 1×' });
  });
});
