import { fetchGuardiansSchema } from '../validators/guardians.schema';

const wrap = (query: unknown = {}) => ({ query, body: {}, params: {} });

describe('fetchGuardiansSchema', () => {
  it('defaults to the first page, sorted ascending, with no portal filter', () => {
    const result = fetchGuardiansSchema.safeParse(wrap());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.sortDir).toBe('asc');
      expect(result.data.query.hasPortalAccess).toBeUndefined();
    }
  });

  it('accepts the portal filter as the word the query string sends', () => {
    for (const value of ['true', 'false'] as const) {
      const result = fetchGuardiansSchema.safeParse(wrap({ hasPortalAccess: value }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.query.hasPortalAccess).toBe(value);
    }
  });

  it('refuses a portal filter that is not the literal word true or false', () => {
    expect(fetchGuardiansSchema.safeParse(wrap({ hasPortalAccess: 'yes' })).success).toBe(false);
  });
});
