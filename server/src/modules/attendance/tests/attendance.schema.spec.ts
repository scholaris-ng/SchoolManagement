import { fetchRegisterSchema, saveRegisterSchema } from '../validators/attendance.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

const CLASS_ID = '11111111-2222-4333-8444-555555555555';
const STUDENT_ID = '99999999-8888-4777-8666-555555555555';
const OTHER_STUDENT_ID = '22222222-3333-4444-8555-666666666666';

describe('fetchRegisterSchema', () => {
  it('accepts a class and a day', () => {
    expect(
      fetchRegisterSchema.safeParse(wrap({ query: { classId: CLASS_ID, date: '2026-09-11' } }))
        .success,
    ).toBe(true);
  });

  it('refuses a date that is not in YYYY-MM-DD form', () => {
    expect(
      fetchRegisterSchema.safeParse(wrap({ query: { classId: CLASS_ID, date: '11/09/2026' } }))
        .success,
    ).toBe(false);
  });

  it('refuses a register with no class named', () => {
    expect(fetchRegisterSchema.safeParse(wrap({ query: { date: '2026-09-11' } })).success).toBe(
      false,
    );
  });
});

describe('saveRegisterSchema', () => {
  const body = (marks: unknown[]) => ({ classId: CLASS_ID, date: '2026-09-11', marks });

  it('accepts a marked register and defaults the optional fields', () => {
    const result = saveRegisterSchema.safeParse(
      wrap({ body: body([{ studentId: STUDENT_ID, status: 'PRESENT' }]) }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.marks[0]).toEqual({
        studentId: STUDENT_ID,
        status: 'PRESENT',
        reason: null,
        note: null,
      });
    }
  });

  it('drops a reason attached to a pupil who was not absent', () => {
    // A stale reason can arrive from a replayed offline queue; it must never be
    // stored against a child who was in class all day.
    const result = saveRegisterSchema.safeParse(
      wrap({ body: body([{ studentId: STUDENT_ID, status: 'LATE', reason: 'SICK' }]) }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.marks[0].reason).toBeNull();
  });

  it('keeps the reason on an absence', () => {
    const result = saveRegisterSchema.safeParse(
      wrap({
        body: body([{ studentId: STUDENT_ID, status: 'ABSENT', reason: 'TRANSPORT' }]),
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.marks[0].reason).toBe('TRANSPORT');
  });

  it('refuses the same pupil marked twice', () => {
    expect(
      saveRegisterSchema.safeParse(
        wrap({
          body: body([
            { studentId: STUDENT_ID, status: 'PRESENT' },
            { studentId: STUDENT_ID, status: 'ABSENT' },
          ]),
        }),
      ).success,
    ).toBe(false);
  });

  it('accepts several pupils at once', () => {
    expect(
      saveRegisterSchema.safeParse(
        wrap({
          body: body([
            { studentId: STUDENT_ID, status: 'PRESENT' },
            { studentId: OTHER_STUDENT_ID, status: 'EXCUSED', note: 'Hospital appointment' },
          ]),
        }),
      ).success,
    ).toBe(true);
  });

  it('refuses a status the register does not define', () => {
    expect(
      saveRegisterSchema.safeParse(wrap({ body: body([{ studentId: STUDENT_ID, status: 'SICK' }]) }))
        .success,
    ).toBe(false);
  });

  it('refuses an empty register', () => {
    expect(saveRegisterSchema.safeParse(wrap({ body: body([]) })).success).toBe(false);
  });
});
