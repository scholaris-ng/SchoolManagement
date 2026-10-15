import { InvoicesService } from '../services/invoices.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import { manualDiscountResidualKobo } from '../services/invoiceRevisions';
import type { InvoiceDTO } from '../dto/finance.dto';

/**
 * What an edit does to an invoice, worked out before anything is written.
 *
 * These pin three faults found on a real follow-up invoice: an edit that
 * silently dropped hand-keyed discounts, one that floored the balance carried
 * forward at zero, and one that gave a lump-carried invoice carried lines it
 * never had.
 */

type Plan = {
  fields: Record<string, unknown>;
  after: { lines: { description: string; discountAmount: number; lineTotal: number }[]; total: number };
  changes: { kind: string }[];
  totalDeltaKobo: number;
};

const service = InvoicesService.Instance as unknown as {
  planEdit: (
    context: unknown,
    existing: InvoiceDTO,
    request: Record<string, unknown>,
    options: { keepStatus: boolean },
  ) => Promise<Plan>;
  syncCarriedCopies: (
    manager: unknown,
    context: unknown,
    carrier: unknown,
    upstream: unknown[],
  ) => Promise<void>;
  structureAmountsFor: (...args: unknown[]) => Promise<Map<string, number>>;
  discountsFor: (...args: unknown[]) => Promise<unknown[]>;
};

const context = { schoolId: 'school-1', user: { id: 'u1', displayName: 'Bursar' } };

const feeItem = (id: string, name: string, amount: number) => ({
  id,
  name,
  amount,
  category: 'OTHER',
  isOptional: false,
  accounts: [],
  priceOptions: [],
});

const savedLine = (
  id: string,
  feeItemId: string,
  description: string,
  unitAmount: number,
  discountAmount: number,
  amountPaid = 0,
) => ({
  id,
  feeItemId,
  description,
  quantity: 1,
  unitAmount,
  discountAmount,
  lineTotal: unitAmount - discountAmount,
  isOptional: false,
  accounts: [],
  carriedFromInvoiceId: null,
  carriedFromInvoiceNo: null,
  amountPaid,
  balance: unitAmount - discountAmount - amountPaid,
});

/** INV/00018 as it really was: five charges, ₦24,000 of hand-keyed discounts, ₦150,000 paid. */
const earlier = (): InvoiceDTO =>
  ({
    id: 'inv-18',
    invoiceNo: 'INV/2026-2027/00018',
    studentId: 'stu-1',
    studentName: 'Chukwuemeka Umeh',
    sessionId: 's-1',
    termId: 't-1',
    dueDate: '2026-10-25',
    note: null,
    status: 'CANCELLED',
    subtotal: 280000,
    discountTotal: 24000,
    appliedDiscounts: [],
    broughtForward: 0,
    total: 256000,
    amountPaid: 150000,
    lines: [
      savedLine('l-tuition', 'tuition', 'Tuition', 55000, 0, 30000),
      savedLine('l-exam', 'exam', 'Exam', 60000, 20000, 40000),
      savedLine('l-dev', 'development', 'Development', 25000, 0, 25000),
      savedLine('l-boarding', 'boarding', 'Boarding', 40000, 4000, 15000),
      savedLine('l-test', 'test', 'Test', 100000, 0, 40000),
    ],
  }) as unknown as InvoiceDTO;

/** INV/00019 carrying the ₦106,000 still owing on 18 as one lump — no carried lines of its own. */
const lumpFollowUp = (): InvoiceDTO =>
  ({
    id: 'inv-19',
    invoiceNo: 'INV/2026-2027/00019',
    studentId: 'stu-1',
    sessionId: 's-1',
    termId: 't-1',
    dueDate: '2026-10-25',
    note: null,
    status: 'ISSUED',
    subtotal: 0,
    discountTotal: 0,
    appliedDiscounts: [],
    broughtForward: 106000,
    total: 106000,
    amountPaid: 0,
    lines: [],
  }) as unknown as InvoiceDTO;

