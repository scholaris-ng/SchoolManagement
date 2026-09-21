import { DEFAULT_TIMEZONE, resolveTimezone } from './timezone';

describe('resolveTimezone', () => {
  it('keeps a named zone as it is', () => {
    expect(resolveTimezone('Africa/Accra')).toBe('Africa/Accra');
    expect(resolveTimezone('America/Argentina/Buenos_Aires')).toBe('America/Argentina/Buenos_Aires');
  });

  it('keeps UTC', () => {
    expect(resolveTimezone('UTC')).toBe('UTC');
  });

  it('trims stray whitespace from a hand-typed setting', () => {
    expect(resolveTimezone('  Africa/Lagos ')).toBe('Africa/Lagos');
  });

  it('falls back when the school has no setting', () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone('')).toBe(DEFAULT_TIMEZONE);
  });

  it('falls back on a name that looks like a zone but is not one, rather than failing the query', () => {
    expect(resolveTimezone('Nowhere/Land')).toBe(DEFAULT_TIMEZONE);
  });

  it('falls back on a bare offset, which PostgreSQL would read with the opposite sign', () => {
    expect(resolveTimezone('+01:00')).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone('GMT+1')).toBe(DEFAULT_TIMEZONE);
  });

  it('falls back on anything that could carry more than a name', () => {
    expect(resolveTimezone("Africa/Lagos'; DROP TABLE payments;--")).toBe(DEFAULT_TIMEZONE);
  });
});
