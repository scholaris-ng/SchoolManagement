import { generateCode, hashCode } from '../repositories/emailVerification.repository';
import {
  registerSchoolSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '../validators/registration.schema';

const valid = {
  firstName: 'Ngozi',
  lastName: 'Adeleke',
  schoolName: 'Harmony International College',
  email: 'Ngozi@Harmony.edu.NG',
  password: 'correct-horse-battery',
};

describe('registerSchoolSchema', () => {
  it('accepts a complete registration and normalises the email', () => {
    const result = registerSchoolSchema.safeParse({ body: valid, query: {}, params: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      // Lower-cased at the edge, so the duplicate check and later sign-in agree
      // on what "the same address" means.
      expect(result.data.body.email).toBe('ngozi@harmony.edu.ng');
    }
  });

  it('trims surrounding whitespace from names', () => {
    const result = registerSchoolSchema.safeParse({
      body: { ...valid, firstName: '  Ngozi  ', schoolName: '  Harmony  ' },
      query: {},
      params: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.firstName).toBe('Ngozi');
      expect(result.data.body.schoolName).toBe('Harmony');
    }
  });

  it.each([
    ['a missing first name', { firstName: '' }],
    ['a missing last name', { lastName: '' }],
    ['a one-character school name', { schoolName: 'H' }],
    ['a malformed email', { email: 'not-an-email' }],
    ['a password under eight characters', { password: 'short12' }],
    ['a password of one repeated character', { password: 'aaaaaaaaaa' }],
  ])('rejects %s', (_label, override) => {
    const result = registerSchoolSchema.safeParse({
      body: { ...valid, ...override },
      query: {},
      params: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields rather than ignoring them', () => {
    // `.strict()` matters here: silently dropping an extra key is how a client
    // ends up believing it set something the server never saw.
    const result = registerSchoolSchema.safeParse({
      body: { ...valid, isPlatformAdmin: true },
      query: {},
      params: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('verifyEmailSchema', () => {
  it('accepts a six-digit code', () => {
    const result = verifyEmailSchema.safeParse({
      body: { email: 'a@b.ng', code: '012345' },
      query: {},
      params: {},
    });
    expect(result.success).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects %p', (code) => {
    const result = verifyEmailSchema.safeParse({
      body: { email: 'a@b.ng', code },
      query: {},
      params: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('resendVerificationSchema', () => {
  it('takes only an email address', () => {
    expect(
      resendVerificationSchema.safeParse({ body: { email: 'a@b.ng' }, query: {}, params: {} })
        .success,
    ).toBe(true);
    expect(
      resendVerificationSchema.safeParse({
        body: { email: 'a@b.ng', code: '123456' },
        query: {},
        params: {},
      }).success,
    ).toBe(false);
  });
});

describe('verification codes', () => {
  it('are always six digits, including leading zeroes', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it('vary between calls', () => {
    const codes = new Set(Array.from({ length: 200 }, generateCode));
    // A generator stuck on one value would produce a single entry.
    expect(codes.size).toBeGreaterThan(150);
  });

  it('hash to a stable 64-character digest', () => {
    expect(hashCode('123456')).toHaveLength(64);
    expect(hashCode('123456')).toBe(hashCode('123456'));
    expect(hashCode('123456')).not.toBe(hashCode('123457'));
  });

  it('never store the code itself', () => {
    // The whole point of hashing: the digest must not contain the input.
    expect(hashCode('123456')).not.toContain('123456');
  });
});