describe('editing an earlier invoice from the one that carried it', () => {
  beforeEach(() => {
    jest.spyOn(FeeItemRepository.Instance, 'fetchForSchool').mockResolvedValue([
      feeItem('tuition', 'Tuition', 70000), // dearer on today's list than it was billed at
      feeItem('exam', 'Exam', 60000),
      feeItem('development', 'Development', 25000),
      feeItem('boarding', 'Boarding', 40000),
      feeItem('test', 'Test', 100000),
    ] as never);
    jest.spyOn(service, 'structureAmountsFor').mockResolvedValue(new Map());
    jest.spyOn(service, 'discountsFor').mockResolvedValue([]);
    jest.spyOn(InvoiceRepository.Instance, 'findBroughtForwardSources').mockResolvedValue([
      { invoiceId: 'inv-18', invoiceNo: 'INV/2026-2027/00018', amount: 106000 },
    ]);
  });
  afterEach(() => jest.restoreAllMocks());

  const keep = (feeItemId: string) => ({
    feeItemId,
    quantity: 1,
    discountAmount: 0,
    keepSavedPrice: true,
    keepSavedDiscount: true,
  });

  it('keeps the hand-keyed discounts on charges nobody touched', async () => {
    // Remove Tuition and Test; Exam, Development and Boarding are left alone.
    const plan = await service.planEdit(
      context,
      earlier(),
      { lines: [keep('exam'), keep('development'), keep('boarding')] },
      { keepStatus: true },
    );

    const byName = Object.fromEntries(plan.after.lines.map((line) => [line.description, line]));
    // As billed — ₦40,000 and ₦36,000, not the ₦60,000 and ₦40,000 the list prices say.
    expect(byName.Exam).toMatchObject({ discountAmount: 20000, lineTotal: 40000 });
    expect(byName.Boarding).toMatchObject({ discountAmount: 4000, lineTotal: 36000 });
    expect(byName.Development).toMatchObject({ discountAmount: 0, lineTotal: 25000 });
    // 256,000 − Tuition 55,000 − Test 100,000 = 101,000. Nothing else moved.
    expect(plan.after.total).toBe(101000);
    expect(plan.totalDeltaKobo).toBe(-155000 * 100);
  });

  it('would have raised those charges had the discount not been kept', async () => {
    const dropped = (feeItemId: string) => ({ ...keep(feeItemId), keepSavedDiscount: undefined });

    const plan = await service.planEdit(
      context,
      earlier(),
      { lines: [dropped('exam'), dropped('development'), dropped('boarding')] },
      { keepStatus: true },
    );

    // The fault: a quiet ₦24,000 increase, which is what reached the family's balance.
    expect(plan.after.total).toBe(125000);
  });

  it('lets a hand-keyed discount be retyped, or cleared, on a charge that was touched', async () => {
    const plan = await service.planEdit(
      context,
      earlier(),
      {
        lines: [
          { ...keep('exam'), keepSavedDiscount: undefined, discountAmount: 5000 },
          keep('development'),
        ],
      },
      { keepStatus: true },
    );

    expect(plan.after.lines.find((line) => line.description === 'Exam')).toMatchObject({
      discountAmount: 5000,
      lineTotal: 55000,
    });
  });
});

describe('the balance an earlier invoice brings forward', () => {
  beforeEach(() => {
    jest.spyOn(InvoiceRepository.Instance, 'findBroughtForwardSources').mockResolvedValue([
      { invoiceId: 'inv-18', invoiceNo: 'INV/2026-2027/00018', amount: 106000 },
    ]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('follows the earlier invoice exactly, including past zero, so it can be put back', async () => {
    // 18 edited down by ₦116,000 against only ₦106,000 still owing on it.
    const down = await service.planEdit(
      context,
      lumpFollowUp(),
      { broughtForwardShifts: [{ invoiceId: 'inv-18', deltaKobo: -116000 * 100 }] },
      { keepStatus: false },
    );

    // Not floored at ₦0 — the ₦10,000 overpaid is carried as a credit.
    expect(down.fields.broughtForward).toBe('-10000.00');
    expect(down.fields.total).toBe('-10000.00');
    expect(down.fields.broughtForwardFrom).toEqual([
      { invoiceId: 'inv-18', invoiceNo: 'INV/2026-2027/00018', amount: -10000 },
    ]);

    // …and the same charges put back return it to exactly where it started.
    const back = await service.planEdit(
      context,
      { ...lumpFollowUp(), broughtForward: -10000, total: -10000 } as InvoiceDTO,
      { broughtForwardShifts: [{ invoiceId: 'inv-18', deltaKobo: 116000 * 100 }] },
      { keepStatus: false },
    );
    expect(back.fields.broughtForward).toBe('106000.00');
    expect(back.fields.total).toBe('106000.00');
  });

  it('moves by exactly the amount the earlier invoice moved by', async () => {
    const plan = await service.planEdit(
      context,
      lumpFollowUp(),
      { broughtForwardShifts: [{ invoiceId: 'inv-18', deltaKobo: -55000 * 100 }] },
      { keepStatus: false },
    );

    expect(plan.fields.broughtForward).toBe('51000.00');
    expect(plan.fields.total).toBe('51000.00');
    expect(plan.fields.status).toBe('ISSUED');
  });
});

describe('carried charges on an invoice that carries its balance as one lump', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives it none: the lump already moved by exactly what changed', async () => {
    jest.spyOn(InvoiceRepository.Instance, 'findCarriedCopies').mockResolvedValue([]);
    const createLines = jest.spyOn(InvoiceRepository.Instance, 'createLines').mockResolvedValue();
    const updateLine = jest.spyOn(InvoiceRepository.Instance, 'updateLine').mockResolvedValue();
    const deleteLines = jest
      .spyOn(InvoiceRepository.Instance, 'deleteLinesById')
      .mockResolvedValue();

    await service.syncCarriedCopies({}, context, lumpFollowUp(), [
      {
        dto: earlier(),
        plan: {
          lineDeltas: [
            { feeItemId: 'exam', deltaKobo: 20000 * 100 },
            { feeItemId: 'boarding', deltaKobo: 4000 * 100 },
            { feeItemId: 'other', deltaKobo: 15000 * 100 },
          ],
          newLines: [],
        },
      },
    ]);

    // Before the fix this inserted three "carried" lines, which replaced the
    // whole breakdown on the printed invoice with those three odd figures.
    expect(createLines).not.toHaveBeenCalled();
    expect(updateLine).not.toHaveBeenCalled();
    expect(deleteLines).not.toHaveBeenCalled();
  });
});

describe('manualDiscountResidualKobo', () => {
  it('is what is left of the saved discount once the named ones are taken away', () => {
    expect(manualDiscountResidualKobo(2_000_000, 0)).toBe(2_000_000);
    expect(manualDiscountResidualKobo(2_000_000, 500_000)).toBe(1_500_000);
  });

  it('is never negative', () => {
    expect(manualDiscountResidualKobo(100_000, 500_000)).toBe(0);
  });
});
