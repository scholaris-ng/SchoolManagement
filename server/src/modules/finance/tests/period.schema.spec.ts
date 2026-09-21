import { fetchInvoicesSchema } from '../validators/invoices.schema';
import { fetchPaymentsSchema } from '../validators/payments.schema';

/**
 * Payments and invoices share one interval filter, so the same cases run
 * against both: the two lists must never disagree about what a valid period is.
 */
describe.each([
  ['payments', fetchPaymentsSchema],
  ['invoices', fetchInvoicesSchema],
])('%s date interval', (_name, schema) => {
  const parse = (query: Record<string, unknown>) => schema.safeParse({ query });

  it('is optional, so an unfiltered list still parses', () => {
    const result = parse({});
    expect(result.success).toBe(true);
  });

  it('accepts both ends', () => {
    const result = schema.parse({ query: { dateFrom: '2026-09-01', dateTo: '2026-09-30' } });
    expect(result.query.dateFrom).toBe('2026-09-01');
    expect(result.query.dateTo).toBe('2026-09-30');
  });

  it('accepts either end on its own', () => {
    expect(parse({ dateFrom: '2026-09-01' }).success).toBe(true);
    expect(parse({ dateTo: '2026-09-30' }).success).toBe(true);
  });

  it('accepts a single day', () => {
    expect(parse({ dateFrom: '2026-09-15', dateTo: '2026-09-15' }).success).toBe(true);
  });

  it('refuses an interval that ends before it starts, and blames the end date', () => {
    const result = parse({ dateFrom: '2026-09-30', dateTo: '2026-09-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['query', 'dateTo']);
    }
  });

  it('refuses a date that is not in YYYY-MM-DD form', () => {
    expect(parse({ dateFrom: '01/09/2026' }).success).toBe(false);
    expect(parse({ dateFrom: '2026-9-1' }).success).toBe(false);
    expect(parse({ dateFrom: '2026-09-01T00:00:00Z' }).success).toBe(false);
  });

  it('refuses a date that does not exist, which PostgreSQL would fail on with a 500', () => {
    expect(parse({ dateFrom: '2026-02-31' }).success).toBe(false);
    expect(parse({ dateTo: '2026-13-01' }).success).toBe(false);
    expect(parse({ dateTo: '2026-04-31' }).success).toBe(false);
  });

  it('accepts 29 February only in a leap year', () => {
    expect(parse({ dateFrom: '2028-02-29' }).success).toBe(true);
    expect(parse({ dateFrom: '2026-02-29' }).success).toBe(false);
  });

  it('refuses a year PostgreSQL cannot store as a school date', () => {
    expect(parse({ dateFrom: '0000-01-01' }).success).toBe(false);
  });
});
