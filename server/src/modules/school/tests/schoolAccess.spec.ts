import { describeAccess } from '../services/schoolAccess';

const NOW = new Date('2026-09-18T12:00:00Z');
const at = (iso: string) => ({ status: 'TRIAL' as const, accessEndsAt: new Date(iso) });

describe('describeAccess', () => {
  it('is open, with the days left, before the end date', () => {
    const access = describeAccess(at('2026-09-30T12:00:00Z'), 'admin@example.com', NOW);

    expect(access).toEqual({
      plan: 'TRIAL',
      endsAt: '2026-09-30T12:00:00.000Z',
      expired: false,
      daysLeft: 12,
      contactEmail: 'admin@example.com',
    });
  });

  it('rounds a part-day up, so the last day still reads as a day', () => {
    expect(describeAccess(at('2026-09-18T12:00:01Z'), null, NOW).daysLeft).toBe(1);
    expect(describeAccess(at('2026-09-19T11:00:00Z'), null, NOW).daysLeft).toBe(1);
    expect(describeAccess(at('2026-09-19T12:00:01Z'), null, NOW).daysLeft).toBe(2);
  });

  it('closes at the very moment the end date arrives', () => {
    const exactly = describeAccess(at('2026-09-18T12:00:00Z'), null, NOW);
    expect(exactly.expired).toBe(true);
    expect(exactly.daysLeft).toBe(0);
  });

  it('is expired with no days left once the date has passed, however long ago', () => {
    const access = describeAccess(at('2026-01-01T00:00:00Z'), null, NOW);
    expect(access.expired).toBe(true);
    expect(access.daysLeft).toBe(0);
  });

  it('reports the plan the school is on, and nothing about it changes whether it is open', () => {
    const active = describeAccess({ status: 'ACTIVE', accessEndsAt: '2026-10-18T12:00:00Z' }, null, NOW);
    expect(active.plan).toBe('ACTIVE');
    expect(active.expired).toBe(false);

    // A paid school whose month has run out is locked exactly like a trial.
    const lapsed = describeAccess({ status: 'ACTIVE', accessEndsAt: '2026-09-01T00:00:00Z' }, null, NOW);
    expect(lapsed.plan).toBe('ACTIVE');
    expect(lapsed.expired).toBe(true);
  });

  it('takes the end date as text, the way a raw query may return it', () => {
    expect(describeAccess({ status: 'TRIAL', accessEndsAt: '2026-09-20T12:00:00Z' }, null, NOW).daysLeft).toBe(2);
  });
});
