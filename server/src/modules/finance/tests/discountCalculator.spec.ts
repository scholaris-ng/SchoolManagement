import {
  applyDiscounts,
  type ApplicableDiscount,
  type DiscountableLine,
} from '../services/discountCalculator';

const TUITION = 'fee-tuition';
const TRANSPORT = 'fee-transport';

const line = (feeItemId: string, unitAmount: number, quantity = 1, discountAmount = 0): DiscountableLine => ({
  feeItemId,
  unitAmount,
  quantity,
  discountAmount,
});

const discount = (overrides: Partial<ApplicableDiscount>): ApplicableDiscount => ({
  discountId: 'd1',
  name: 'Staff child',
  type: 'STAFF_CHILD',
  mode: 'PERCENTAGE',
  value: 50,
  appliesToFeeItemIds: [],
  ...overrides,
});

describe('applyDiscounts', () => {
  const lines = [line(TUITION, 50_000), line(TRANSPORT, 70_000)];

  it('takes a percentage off every line when the discount names no fee items', () => {
    const { lineDiscounts, applied } = applyDiscounts(lines, [discount({})]);
    expect(lineDiscounts).toEqual([25_000, 35_000]);
    expect(applied).toEqual([
      expect.objectContaining({ discountId: 'd1', name: 'Staff child', amount: 60_000 }),
    ]);
  });

  it('only touches the fee items a discount is limited to', () => {
    const { lineDiscounts, applied } = applyDiscounts(lines, [
      discount({ appliesToFeeItemIds: [TUITION] }),
    ]);
    expect(lineDiscounts).toEqual([25_000, 0]);
    expect(applied[0].amount).toBe(25_000);
  });

  it('treats a fixed amount as one sum for the whole invoice, spread down the lines', () => {
    const { lineDiscounts, applied } = applyDiscounts(
      [line(TUITION, 6_000), line(TRANSPORT, 70_000)],
      [discount({ mode: 'FIXED', value: 10_000, name: 'Early payment', type: 'EARLY_PAYMENT' })],
    );
    expect(lineDiscounts).toEqual([6_000, 4_000]);
    expect(applied[0].amount).toBe(10_000);
  });

  it('never waives more than the invoice is worth for a fixed amount', () => {
    const { lineDiscounts, applied } = applyDiscounts(
      [line(TUITION, 4_000)],
      [discount({ mode: 'FIXED', value: 10_000 })],
    );
    expect(lineDiscounts).toEqual([4_000]);
    expect(applied[0].amount).toBe(4_000);
  });

  it('never takes a line below zero when percentages stack', () => {
    const { lineDiscounts, applied } = applyDiscounts(lines, [
      discount({ discountId: 'scholarship', name: 'Academic scholarship', value: 100 }),
      discount({ discountId: 'staff', name: 'Staff child', value: 50 }),
    ]);
    expect(lineDiscounts).toEqual([50_000, 70_000]);
    // The second discount had nothing left to waive, so it is not claimed as a reason.
    expect(applied.map((entry) => entry.discountId)).toEqual(['scholarship']);
  });

  it('adds percentages together as shares of the full price', () => {
    const { lineDiscounts } = applyDiscounts(
      [line(TUITION, 100_000)],
      [discount({ discountId: 'a', value: 10 }), discount({ discountId: 'b', value: 50 })],
    );
    expect(lineDiscounts).toEqual([60_000]);
  });

  it('counts a discount already typed on a line as taken', () => {
    const { lineDiscounts, applied } = applyDiscounts(
      [line(TUITION, 50_000, 1, 40_000)],
      [discount({ value: 50 })],
    );
    expect(lineDiscounts).toEqual([50_000]);
    expect(applied[0].amount).toBe(10_000);
  });

  it('prices a discount against quantity times unit amount', () => {
    const { lineDiscounts } = applyDiscounts([line(TRANSPORT, 5_000, 4)], [discount({ value: 25 })]);
    expect(lineDiscounts).toEqual([5_000]);
  });

  it('leaves out a discount whose fee items are not on the bill', () => {
    const { lineDiscounts, applied } = applyDiscounts(lines, [
      discount({ appliesToFeeItemIds: ['fee-uniform'] }),
    ]);
    expect(lineDiscounts).toEqual([0, 0]);
    expect(applied).toEqual([]);
  });

  it('rounds to whole kobo so totals never carry a fraction of one', () => {
    const { lineDiscounts } = applyDiscounts([line(TUITION, 33.33)], [discount({ value: 33.33 })]);
    expect(lineDiscounts[0]).toBe(11.11);
  });

  it('returns lines untouched when there are no discounts', () => {
    const { lineDiscounts, applied } = applyDiscounts(lines, []);
    expect(lineDiscounts).toEqual([0, 0]);
    expect(applied).toEqual([]);
  });
});
