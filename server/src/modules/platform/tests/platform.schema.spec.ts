import { activateSchoolSchema, MAX_ACTIVATION_MONTHS } from '../validators/platform.schema';

const ID = '3f1c1e60-1f2a-4c9b-9a01-2b7d4e5f6a01';
const parse = (body: unknown) => activateSchoolSchema.safeParse({ params: { id: ID }, body });

describe('activateSchoolSchema', () => {
  it('takes the number of months asked for', () => {
    for (const months of [1, 3, 12, 36, MAX_ACTIVATION_MONTHS]) {
      const result = parse({ months });
      expect(result.success && result.data.body.months).toBe(months);
    }
  });

  it('reads a number sent as text, the way a form field arrives', () => {
    const result = parse({ months: '6' });
    expect(result.success && result.data.body.months).toBe(6);
  });

  it('gives one month when none is named, so an older client keeps working', () => {
    const empty = parse({});
    expect(empty.success && empty.data.body.months).toBe(1);

    const absent = activateSchoolSchema.safeParse({ params: { id: ID } });
    expect(absent.success && absent.data.body.months).toBe(1);
  });

  it.each([
    ['zero', 0, /at least 1 month/],
    ['a negative number', -3, /at least 1 month/],
    ['a fraction', 1.5, /whole number/],
    ['more than the limit', MAX_ACTIVATION_MONTHS + 1, /at most 120 months/],
    ['a slipped digit', 1200, /at most 120 months/],
    ['text', 'many', /number of months/],
  ])('refuses %s', (_label, months, message) => {
    const result = parse({ months });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(message);
  });

  it('refuses anything else in the body', () => {
    expect(parse({ months: 1, extra: true }).success).toBe(false);
  });

  it('refuses an id that is not a UUID', () => {
    expect(activateSchoolSchema.safeParse({ params: { id: 'nope' }, body: {} }).success).toBe(false);
  });
});
