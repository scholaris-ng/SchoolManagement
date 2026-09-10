/**
 * How many teaching weeks a term's dates cover.
 *
 * Counting Mondays to Fridays rather than dividing the span by seven is what
 * makes a term that starts on a Wednesday come out right: the part-weeks at each
 * end are counted as the days they actually contain, and a term cannot gain a
 * week by ending on a Saturday.
 *
 * The result is what a scheme of work spreads a syllabus across, so it is at
 * least one week for any valid range. Returns 0 when the dates are missing or
 * the end falls before the start.
 *
 * Mirrors `client/src/lib/weekdays.ts` — both sides must agree, since the client
 * shows the number while the server is what persists it.
 */
export function teachingWeeksBetween(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let weekdays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(1, Math.round(weekdays / 5));
}
