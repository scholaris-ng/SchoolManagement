import { fetchStaffSchema, staffIdParamSchema } from '../validators/staff.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

describe('fetchStaffSchema', () => {
  it('defaults to the first page, sorted ascending', () => {
    const result = fetchStaffSchema.safeParse(wrap({}));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.sortDir).toBe('asc');
    }
  });

  it('accepts the three filters the staff list offers', () => {
    const result = fetchStaffSchema.safeParse(
      wrap({
        query: { status: 'ON_LEAVE', employmentType: 'PART_TIME', department: 'Sciences' },
      }),
    );
    expect(result.success).toBe(true);
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
