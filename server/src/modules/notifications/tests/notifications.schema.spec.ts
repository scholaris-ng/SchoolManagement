import {
  fetchNotificationsSchema,
  registerPushTokenSchema,
  updatePreferenceSchema,
} from '../validators/notifications.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

describe('fetchNotificationsSchema', () => {
  it('defaults to the first page, newest first', () => {
    const result = fetchNotificationsSchema.safeParse(wrap({}));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      // An inbox reads newest-first; ascending would bury today's arrivals.
      expect(result.data.query.sortDir).toBe('desc');
    }
  });

  it('refuses a page size beyond the shared ceiling', () => {
    expect(
      fetchNotificationsSchema.safeParse(wrap({ query: { pageSize: '5000' } })).success,
    ).toBe(false);
  });
});

describe('updatePreferenceSchema', () => {
  it('accepts a known category and channel', () => {
    const result = updatePreferenceSchema.safeParse(
      wrap({ body: { category: 'FEE', channel: 'PUSH', enabled: false } }),
    );
    expect(result.success).toBe(true);
  });

  it('refuses a category the client never defined', () => {
    expect(
      updatePreferenceSchema.safeParse(
        wrap({ body: { category: 'PAYROLL', channel: 'PUSH', enabled: true } }),
      ).success,
    ).toBe(false);
  });

  /**
   * The channel names a database column in the preference upsert. An unknown
   * value must never reach that lookup, so the enum is the boundary that keeps
   * it from becoming a SQL identifier.
   */
  it('refuses an unknown channel', () => {
    expect(
      updatePreferenceSchema.safeParse(
        wrap({ body: { category: 'FEE', channel: 'CARRIER_PIGEON', enabled: true } }),
      ).success,
    ).toBe(false);
  });

  it('refuses extra fields rather than silently dropping them', () => {
    expect(
      updatePreferenceSchema.safeParse(
        wrap({ body: { category: 'FEE', channel: 'PUSH', enabled: true, userId: 'someone-else' } }),
      ).success,
    ).toBe(false);
  });
});

describe('registerPushTokenSchema', () => {
  const token = 'f'.repeat(140);

  it('defaults the platform to the web, which is all the client registers', () => {
    const result = registerPushTokenSchema.safeParse(wrap({ body: { token } }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.platform).toBe('WEB');
  });

  it('refuses a token longer than the column can hold', () => {
    expect(
      registerPushTokenSchema.safeParse(wrap({ body: { token: 'f'.repeat(513) } })).success,
    ).toBe(false);
  });

  it('refuses an obviously truncated token', () => {
    expect(registerPushTokenSchema.safeParse(wrap({ body: { token: 'abc' } })).success).toBe(false);
  });
});
