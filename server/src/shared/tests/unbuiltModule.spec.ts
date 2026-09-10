import { placeholderListSchema } from '../placeholder/unbuiltModule';

const wrap = (query: unknown) => ({ body: {}, query, params: {} });

describe('placeholderListSchema', () => {
  it('defaults to the first page at the shared page size', () => {
    const result = placeholderListSchema.safeParse(wrap({}));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.pageSize).toBe(25);
    }
  });

  it('still enforces the page bounds that shape the response envelope', () => {
    expect(placeholderListSchema.safeParse(wrap({ pageSize: '201' })).success).toBe(false);
    expect(placeholderListSchema.safeParse(wrap({ pageSize: '0' })).success).toBe(false);
    expect(placeholderListSchema.safeParse(wrap({ page: '0' })).success).toBe(false);
  });

  it('accepts filters it cannot yet check against a catalogue', () => {
    // There is nothing to filter, and inventing an enum here would mean
    // guessing the one the real module will define.
    const result = placeholderListSchema.safeParse(
      wrap({ status: 'UNPAID', classId: 'anything', overdueOnly: 'true' }),
    );
    expect(result.success).toBe(true);
  });

  it('still bounds the length of a filter it passes through', () => {
    expect(placeholderListSchema.safeParse(wrap({ search: 'x'.repeat(201) })).success).toBe(false);
  });
});
