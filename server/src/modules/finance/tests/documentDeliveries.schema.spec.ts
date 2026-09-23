import {
  fetchDeliveriesSchema,
  logPrintDeliverySchema,
  recordDeliverySchema,
} from '../validators/documentDeliveries.schema';

const documentId = '3f2b8c1e-5d4a-4e9b-8a7c-1d2e3f4a5b6c';
const guardianId = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const params = { documentType: 'RECEIPT', documentId };

describe('recordDeliverySchema', () => {
  it('accepts a copy handed across the counter, with nobody named', () => {
    const parsed = recordDeliverySchema.parse({ params, body: { channel: 'PRINT' } });
    expect(parsed.body.channel).toBe('PRINT');
    // Nobody to name is the normal case for paper, so the recipient stays open.
    expect(parsed.body.recipientName).toBeUndefined();
    expect(parsed.body.includeCharges).toBe(false);
  });

  it.each(['RECEIPT', 'INVOICE', 'BILL', 'FEE_SCHEDULE'])(
    'records a copy of a %s, since the register covers every document a school sends',
    (documentType) => {
      const parsed = recordDeliverySchema.parse({
        params: { documentType, documentId },
        body: { channel: 'WHATSAPP' },
      });
      expect(parsed.params.documentType).toBe(documentType);
    },
  );

  it('refuses a kind of document this school does not send', () => {
    expect(
      recordDeliverySchema.safeParse({
        params: { documentType: 'REPORT_CARD', documentId },
        body: { channel: 'PRINT' },
      }).success,
    ).toBe(false);
  });

  it('accepts a guardian, a contact and a note, trimming what was typed', () => {
    const parsed = recordDeliverySchema.parse({
      params,
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
    expect(recordDeliverySchema.safeParse({ params, body: { channel: 'PIGEON' } }).success).toBe(
      false,
    );
  });

  it('records which paper was handed over', () => {
    const parsed = recordDeliverySchema.parse({
      params,
      body: { channel: 'PRINT', printFormat: 'POS' },
    });
    expect(parsed.body.printFormat).toBe('POS');
  });

  /**
   * Optional here, unlike the print log: somebody recording a delivery from
   * memory a week later may genuinely not remember which paper it was, and
   * refusing the entry over that would cost the register the delivery itself.
   */
  it('accepts a handed-over copy with no paper named', () => {
    const parsed = recordDeliverySchema.parse({ params, body: { channel: 'PRINT' } });
    expect(parsed.body.printFormat).toBeUndefined();
  });

  it('requires a channel: a delivery nobody can describe is not worth recording', () => {
    expect(recordDeliverySchema.safeParse({ params, body: {} }).success).toBe(false);
  });

  it('refuses a status, so a print cannot be logged as delivered from outside', () => {
    expect(
      recordDeliverySchema.safeParse({ params, body: { channel: 'PRINT', status: 'CONFIRMED' } })
        .success,
    ).toBe(false);
  });

  it('accepts an instant for a copy being logged after the fact', () => {
    const parsed = recordDeliverySchema.parse({
      params,
      body: { channel: 'OTHER', sentAt: '2026-09-21T10:15:00.000Z' },
    });
    expect(parsed.body.sentAt).toBe('2026-09-21T10:15:00.000Z');
  });

  it('refuses a date with no time, which would leave the register ambiguous', () => {
    expect(
      recordDeliverySchema.safeParse({ params, body: { channel: 'OTHER', sentAt: '2026-09-21' } })
        .success,
    ).toBe(false);
  });

  it('refuses a note too long to be a note', () => {
    expect(
      recordDeliverySchema.safeParse({ params, body: { channel: 'PRINT', note: 'x'.repeat(501) } })
        .success,
    ).toBe(false);
  });

  it('refuses a guardian id that is not a uuid', () => {
    expect(
      recordDeliverySchema.safeParse({ params, body: { channel: 'EMAIL', guardianId: 'nope' } })
        .success,
    ).toBe(false);
  });
});

describe('logPrintDeliverySchema', () => {
  it.each(['POS', 'FULL_PAGE'])('records which paper came out — %s', (printFormat) => {
    const parsed = logPrintDeliverySchema.parse({ params, body: { printFormat } });
    expect(parsed.body.printFormat).toBe(printFormat);
    expect(parsed.body.includeCharges).toBe(false);
  });

  /**
   * Required, not defaulted. The browser is the only thing that knows which the
   * person chose in the print dialog, and a register that guessed "full page"
   * would quietly claim a parent holds a filed document when they hold a till
   * slip.
   */
  it('requires the paper, rather than assuming one', () => {
    expect(logPrintDeliverySchema.safeParse({ params, body: {} }).success).toBe(false);
  });

  it('refuses a paper size it does not know', () => {
    expect(
      logPrintDeliverySchema.safeParse({ params, body: { printFormat: 'A3' } }).success,
    ).toBe(false);
  });

  /**
   * The channel is not the browser's to name: only a print is logged this way.
   * An email or a WhatsApp message is logged by the server as it sends, with the
   * status that channel has actually earned — letting the browser claim one
   * would be letting it claim a delivery.
   */
  it('refuses a channel, which is fixed to PRINT by the route itself', () => {
    expect(
      logPrintDeliverySchema.safeParse({ params, body: { printFormat: 'POS', channel: 'EMAIL' } })
        .success,
    ).toBe(false);
  });

  it('refuses a recipient: a print is not addressed to anybody', () => {
    expect(
      logPrintDeliverySchema.safeParse({
        params,
        body: { printFormat: 'POS', recipientName: 'Mrs Chizea' },
      }).success,
    ).toBe(false);
  });
});

describe('fetchDeliveriesSchema', () => {
  it('defaults to the first page, unfiltered — what the register opens on', () => {
    const parsed = fetchDeliveriesSchema.parse({ query: {} });
    expect(parsed.query.page).toBe(1);
    expect(parsed.query.pageSize).toBe(25);
    expect(parsed.query.documentType).toBeUndefined();
    expect(parsed.query.status).toBeUndefined();
  });

  it('coerces the page numbers a query string always sends as text', () => {
    const parsed = fetchDeliveriesSchema.parse({ query: { page: '3', pageSize: '50' } });
    expect(parsed.query.page).toBe(3);
    expect(parsed.query.pageSize).toBe(50);
  });

  it('caps the page size, so one request cannot ask for the whole register', () => {
    expect(fetchDeliveriesSchema.safeParse({ query: { pageSize: '5000' } }).success).toBe(false);
  });

  it('filters by what the office actually works from', () => {
    const parsed = fetchDeliveriesSchema.parse({
      query: { documentType: 'INVOICE', channel: 'WHATSAPP', status: 'PREPARED' },
    });
    expect(parsed.query).toMatchObject({
      documentType: 'INVOICE',
      channel: 'WHATSAPP',
      status: 'PREPARED',
    });
  });

  /** "Which receipts only ever got a till slip?" is a real question at a desk. */
  it('narrows prints to one shape of paper', () => {
    const parsed = fetchDeliveriesSchema.parse({ query: { channel: 'PRINT', printFormat: 'POS' } });
    expect(parsed.query.printFormat).toBe('POS');
  });

  it('refuses a date bound that is not a plain day', () => {
    expect(
      fetchDeliveriesSchema.safeParse({ query: { dateFrom: '21/09/2026' } }).success,
    ).toBe(false);
  });

  it('refuses a sort column the register does not have', () => {
    expect(fetchDeliveriesSchema.safeParse({ query: { sortBy: 'recipientContact' } }).success).toBe(
      false,
    );
  });
});
