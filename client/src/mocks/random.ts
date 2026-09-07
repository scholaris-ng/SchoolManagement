/**
 * Deterministic pseudo-random helpers for the development seed.
 *
 * A fixed seed keeps demo data stable between reloads, which makes screenshots,
 * manual testing and bug reports reproducible.
 */
export function createRandom(seed = 20260907) {
  let state = seed >>> 0;

  const next = (): number => {
    // xorshift32 — small, fast, adequate for fixtures.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };

  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    pickMany: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const chosen: T[] = [];
      for (let i = 0; i < count && pool.length > 0; i += 1) {
        chosen.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return chosen;
    },
    bool: (probability = 0.5) => next() < probability,
    /** Normally-distributed score, clamped — produces believable mark spreads. */
    score: (mean: number, spread: number, min = 0, max = 100) => {
      const value = mean + (next() + next() + next() - 1.5) * spread;
      return Math.round(Math.min(max, Math.max(min, value)));
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Steps back over weekends, so seeded attendance lands on school days. */
export function previousSchoolDays(from: Date, count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  while (days.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days.reverse();
}
