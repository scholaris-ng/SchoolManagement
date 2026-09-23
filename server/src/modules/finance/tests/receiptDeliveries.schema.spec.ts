import {
  logReceiptDeliverySchema,
  recordReceiptDeliverySchema,
} from '../validators/receiptDeliveries.schema';

const paymentId = '3f2b8c1e-5d4a-4e9b-8a7c-1d2e3f4a5b6c';
const guardianId = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

describe('recordReceiptDeliverySchema', () => {
  it('accepts a copy handed across the counter, with nobody named', () => {
    const parsed = recordReceiptDeliverySchema.parse({
      params: { paymentId },
      body: { channel: 'PRINT' },
    });
    expect(parsed.body.channel).toBe('PRINT');
    // Nobody to name is the normal case for paper, so the recipient stays open.
    expect(parsed.body.recipientName).toBeUndefined();
    expect(parsed.body.includeCharges).toBe(false);
  });

  it('accepts a guardian, a contact and a note, trimming what was typed', () => {
    const parsed = recordReceiptDeliverySchema.parse({
      params: { paymentId },
      body: {
        channel: 'EMAIL',
        guardianId,
        recipientName: '  Mrs Chizea  ',
        recipientContact: '  chizea@example.com  ',
        note: '  Posted to their Lagos address  ',
        includeCharges: true,
      },
    });
    expect(parsed.body.recipientName).toBe('Mrs Chizea');
    expect(parsed.body.recipientContact).toBe('chizea@example.com');
    expect(parsed.body.note).toBe('Posted to their Lagos address');
    expect(parsed.body.includeCharges).toBe(true);
  });

  it('refuses a channel it does not know', () => {
    expect(
      recordReceiptDeliverySchema.safeParse({ params: { paymentId }, body: { channel: 'PIGEON' } })
        .success,
    ).toBe(false);
  });

  it('requires a channel: a delivery nobody can describe is not worth recording', () => {
    expect(recordReceiptDeliverySchema.safeParse({ params: { paymentId }, body: {} }).success).toBe(
      false,
    );
  });

  it('refuses a status, so a print cannot be logged as delivered from outside', () => {
    expect(
      recordReceiptDeliverySchema.safeParse({
        params: { paymentId },
        body: { channel: 'PRINT', status: 'CONFIRMED' },
      }).success,
    ).toBe(false);
  });

  it('accepts an instant for a copy being logged after the fact', () => {
    const parsed = recordReceiptDeliverySchema.parse({
      params: { paymentId },
      body: { channel: 'OTHER', sentAt: '2026-09-21T10:15:00.000Z' },
    });
    expect(parsed.body.sentAt).toBe('2026-09-21T10:15:00.000Z');
  });

  it('refuses a date with no time, which would leave the register ambiguous', () => {
    expect(
      recordReceiptDeliverySchema.safeParse({
        params: { paymentId },
        body: { channel: 'OTHER', sentAt: '2026-09-21' },
      }).success,
    ).toBe(false);
  });

  it('refuses a note too long to be a note', () => {
    expect(
      recordReceiptDeliverySchema.safeParse({
        params: { paymentId },
        body: { channel: 'PRINT', note: 'x'.repeat(501) },
      }).success,
    ).toBe(false);
  });

  it('refuses a guardian id that is not a uuid', () => {
    expect(
      recordReceiptDeliverySchema.safeParse({
        params: { paymentId },
        body: { channel: 'EMAIL', guardianId: 'nope' },
      }).success,
    ).toBe(false);
  });
});

describe('logReceiptDeliverySchema', () => {
  it('accepts a print, defaulting the shape of the copy', () => {
    const parsed = logReceiptDeliverySchema.parse({
      params: { paymentId },
      body: { channel: 'PRINT' },
    });
    expect(parsed.body.includeCharges).toBe(false);
  });

  /**
   * Only a print is logged this way. An email or a WhatsApp message is logged by
   * the server as it sends, with the status that channel has actually earned —
   * letting the browser claim one would be letting it claim a delivery.
   */
  it.each(['EMAIL', 'WHATSAPP', 'OTHER'])('refuses %s, which the server logs itself', (channel) => {
    expect(
      logReceiptDeliverySchema.safeParse({ params: { paymentId }, body: { channel } }).success,
    ).toBe(false);
  });

  it('refuses a recipient: a print is not addressed to anybody', () => {
    expect(
      logReceiptDeliverySchema.safeParse({
        params: { paymentId },
        body: { channel: 'PRINT', recipientName: 'Mrs Chizea' },
      }).success,
    ).toBe(false);
  });
});
