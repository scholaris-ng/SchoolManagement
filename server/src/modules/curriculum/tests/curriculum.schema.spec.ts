import {
  fetchCurriculaSchema,
  fetchLessonNotesSchema,
  fetchSchemesSchema,
} from '../validators/curriculum.schema';
import { fetchCalendarSchema } from '../../calendar/validators/calendar.schema';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

describe('fetchCurriculaSchema', () => {
  it('accepts the ALL sentinel for looking across previous years', () => {
    expect(fetchCurriculaSchema.safeParse(wrap({ query: { sessionId: 'ALL' } })).success).toBe(
      true,
    );
  });

  it('refuses a session that is neither ALL nor a uuid', () => {
    expect(fetchCurriculaSchema.safeParse(wrap({ query: { sessionId: '2025' } })).success).toBe(
      false,
    );
  });
});

describe('scheme and lesson-note statuses', () => {
  it('lets a lesson note come back to its author', () => {
    expect(fetchLessonNotesSchema.safeParse(wrap({ query: { status: 'RETURNED' } })).success).toBe(
      true,
    );
  });

  it('does not let a scheme of work be returned', () => {
    // A scheme is drafted, submitted and approved. There is no state in which
    // it goes back, and the two enums must not drift into each other.
    expect(fetchSchemesSchema.safeParse(wrap({ query: { status: 'RETURNED' } })).success).toBe(
      false,
    );
  });

  it('sorts notes newest-first and schemes ascending by default', () => {
    const notes = fetchLessonNotesSchema.safeParse(wrap({}));
    const schemes = fetchSchemesSchema.safeParse(wrap({}));
    expect(notes.success && notes.data.query.sortDir).toBe('desc');
    expect(schemes.success && schemes.data.query.sortDir).toBe('asc');
  });
});

describe('fetchCalendarSchema', () => {
  it('refuses a window that ends before it starts', () => {
    expect(
      fetchCalendarSchema.safeParse(wrap({ query: { from: '2026-01-01', to: '2025-01-01' } }))
        .success,
    ).toBe(false);
  });

  it('accepts a half-open window', () => {
    expect(fetchCalendarSchema.safeParse(wrap({ query: { from: '2025-09-01' } })).success).toBe(
      true,
    );
  });
});
