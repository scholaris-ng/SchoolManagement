import { createGuardianSchema, fetchGuardiansSchema } from '../validators/guardians.schema';

const wrap = (query: unknown = {}) => ({ query, body: {}, params: {} });
const wrapBody = (body: unknown) => ({ query: {}, body, params: {} });

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

describe('createGuardianSchema', () => {
  const valid = {
    firstName: 'Ngozi',
    lastName: 'Okafor',
    phone: '+234 803 000 0000',
  };

  it('accepts a guardian with no email — they may not want a portal account', () => {
    expect(createGuardianSchema.safeParse(wrapBody(valid)).success).toBe(true);
  });

  it('refuses inviting a guardian to the portal with no email to invite', () => {
    const result = createGuardianSchema.safeParse(
      wrapBody({ ...valid, grantPortalAccess: true }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts inviting a guardian who does have an email', () => {
    const result = createGuardianSchema.safeParse(
      wrapBody({ ...valid, email: 'ngozi@example.com', grantPortalAccess: true }),
    );
    expect(result.success).toBe(true);
  });
});
