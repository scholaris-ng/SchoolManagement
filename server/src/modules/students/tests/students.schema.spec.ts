import {
  changeStatusSchema,
  createStudentSchema,
  fetchStudentsSchema,
  promoteStudentsSchema,
} from '../validators/students.schema';

const CLASS_ID = '11111111-2222-4333-8444-555555555555';

const valid = {
  admissionNo: 'BFA/2025/001',
  firstName: 'Amara',
  lastName: 'Okafor',
  gender: 'FEMALE' as const,
  dateOfBirth: '2013-04-11',
  admissionDate: '2025-09-08',
  currentClassId: CLASS_ID,
};

const wrap = (body: unknown) => ({ body, query: {}, params: {} });

describe('createStudentSchema', () => {
  it('accepts a complete record and defaults photo consent to false', () => {
    const result = createStudentSchema.safeParse(wrap(valid));
    expect(result.success).toBe(true);
    // Nothing publishes a child's photograph until somebody actively says yes
    // (spec section 41), so the default must be false rather than absent.
    if (result.success) expect(result.data.body.photoConsent).toBe(false);
  });

  it('rejects a date of birth in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(createStudentSchema.safeParse(wrap({ ...valid, dateOfBirth: future })).success).toBe(
      false,
    );
  });

  it('rejects a date of birth implying an implausible age', () => {
    expect(
      createStudentSchema.safeParse(wrap({ ...valid, dateOfBirth: '1970-01-01' })).success,
    ).toBe(false);
  });

  it('rejects an admission number with unsafe characters', () => {
    expect(
      createStudentSchema.safeParse(wrap({ ...valid, admissionNo: 'BFA 2025;DROP' })).success,
    ).toBe(false);
    // Slashes and hyphens are how schools actually write them.
    expect(
      createStudentSchema.safeParse(wrap({ ...valid, admissionNo: 'BFA/2025-001_A' })).success,
    ).toBe(true);
  });

  it('requires a class', () => {
    const { currentClassId: _omitted, ...withoutClass } = valid;
    expect(createStudentSchema.safeParse(wrap(withoutClass)).success).toBe(false);
  });

  it('rejects unknown fields rather than ignoring them', () => {
    // `.strict()` matters: silently dropping `status` would let a caller
    // believe they had set something the server never saw.
    expect(createStudentSchema.safeParse(wrap({ ...valid, status: 'GRADUATED' })).success).toBe(
      false,
    );
  });
});

describe('changeStatusSchema', () => {
  const params = { id: CLASS_ID };
  const base = { status: 'WITHDRAWN' as const, effectiveDate: '2026-03-01' };

  it('requires a reason for anything other than returning to ACTIVE', () => {
    expect(
      changeStatusSchema.safeParse({ params, body: base, query: {} }).success,
    ).toBe(false);
    expect(
      changeStatusSchema.safeParse({
        params,
        body: { ...base, reason: 'Family relocating' },
        query: {},
      }).success,
    ).toBe(true);
  });

  it('lets a return to ACTIVE go through without one', () => {
    expect(
      changeStatusSchema.safeParse({
        params,
        body: { status: 'ACTIVE', effectiveDate: '2026-03-01' },
        query: {},
      }).success,
    ).toBe(true);
  });

  it('requires a destination when a student transfers out', () => {
    expect(
      changeStatusSchema.safeParse({
        params,
        body: { status: 'TRANSFERRED', effectiveDate: '2026-03-01', reason: 'Moving' },
        query: {},
      }).success,
    ).toBe(false);

    expect(
      changeStatusSchema.safeParse({
        params,
        body: {
          status: 'TRANSFERRED',
          effectiveDate: '2026-03-01',
          reason: 'Moving',
          destinationSchool: 'Rivercrest School',
        },
        query: {},
      }).success,
    ).toBe(true);
  });
});

describe('fetchStudentsSchema', () => {
  it('applies sensible paging defaults', () => {
    const result = fetchStudentsSchema.safeParse({ query: {}, body: {}, params: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.pageSize).toBe(25);
      expect(result.data.query.sortDir).toBe('asc');
    }
  });

  it('caps the page size so one request cannot pull the whole roll', () => {
    const result = fetchStudentsSchema.safeParse({
      query: { pageSize: '5000' },
      body: {},
      params: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('promoteStudentsSchema', () => {
  it('defaults the exception lists to empty', () => {
    const result = promoteStudentsSchema.safeParse(
      wrap({
        sessionId: CLASS_ID,
        nextSessionId: CLASS_ID,
        fromClassId: CLASS_ID,
        toClassId: CLASS_ID,
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      // Everyone moves up unless explicitly held back or graduated.
      expect(result.data.body.repeatStudentIds).toEqual([]);
      expect(result.data.body.graduateStudentIds).toEqual([]);
    }
  });
});
