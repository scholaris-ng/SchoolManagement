import { z } from 'zod';

/**
 * A calendar date the way a query string and an `<input type="date">` both
 * write it.
 *
 * The round trip is what refuses `2026-02-31`: the pattern alone lets it
 * through, and PostgreSQL would then fail the `::date` cast with a 500 rather
 * than a message the person can act on. Years are held to 19xx and 20xx for the
 * same reason — `0000-01-01` is a valid ISO date and not a valid PostgreSQL one.
 */
export const calendarDate = z
  .string()
  .regex(/^(19|20)\d{2}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form')
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, 'That date does not exist');

/**
 * The interval a list can be narrowed to, both ends inclusive and either end
 * optional — "everything since the 1st" is as good a question as "September".
 * Spread into a list's query object, then close it with `periodIsOrdered`.
 */
export const periodQueryFields = {
  dateFrom: calendarDate.optional(),
  dateTo: calendarDate.optional(),
};

/** ISO dates sort as text, so no parsing is needed to compare them. */
export function periodIsOrdered(query: { dateFrom?: string; dateTo?: string }): boolean {
  return !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo;
}

export const PERIOD_ORDER_ISSUE = {
  message: 'The start date must not be after the end date',
  path: ['dateTo'],
};
