import { fetchPaymentsSchema, reversePaymentSchema } from '../validators/payments.schema';

describe('fetchPaymentsSchema', () => {
  const classId = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

  it('filters by the class a student is in', () => {
    const parsed = fetchPaymentsSchema.parse({ query: { classId } });
    expect(parsed.query.classId).toBe(classId);
  });

  it('leaves the class open when none is chosen', () => {
    expect(fetchPaymentsSchema.parse({ query: {} }).query.classId).toBeUndefined();
  });

  it('refuses a class id that is not a uuid, so it never reaches the SQL', () => {
    expect(fetchPaymentsSchema.safeParse({ query: { classId: 'JSS 2' } }).success).toBe(false);
  });
});

describe('reversePaymentSchema', () => {
  const id = '3f2b8c1e-5d4a-4e9b-8a7c-1d2e3f4a5b6c';

  it('accepts a reason and trims it', () => {
    const parsed = reversePaymentSchema.parse({
      params: { id },
      body: { reason: '  Typed 50000 instead of 5000  ' },
    });
    expect(parsed.body.reason).toBe('Typed 50000 instead of 5000');
  });

  it('requires a reason', () => {
    expect(reversePaymentSchema.safeParse({ params: { id }, body: {} }).success).toBe(false);
  });

  it('refuses a reason that is only whitespace', () => {
    expect(reversePaymentSchema.safeParse({ params: { id }, body: { reason: '    ' } }).success).toBe(
      false,
    );
  });

  it('refuses a reason too long to be a reason', () => {
    expect(
      reversePaymentSchema.safeParse({ params: { id }, body: { reason: 'x'.repeat(501) } }).success,
    ).toBe(false);
  });

  it('refuses fields it does not know, so an amount cannot be smuggled in as an "edit"', () => {
    expect(
      reversePaymentSchema.safeParse({ params: { id }, body: { reason: 'Wrong amount', amount: 5000 } })
        .success,
    ).toBe(false);
  });

  it('refuses an id that is not a uuid', () => {
    expect(
      reversePaymentSchema.safeParse({ params: { id: 'nope' }, body: { reason: 'Wrong amount' } })
        .success,
    ).toBe(false);
  });
});
