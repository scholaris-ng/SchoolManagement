import {
  createStaffSchema,
  fetchStaffSchema,
  staffIdParamSchema,
  updateStaffSchema,
} from '../validators/staff.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

const validStaffBody = {
  staffNo: 'STF-0001',
  firstName: 'Funmilayo',
  lastName: 'Adeyemi',
  email: 'Funmilayo.Adeyemi@example.com',
  phone: '+234 803 555 1212',
  gender: 'FEMALE',
  designation: 'Mathematics teacher',
  employmentType: 'FULL_TIME',
  employmentDate: '2026-01-05',
  status: 'ACTIVE',
  roleNames: ['TEACHER'],
};

describe('fetchStaffSchema', () => {
  it('defaults to the first page, sorted ascending', () => {
    const result = fetchStaffSchema.safeParse(wrap({}));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.sortDir).toBe('asc');
    }
  });

  it('accepts the filters the staff list offers', () => {
    const result = fetchStaffSchema.safeParse(
      wrap({
        query: {
          status: 'ON_LEAVE',
          employmentType: 'PART_TIME',
          department: 'Sciences',
          classId: '11111111-2222-4333-8444-555555555555',
          subjectId: '99999999-8888-4777-8666-555555555555',
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('refuses a class or subject filter that is not a uuid', () => {
    expect(fetchStaffSchema.safeParse(wrap({ query: { classId: 'jss-1' } })).success).toBe(false);
    expect(fetchStaffSchema.safeParse(wrap({ query: { subjectId: 'maths' } })).success).toBe(
      false,
    );
  });

  it('refuses an employment status the entity does not define', () => {
    expect(fetchStaffSchema.safeParse(wrap({ query: { status: 'RETIRED' } })).success).toBe(false);
  });

  it('refuses a page size beyond the shared ceiling', () => {
    expect(fetchStaffSchema.safeParse(wrap({ query: { pageSize: '5000' } })).success).toBe(false);
  });

  it('refuses a page size of zero', () => {
    // A caller meaning "fetch nothing" must disable the query, not ask for an
    // empty page — an OFFSET/LIMIT of zero rows is not a request worth making.
    expect(fetchStaffSchema.safeParse(wrap({ query: { pageSize: '0' } })).success).toBe(false);
  });
});

describe('staffIdParamSchema', () => {
  it('refuses an id that is not a uuid before it reaches a query', () => {
    expect(staffIdParamSchema.safeParse(wrap({ params: { id: 'funmilayo' } })).success).toBe(
      false,
    );
  });
});

describe('createStaffSchema', () => {
  it('accepts a full body and lowercases the email', () => {
    const result = createStaffSchema.safeParse(wrap({ body: validStaffBody }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.email).toBe('funmilayo.adeyemi@example.com');
      expect(result.data.body.isFormTeacher).toBe(false);
      expect(result.data.body.subjectIds).toEqual([]);
    }
  });

  it('refuses a role this endpoint does not hand out', () => {
    // SUPER_ADMIN is platform-only; PARENT and STUDENT come from the guardian
    // and student flows, not from typing a role name into this form.
    for (const role of ['SUPER_ADMIN', 'PARENT', 'STUDENT']) {
      const result = createStaffSchema.safeParse(
        wrap({ body: { ...validStaffBody, roleNames: [role] } }),
      );
      expect(result.success).toBe(false);
    }
  });

  it('refuses no roles at all', () => {
    const result = createStaffSchema.safeParse(wrap({ body: { ...validStaffBody, roleNames: [] } }));
    expect(result.success).toBe(false);
  });

  it('refuses a field the entity does not define', () => {
    const result = createStaffSchema.safeParse(
      wrap({ body: { ...validStaffBody, salary: 500000 } }),
    );
    expect(result.success).toBe(false);
  });

  it('refuses an unparseable phone number', () => {
    const result = createStaffSchema.safeParse(
      wrap({ body: { ...validStaffBody, phone: 'call me' } }),
    );
    expect(result.success).toBe(false);
  });
});

describe('updateStaffSchema', () => {
  it('accepts a partial patch', () => {
    const result = updateStaffSchema.safeParse(
      wrap({ params: { id: '11111111-1111-1111-1111-111111111111' }, body: { status: 'ON_LEAVE' } }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch', () => {
    const result = updateStaffSchema.safeParse(
      wrap({ params: { id: '11111111-1111-1111-1111-111111111111' }, body: {} }),
    );
    expect(result.success).toBe(true);
  });

  it('refuses an id that is not a uuid', () => {
    const result = updateStaffSchema.safeParse(
      wrap({ params: { id: 'not-a-uuid' }, body: { status: 'ON_LEAVE' } }),
    );
    expect(result.success).toBe(false);
  });
});
