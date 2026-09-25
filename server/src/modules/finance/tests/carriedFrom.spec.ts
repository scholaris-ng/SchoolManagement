import { InvoicesService } from '../services/invoices.service';
import { InvoiceRepository, type ReceiptLineRow } from '../repositories/invoice.repository';
import type { InvoiceDTO } from '../dto/finance.dto';

/**
 * What a printed invoice says its brought-forward balance was made of. The
 * figure the total counts is the one recorded when the balance was carried;
 * the fee items are read off the closed invoice, and the two only agree when
 * every payment on it named a fee item — so the breakdown has to say what the
 * items do not account for, or the printed rows would not add up.
 */
describe('InvoicesService carried-forward breakdown', () => {
  afterEach(() => jest.restoreAllMocks());

  const carriedFromFor = (
    invoice: Pick<InvoiceDTO, 'id' | 'broughtForward'> & { lines?: Partial<InvoiceDTO['lines'][number]>[] },
  ) =>
    (
      InvoicesService.Instance as unknown as {
        carriedFromFor: (schoolId: string, invoice: unknown) => Promise<InvoiceDTO['carriedFrom']>;
      }
    ).carriedFromFor('school-1', { lines: [], ...invoice });

  const line = (over: Partial<ReceiptLineRow>): ReceiptLineRow => ({
    id: 'line',
    invoiceId: 'old-1',
    description: 'Tuition',
    isOptional: false,
    amount: 0,
    balance: 0,
    discountAmount: 0,
    ...over,
  });

  const arrange = (
    sources: { invoiceId: string; invoiceNo: string; amount: number }[],
    lines: ReceiptLineRow[],
  ) => {
    jest.spyOn(InvoiceRepository.Instance, 'findBroughtForwardSources').mockResolvedValue(sources);
    return jest.spyOn(InvoiceRepository.Instance, 'findLinesForInvoices').mockResolvedValue(lines);
  };

  it('lists what is left on each fee item, with what was billed and already paid', async () => {
    arrange(
      [{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00018', amount: 25_000 }],
      [line({ id: 'l1', description: 'Tuition', amount: 55_000, balance: 25_000 })],
    );

    const [source] = await carriedFromFor({ id: 'new-1', broughtForward: 25_000 });

    expect(source).toEqual({
      invoiceId: 'old-1',
      invoiceNo: 'INV/2026-2027/00018',
      amount: 25_000,
      items: [{ description: 'Tuition', amount: 55_000, paid: 30_000, balance: 25_000 }],
      unassigned: 0,
    });
  });

  it('leaves out fee items with nothing left on them', async () => {
    arrange(
      [{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00018', amount: 40_000 }],
      [
        line({ id: 'l1', description: 'Tuition', amount: 55_000, balance: 0 }),
        line({ id: 'l2', description: 'Exam', amount: 40_000, balance: 40_000 }),
      ],
    );

    const [source] = await carriedFromFor({ id: 'new-1', broughtForward: 40_000 });

    expect(source.items.map((item) => item.description)).toEqual(['Exam']);
    expect(source.unassigned).toBe(0);
  });

  it('accounts for payments that never named a fee item, so the rows add up to what was carried', async () => {
    // ₦256,000 billed and ₦150,000 paid, of which only ₦85,000 named an item:
    // the items still add up to ₦171,000, but only ₦106,000 was carried.
    arrange(
      [{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00018', amount: 106_000 }],
      [
        line({ id: 'l1', description: 'Tuition', amount: 55_000, balance: 25_000 }),
        line({ id: 'l2', description: 'Exam', amount: 40_000, balance: 40_000 }),
        line({ id: 'l3', description: 'Development', amount: 25_000, balance: 25_000 }),
        line({ id: 'l4', description: 'Boarding', amount: 36_000, balance: 21_000 }),
        line({ id: 'l5', description: 'Test', amount: 100_000, balance: 60_000 }),
      ],
    );

    const [source] = await carriedFromFor({ id: 'new-1', broughtForward: 106_000 });

    expect(source.unassigned).toBe(-65_000);
    const itemised = source.items.reduce((sum, item) => sum + item.balance, 0);
    expect(itemised + source.unassigned).toBe(source.amount);
  });

  it('shows a positive difference when the closed invoice was itself carrying a balance', async () => {
    arrange(
      [{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00018', amount: 80_000 }],
      [line({ id: 'l1', description: 'Tuition', amount: 50_000, balance: 50_000 })],
    );

    const [source] = await carriedFromFor({ id: 'new-1', broughtForward: 80_000 });

    expect(source.unassigned).toBe(30_000);
  });

  it('keeps each carried invoice to its own fee items', async () => {
    const lines = arrange(
      [
        { invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00018', amount: 10_000 },
        { invoiceId: 'old-2', invoiceNo: 'INV/2026-2027/00019', amount: 20_000 },
      ],
      [
        line({ id: 'l1', invoiceId: 'old-1', description: 'Tuition', amount: 10_000, balance: 10_000 }),
        line({ id: 'l2', invoiceId: 'old-2', description: 'Bus', amount: 20_000, balance: 20_000 }),
      ],
    );

    const result = await carriedFromFor({ id: 'new-1', broughtForward: 30_000 });

    expect(lines).toHaveBeenCalledWith('school-1', ['old-1', 'old-2'], { countTicks: true });
    expect(result.map((source) => source.items.map((item) => item.description))).toEqual([
      ['Tuition'],
      ['Bus'],
    ]);
  });

  describe('carried as real lines', () => {
    const carried = (over: Partial<InvoiceDTO['lines'][number]>) => ({
      description: 'Tuition',
      lineTotal: 40_000,
      amountPaid: 0,
      balance: 40_000,
      carriedFromInvoiceId: 'old-1',
      ...over,
    });

    it('lists the invoice\'s own carried lines, so what has been paid since shows', async () => {
      const closed = arrange([{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00020', amount: 90_000 }], []);

      const [source] = await carriedFromFor({
        id: 'new-1',
        broughtForward: 90_000,
        lines: [
          carried({ description: 'Tuition', lineTotal: 40_000, amountPaid: 10_000, balance: 30_000 }),
          carried({ description: 'Exam', lineTotal: 50_000, amountPaid: 0, balance: 50_000 }),
        ],
      });

      expect(source.items).toEqual([
        { description: 'Tuition', amount: 40_000, paid: 10_000, balance: 30_000 },
        { description: 'Exam', amount: 50_000, paid: 0, balance: 50_000 },
      ]);
      expect(source.unassigned).toBe(0);
      // Nothing to go and read off the closed invoice.
      expect(closed).not.toHaveBeenCalled();
    });

    it('leaves out a carried item that has since been paid off', async () => {
      arrange([{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00020', amount: 90_000 }], []);

      const [source] = await carriedFromFor({
        id: 'new-1',
        broughtForward: 90_000,
        lines: [
          carried({ description: 'Tuition', lineTotal: 40_000, amountPaid: 40_000, balance: 0 }),
          carried({ description: 'Exam', lineTotal: 50_000 , balance: 50_000 }),
        ],
      });

      expect(source.items.map((item) => item.description)).toEqual(['Exam']);
      // Still counted in what was carried, so nothing is left unexplained.
      expect(source.unassigned).toBe(0);
    });

    it('shows what no item accounts for as the difference', async () => {
      arrange([{ invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00020', amount: 100_000 }], []);

      const [source] = await carriedFromFor({
        id: 'new-1',
        broughtForward: 100_000,
        lines: [carried({ lineTotal: 40_000, balance: 40_000 })],
      });

      expect(source.unassigned).toBe(60_000);
    });

    it('still reads a lump carry off the closed invoice beside an itemized one', async () => {
      const lines = arrange(
        [
          { invoiceId: 'old-1', invoiceNo: 'INV/2026-2027/00020', amount: 40_000 },
          { invoiceId: 'old-0', invoiceNo: 'INV/2025-2026/00007', amount: 15_000 },
        ],
        [line({ id: 'l0', invoiceId: 'old-0', description: 'Bus', amount: 15_000, balance: 15_000 })],
      );

      const result = await carriedFromFor({
        id: 'new-1',
        broughtForward: 55_000,
        lines: [carried({})],
      });

      // Only the lump one is read off its closed invoice.
      expect(lines).toHaveBeenCalledWith('school-1', ['old-0'], { countTicks: true });
      expect(result.map((source) => source.items.map((item) => item.description))).toEqual([
        ['Tuition'],
        ['Bus'],
      ]);
    });
  });

  it('does no work for an invoice that carries nothing', async () => {
    const sources = jest.spyOn(InvoiceRepository.Instance, 'findBroughtForwardSources');

    expect(await carriedFromFor({ id: 'new-1', broughtForward: 0 })).toEqual([]);
    expect(sources).not.toHaveBeenCalled();
  });
});
