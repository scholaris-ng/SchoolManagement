
/**
 * Every cache key is namespaced by the active school. Switching tenant can
 * therefore never surface another school's cached rows, which is the
 * client-side half of the tenant-isolation guarantee.
 */
export type Scope = string | null | undefined;

export const scoped = (schoolId: Scope, ...parts: unknown[]) => [
  'school',
  schoolId ?? 'none',
  ...parts,
];
