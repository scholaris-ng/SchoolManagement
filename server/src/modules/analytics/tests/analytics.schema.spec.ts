import {
  admissionFunnelSchema,
  attendanceSummarySchema,
  resultAnalyticsSchema,
  retentionRiskSchema,
} from '../validators/analytics.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

describe('resultAnalyticsSchema', () => {
  it('accepts no term at all, meaning the current one', () => {
    expect(resultAnalyticsSchema.safeParse(wrap({})).success).toBe(true);
  });

  it('refuses a term id that is not a uuid', () => {
    expect(
      resultAnalyticsSchema.safeParse(wrap({ query: { termId: 'first-term' } })).success,
    ).toBe(false);
  });
});

describe('retentionRiskSchema', () => {
  it('coerces the page numbers that arrive as query strings', () => {
    const result = retentionRiskSchema.safeParse(wrap({ query: { page: '2', pageSize: '50' } }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.pageSize).toBe(50);
    }
  });

  it('accepts the full filter set the retention page sends', () => {
    const result = retentionRiskSchema.safeParse(
      wrap({
        query: {
          page: '1',
          pageSize: '25',
          search: 'ade',
          sortBy: 'riskScore',
          sortDir: 'desc',
          riskBand: 'HIGH',
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('refuses a risk band the client never offers', () => {
    expect(retentionRiskSchema.safeParse(wrap({ query: { riskBand: 'SEVERE' } })).success).toBe(
      false,
    );
  });

  it('refuses a page size beyond the shared ceiling', () => {
    expect(retentionRiskSchema.safeParse(wrap({ query: { pageSize: '5000' } })).success).toBe(
      false,
    );
  });
});

describe('attendanceSummarySchema', () => {
  it('accepts a well-ordered date window', () => {
    expect(
      attendanceSummarySchema.safeParse(wrap({ query: { from: '2025-09-01', to: '2025-12-12' } }))
        .success,
    ).toBe(true);
  });

  it('refuses a window that ends before it starts', () => {
    expect(
      attendanceSummarySchema.safeParse(wrap({ query: { from: '2025-12-12', to: '2025-09-01' } }))
        .success,
    ).toBe(false);
  });

  it('refuses a date that is not in YYYY-MM-DD form', () => {
    expect(
      attendanceSummarySchema.safeParse(wrap({ query: { from: '01/09/2025' } })).success,
    ).toBe(false);
  });
});

describe('admissionFunnelSchema', () => {
  it('accepts no session, meaning the current one', () => {
    expect(admissionFunnelSchema.safeParse(wrap({})).success).toBe(true);
  });

  it('refuses an unknown query parameter rather than ignoring it', () => {
    // A silently dropped filter is worse than a rejected one: the caller gets
    // an unfiltered page and no sign that its filter did nothing.
    expect(
      admissionFunnelSchema.safeParse(wrap({ query: { sessionYear: '2025' } })).success,
    ).toBe(false);
  });
});
