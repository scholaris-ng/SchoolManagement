import { describe, expect, it } from 'vitest';
import { teachingWeeksBetween } from './weekdays';

/**
 * Teaching weeks are what a scheme of work is spread across, so this number
 * has to follow the term's dates rather than be typed in beside them.
 */
describe('teachingWeeksBetween', () => {
  it('counts a whole Monday-to-Friday week as one', () => {
    expect(teachingWeeksBetween('2024-09-09', '2024-09-13')).toBe(1);
  });

  it('ignores the weekend on either end', () => {
    // Sunday to Saturday around one teaching week is still one week.
    expect(teachingWeeksBetween('2024-09-08', '2024-09-14')).toBe(1);
  });

  it('adds up consecutive weeks', () => {
    expect(teachingWeeksBetween('2024-09-09', '2024-09-20')).toBe(2);
    expect(teachingWeeksBetween('2024-09-09', '2024-09-27')).toBe(3);
  });

  it('handles a term that starts mid-week', () => {
    // Wednesday to the Friday of the following week: 3 + 5 = 8 weekdays.
    expect(teachingWeeksBetween('2024-09-11', '2024-09-20')).toBe(2);
  });

  it('gives a full Nigerian first term its usual length', () => {
    // 9 September to 13 December 2024, the dates the seed uses.
    expect(teachingWeeksBetween('2024-09-09', '2024-12-13')).toBe(14);
  });

  it('never returns less than one week for a valid range', () => {
    // A single Saturday has no weekdays in it at all.
    expect(teachingWeeksBetween('2024-09-14', '2024-09-14')).toBe(1);
    expect(teachingWeeksBetween('2024-09-09', '2024-09-09')).toBe(1);
  });

  it('returns zero for missing or backwards dates', () => {
    expect(teachingWeeksBetween('', '2024-12-13')).toBe(0);
    expect(teachingWeeksBetween('2024-09-09', '')).toBe(0);
    expect(teachingWeeksBetween(null, undefined)).toBe(0);
    expect(teachingWeeksBetween('2024-12-13', '2024-09-09')).toBe(0);
  });

  it('does not shift with the timezone the browser is in', () => {
    // Parsed as local midnight, not UTC, so a machine west of Greenwich does
    // not lose the first day of term.
    expect(teachingWeeksBetween('2024-09-09', '2024-09-13')).toBe(1);
    expect(teachingWeeksBetween('2025-01-06', '2025-04-04')).toBe(13);
  });
});
