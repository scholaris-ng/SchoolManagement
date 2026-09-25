import type { EntityManager } from 'typeorm';
import { InvoicesService, type IssueInvoiceParams, type IssueLine } from '../services/invoices.service';
import { InvoiceRepository, type CarryForwardCandidate } from '../repositories/invoice.repository';

/**
 * A whole cohort is billed in one batch rather than a pupil at a time, so the
 * thing worth pinning down is that nothing crosses over between pupils: each
 * bill carries its own arrears, its own charges and its own number, and the
 * invoices it absorbs are closed against it and not against somebody else's.
 */
describe('InvoicesService.issueInvoices', () => {
  afterEach(() => jest.restoreAllMocks());

  // Only `getRepository` is reached — every statement goes through the mocked
  // repository — and `create` is TypeORM's in-memory entity builder.
  const manager = {
    getRepository: () => ({ create: (data: unknown) => data }),
  } as unknown as EntityManager;

  const line = (feeItemId: string, unitAmount: number): IssueLine => ({
    feeItemId,
    description: feeItemId,
    category: 'TUITION' as never,
    quantity: 1,
    unitAmount,
    discountAmount: 0,
    isOptional: false,
    accounts: [],
  });

  const params = (studentId: string, sequence: number, lines: IssueLine[]): IssueInvoiceParams => ({
    schoolId: 'school-1',
    studentId,
    classId: 'class-a',
    sessionId: 'session-1',
    sessionName: '2025/2026',
    termId: 'term-1',
    sessionStartDate: '2025-09-01',
    termSequence: 1,
    feeStructureId: 'structure-1',
    issueDate: '2025-09-10',
    dueDate: '2025-09-30',
    sequence,
    note: null,
    lines,
    createdByUserId: 'user-1',
  });

  const arrange = (carried: Map<string, CarryForwardCandidate[]>, newIds: string[]) => {
    const locks = jest
      .spyOn(InvoiceRepository.Instance, 'lockStudentsForInvoicing')
      .mockResolvedValue(undefined);
    jest.spyOn(InvoiceRepository.Instance, 'lockOpenEarlierInvoices').mockResolvedValue(carried);
    const createMany = jest.spyOn(InvoiceRepository.Instance, 'createMany').mockResolvedValue(newIds);
    const createLines = jest.spyOn(InvoiceRepository.Instance, 'createLines').mockResolvedValue(undefined);
    const close = jest.spyOn(InvoiceRepository.Instance, 'closeCarriedForward').mockResolvedValue(undefined);
    return { locks, createMany, createLines, close };
  };

  it('gives each pupil their own arrears, charges and invoice number', async () => {
    const carried = new Map<string, CarryForwardCandidate[]>([
      ['stu-a', [{ id: 'old-1', invoiceNo: 'INV/2024-2025/00009', balance: 500 }]],
    ]);
    const { createMany, createLines } = arrange(carried, ['new-a', 'new-b']);

    await InvoicesService.Instance.issueInvoices(manager, [
      params('stu-a', 7, [line('item-1', 1000)]),
      params('stu-b', 8, [line('item-1', 2000), line('item-2', 250)]),
    ]);

    const [rows] = createMany.mock.calls[0];
    expect(rows[0]).toMatchObject({
      studentId: 'stu-a',
      invoiceNo: 'INV/2025-2026/00007',
      subtotal: '1000.00',
      broughtForward: '500.00',
      broughtForwardFrom: [{ invoiceId: 'old-1', invoiceNo: 'INV/2024-2025/00009', amount: 500 }],
      total: '1500.00',
      status: 'ISSUED',
    });
    // Bola owes nothing from earlier terms, so nothing is carried onto hers.
    expect(rows[1]).toMatchObject({
      studentId: 'stu-b',
      invoiceNo: 'INV/2025-2026/00008',
      subtotal: '2250.00',
      broughtForward: '0.00',
      broughtForwardFrom: [],
      total: '2250.00',
    });

    const [lineRows] = createLines.mock.calls[0];
    expect(lineRows.map((row) => [row.invoiceId, row.feeItemId, row.lineTotal])).toEqual([
      ['new-a', 'item-1', '1000.00'],
      ['new-b', 'item-1', '2000.00'],
      ['new-b', 'item-2', '250.00'],
    ]);
  });

  it('closes each absorbed bill against the bill that actually took it on', async () => {
    const carried = new Map<string, CarryForwardCandidate[]>([
      [
        'stu-a',
        [
          { id: 'old-1', invoiceNo: 'INV/2024-2025/00009', balance: 500 },
          // Nothing left owing on this one, so it is not absorbed and not closed.
          { id: 'old-2', invoiceNo: 'INV/2024-2025/00010', balance: 0 },
        ],
      ],
      ['stu-b', [{ id: 'old-3', invoiceNo: 'INV/2024-2025/00011', balance: 125 }]],
    ]);
    const { close } = arrange(carried, ['new-a', 'new-b']);

    await InvoicesService.Instance.issueInvoices(manager, [
      params('stu-a', 7, [line('item-1', 1000)]),
      params('stu-b', 8, [line('item-1', 2000)]),
    ]);

    expect(close.mock.calls[0][1]).toEqual([
      {
        id: 'old-1',
        intoInvoiceId: 'new-a',
        intoInvoiceNo: 'INV/2025-2026/00007',
        closedByUserId: 'user-1',
      },
      {
        id: 'old-3',
        intoInvoiceId: 'new-b',
        intoInvoiceNo: 'INV/2025-2026/00008',
        closedByUserId: 'user-1',
      },
    ]);
  });

  it('takes every pupil lock once, in a fixed order, so two runs cannot deadlock', async () => {
    const { locks } = arrange(new Map(), ['new-1', 'new-2', 'new-3']);

    await InvoicesService.Instance.issueInvoices(manager, [
      params('stu-c', 1, [line('item-1', 100)]),
      params('stu-a', 2, [line('item-1', 100)]),
      params('stu-b', 3, [line('item-1', 100)]),
    ]);

    expect(locks.mock.calls[0][1]).toEqual([
      'invoice:student:stu-a',
      'invoice:student:stu-b',
      'invoice:student:stu-c',
    ]);
  });

  describe('a follow-up bill that takes over same-term invoices', () => {
    const arrangeFollowUp = (taken: CarryForwardCandidate[]) => {
      const base = arrange(new Map(), ['new-a']);
      const lockInTerm = jest
        .spyOn(InvoiceRepository.Instance, 'lockOpenInvoicesInTerm')
        .mockResolvedValue(taken);
      return { ...base, lockInTerm };
    };

    it('moves their balance onto the new bill and closes them against it', async () => {
      const { createMany, close, lockInTerm } = arrangeFollowUp([
        { id: 'same-1', invoiceNo: 'INV/2025-2026/00003', balance: 106000 },
      ]);

      await InvoicesService.Instance.issueInvoices(manager, [
        { ...params('stu-a', 9, []), carryInvoiceIds: ['same-1'] },
      ]);

      // Looked up against this student and term, not whatever the request claims.
      expect(lockInTerm).toHaveBeenCalledWith(manager, 'school-1', 'stu-a', 'term-1', ['same-1']);
      expect(createMany.mock.calls[0][0][0]).toMatchObject({
        subtotal: '0.00',
        broughtForward: '106000.00',
        broughtForwardFrom: [{ invoiceId: 'same-1', invoiceNo: 'INV/2025-2026/00003', amount: 106000 }],
        total: '106000.00',
        status: 'ISSUED',
      });
      expect(close.mock.calls[0][1]).toEqual([
        {
          id: 'same-1',
          intoInvoiceId: 'new-a',
          intoInvoiceNo: 'INV/2025-2026/00009',
          closedByUserId: 'user-1',
        },
      ]);
    });

    it('adds charges of its own on top of what it carries', async () => {
      const { createMany } = arrangeFollowUp([
        { id: 'same-1', invoiceNo: 'INV/2025-2026/00003', balance: 106000 },
      ]);

      await InvoicesService.Instance.issueInvoices(manager, [
        { ...params('stu-a', 9, [line('item-1', 5000)]), carryInvoiceIds: ['same-1'] },
      ]);

      expect(createMany.mock.calls[0][0][0]).toMatchObject({
        subtotal: '5000.00',
        broughtForward: '106000.00',
        total: '111000.00',
      });
    });

    it('refuses when an invoice it was told to carry is no longer open', async () => {
      const { createMany, close } = arrangeFollowUp([
        { id: 'same-1', invoiceNo: 'INV/2025-2026/00003', balance: 106000 },
      ]);

      await expect(
        InvoicesService.Instance.issueInvoices(manager, [
          { ...params('stu-a', 9, []), carryInvoiceIds: ['same-1', 'paid-since'] },
        ]),
      ).rejects.toThrow(/changed since this page loaded/);

      expect(createMany).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });

    it('refuses a bill with no charges once nothing is left owing on what it carries', async () => {
      const { createMany } = arrangeFollowUp([
        { id: 'same-1', invoiceNo: 'INV/2025-2026/00003', balance: 0 },
      ]);

      await expect(
        InvoicesService.Instance.issueInvoices(manager, [
          { ...params('stu-a', 9, []), carryInvoiceIds: ['same-1'] },
        ]),
      ).rejects.toThrow(/nothing to bill/);

      expect(createMany).not.toHaveBeenCalled();
    });

    it('leaves same-term invoices alone when nothing asks to carry them', async () => {
      const { lockInTerm } = arrangeFollowUp([]);

      await InvoicesService.Instance.issueInvoices(manager, [params('stu-a', 9, [line('item-1', 5000)])]);

      expect(lockInTerm).not.toHaveBeenCalled();
    });
  });

  it('settles a bill that comes to nothing rather than reporting it as owed', async () => {
    const { createMany } = arrange(new Map(), ['new-a']);

    await InvoicesService.Instance.issueInvoices(manager, [
      {
        ...params('stu-a', 1, [line('item-1', 1000)]),
        discounts: [
          {
            discountId: 'scholarship',
            name: 'Full scholarship',
            type: 'SCHOLARSHIP' as never,
            mode: 'PERCENTAGE' as never,
            value: 100,
            appliesToFeeItemIds: [],
          },
        ],
      },
    ]);

    expect(createMany.mock.calls[0][0][0]).toMatchObject({
      subtotal: '1000.00',
      discountTotal: '1000.00',
      total: '0.00',
      status: 'PAID',
      appliedDiscounts: [expect.objectContaining({ discountId: 'scholarship', amount: 1000 })],
    });
  });

  it('writes nothing at all for an empty run', async () => {
    const { locks, createMany, createLines, close } = arrange(new Map(), []);

    await expect(InvoicesService.Instance.issueInvoices(manager, [])).resolves.toEqual([]);

    expect(locks).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(createLines).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('still raises a single invoice on its own, for the bursar typing one by hand', async () => {
    arrange(new Map([['stu-a', [{ id: 'old-1', invoiceNo: 'INV/2024-2025/00009', balance: 500 }]]]), [
      'new-a',
    ]);

    const invoice = await InvoicesService.Instance.issueInvoice(
      manager,
      params('stu-a', 3, [line('item-1', 1000)]),
    );

    expect(invoice).toMatchObject({
      id: 'new-a',
      invoiceNo: 'INV/2025-2026/00003',
      total: '1500.00',
      broughtForward: '500.00',
    });
  });
});
