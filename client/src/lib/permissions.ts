import type { Permission, PersonaKey, RoleName } from '@/types/rbac';
import { ROLE_PERSONA } from '@/types/rbac';
import type { SchoolMembership } from '@/types/tenant';

/**
 * Permission evaluation for the UI layer.
 *
 * This exists purely to decide what to *show*. Every one of these checks is
 * repeated server-side; a user who forges their way past this gains nothing.
 */

export type PermissionRequirement =
  | Permission
  | Permission[]
  | { anyOf: Permission[] }
  | { allOf: Permission[] };

export function hasPermission(
  granted: readonly Permission[] | undefined,
  permission: Permission,
): boolean {
  if (!granted || granted.length === 0) return false;
  // `platform.manage` is the platform-operator escape hatch and implies all.
  return granted.includes(permission) || granted.includes('platform.manage');
}

export function hasAnyPermission(
  granted: readonly Permission[] | undefined,
  permissions: readonly Permission[],
): boolean {
  if (permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(granted, permission));
}

export function hasAllPermissions(
  granted: readonly Permission[] | undefined,
  permissions: readonly Permission[],
): boolean {
  if (permissions.length === 0) return true;
  return permissions.every((permission) => hasPermission(granted, permission));
}

export function satisfies(
  granted: readonly Permission[] | undefined,
  requirement: PermissionRequirement | undefined,
): boolean {
  if (!requirement) return true;
  if (typeof requirement === 'string') return hasPermission(granted, requirement);
  if (Array.isArray(requirement)) return hasAnyPermission(granted, requirement);
  if ('anyOf' in requirement) return hasAnyPermission(granted, requirement.anyOf);
  return hasAllPermissions(granted, requirement.allOf);
}

export function hasRole(membership: SchoolMembership | null, role: RoleName): boolean {
  return Boolean(membership?.roles.includes(role));
}

/**
 * Which dashboard a user lands on. Staff roles win over parent/student when a
 * person holds both (a teacher whose own child attends the school).
 */
export function resolvePersona(membership: SchoolMembership | null): PersonaKey {
  if (!membership || membership.roles.length === 0) return 'parent';
  const order: PersonaKey[] = ['admin', 'bursar', 'teacher', 'parent', 'student'];
  const personas = membership.roles.map((role) => ROLE_PERSONA[role]).filter(Boolean);
  for (const persona of order) {
    if (personas.includes(persona)) return persona;
  }
  return 'parent';
}

export function membershipLabel(membership: SchoolMembership | null): string {
  if (!membership) return '';
  const names = [
    ...membership.roles.map((role) => role.replace(/_/g, ' ').toLowerCase()),
    ...membership.customRoleNames.map((name) => name.toLowerCase()),
  ];
  if (names.length === 0) return 'Member';
  const label = names[0];
  const capitalised = label.charAt(0).toUpperCase() + label.slice(1);
  return names.length > 1 ? `${capitalised} +${names.length - 1}` : capitalised;
}
