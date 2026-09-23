import { describe, expect, it } from 'vitest';
import { previewDiscounts, type PreviewDiscount } from './discount-math';

const discount = (overrides: Partial<PreviewDiscount>): PreviewDiscount => ({
  id: 'd1',
  name: 'Staff child',
  type: 'STAFF_CHILD',
  mode: 'PERCENTAGE',
  value: 50,
  appliesToFeeItemIds: [],
  ...overrides,
});

const lines = [
  { feeItemId: 'tuition', unitAmount: 50_000, quantity: 1 },
  { feeItemId: 'transport', unitAmount: 70_000, quantity: 1 },
];

describe('previewDiscounts', () => {
  it('takes a percentage off every line when the discount names no fee items', () => {
    const { applied, total } = previewDiscounts(lines, [discount({})]);
    expect(total).toBe(60_000);
    expect(applied).toEqual([expect.objectContaining({ discountId: 'd1', amount: 60_000 })]);
  });

  it('only touches the fee items a discount is limited to', () => {
    const { total } = previewDiscounts(lines, [discount({ appliesToFeeItemIds: ['tuition'] })]);
    expect(total).toBe(25_000);
  });

  it('treats a fixed amount as one sum for the whole invoice', () => {
    const { total, applied } = previewDiscounts(
      [{ feeItemId: 'tuition', unitAmount: 6_000, quantity: 1 }, lines[1]],
      [discount({ mode: 'FIXED', value: 10_000, name: 'Early payment' })],
    );
    expect(total).toBe(10_000);
    expect(applied[0].name).toBe('Early payment');
  });

  it('never takes a line below zero when discounts stack, and skips one with nothing left to waive', () => {
    const { total, applied } = previewDiscounts(lines, [
      discount({ id: 'scholarship', name: 'Academic scholarship', value: 100 }),
      discount({ id: 'staff', value: 50 }),
    ]);
    expect(total).toBe(120_000);
    expect(applied.map((entry) => entry.discountId)).toEqual(['scholarship']);
  });

  it('waives nothing for a discount whose fee items are not on the bill', () => {
    const { total, applied } = previewDiscounts(lines, [
      discount({ appliesToFeeItemIds: ['uniform'] }),
    ]);
    expect(total).toBe(0);
    expect(applied).toEqual([]);
  });

  it('counts a discount already typed on a line as taken, same as the server', () => {
    const { total, applied } = previewDiscounts(
      [{ feeItemId: 'tuition', unitAmount: 50_000, quantity: 1, discountAmount: 20_000 }],
      [discount({ value: 50 })],
    );
    // The named discount still has room for its full 50% (25,000) on top of
    // the 20,000 already typed onto the line — together under the 50,000 charge.
    expect(applied[0].amount).toBe(25_000);
    expect(total).toBe(45_000);
  });
});
