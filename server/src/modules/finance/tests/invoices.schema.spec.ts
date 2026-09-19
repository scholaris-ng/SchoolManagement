import { createInvoiceSchema, updateInvoiceSchema } from '../validators/invoices.schema';

describe('invoice discountIds', () => {
  const uuid = '3f2b8c1e-5d4a-4e9b-8a7c-1d2e3f4a5b6c';
  const other = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
  const line = { feeItemId: uuid, quantity: 1, discountAmount: 0 };
  const base = { studentId: uuid, termId: uuid, dueDate: '2026-10-01', lines: [line] };

  it('defaults to no extra discounts on a new invoice', () => {
    expect(createInvoiceSchema.parse({ body: base }).body.discountIds).toEqual([]);
  });

  it('accepts discounts chosen by id', () => {
    const parsed = createInvoiceSchema.parse({ body: { ...base, discountIds: [uuid, other] } });
    expect(parsed.body.discountIds).toEqual([uuid, other]);
  });

  it('refuses an id that is not a uuid', () => {
    expect(
      createInvoiceSchema.safeParse({ body: { ...base, discountIds: ['staff-child'] } }).success,
    ).toBe(false);
  });

  it('refuses more discounts than one invoice needs', () => {
    const many = Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(createInvoiceSchema.safeParse({ body: { ...base, discountIds: many } }).success).toBe(false);
  });

  it('leaves discountIds undefined on an edit that does not name any, so the invoice keeps its own', () => {
    const parsed = updateInvoiceSchema.parse({ params: { id: uuid }, body: { lines: [line] } });
    expect(parsed.body.discountIds).toBeUndefined();
  });
});
