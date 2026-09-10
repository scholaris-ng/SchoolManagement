import { scoped, type Scope } from './query-scope';
import { peopleKeys } from './query-keys-people';
import { teachingKeys } from './query-keys-teaching';
import { engagementKeys } from './query-keys-engagement';

/**
 * The cache-key registry.
 *
 * Grouped into sibling files by area so none outgrows the limit in section 17
 * of the frontend guide. Every key is namespaced by the active school, which
 * is the client-side half of the tenant-isolation guarantee.
 */
export { scoped, type Scope } from './query-scope';

export const queryKeys = {
  session: () => ['session'] as const,

  /**
   * Every cached query for one school — the prefix `scoped()` builds every
   * other key from. React Query matches a query key by prefix, so
   * invalidating this evicts everything below it in one call. Use it for a
   * change with no fixed blast radius, such as which term is current: that
   * drives attendance, results, invoicing, the timetable and every
   * dashboard, and enumerating each of those keys individually is exactly
   * how one gets missed.
   */
  all: (schoolId: Scope) => scoped(schoolId),

  ...peopleKeys,
  ...teachingKeys,
  ...engagementKeys,
} as const;
