import { describe, expect, it } from 'vitest';
import { matchRoutes, type RouteObject } from 'react-router-dom';
import { router } from './router';
import { NAV_SECTIONS, QUICK_ACTIONS } from './navigation';
import { PERMISSIONS, type Permission } from '@/types/rbac';
import type { PermissionRequirement } from '@/lib/permissions';

/**
 * Navigation integrity.
 *
 * The sidebar, the command palette and the route tree are three separate
 * lists that have to agree. A link to a route that no longer exists lands the
 * user on "page not found"; a route guarded by a permission the sidebar does
 * not check hands them an access-denied page they were invited to open.
 */

const routes = router.routes as RouteObject[];

function resolves(path: string): boolean {
  const matches = matchRoutes(routes, path);
  if (!matches) return false;
  // The catch-all `*` matches everything, so a hit on it is a miss.
  return !matches.some((match) => match.route.path === '*');
}

function requiredPermissions(requirement: PermissionRequirement | undefined): Permission[] {
  if (!requirement) return [];
  if (typeof requirement === 'string') return [requirement];
  if (Array.isArray(requirement)) return requirement;
  if ('anyOf' in requirement) return requirement.anyOf;
  return requirement.allOf;
}

describe('navigation', () => {
  const navItems = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.label })),
  );

  it.each(navItems.map((item) => [`${item.section} › ${item.label}`, item.to] as const))(
    'sidebar link %s (%s) resolves to a route',
    (_label, to) => {
      expect(resolves(to)).toBe(true);
    },
  );

  it.each(QUICK_ACTIONS.map((action) => [action.label, action.to] as const))(
    'quick action %s (%s) resolves to a route',
    (_label, to) => {
      expect(resolves(to)).toBe(true);
    },
  );

  it('only guards navigation with permissions that actually exist', () => {
    const known = new Set<string>(PERMISSIONS);
    const used = [
      ...navItems.flatMap((item) => requiredPermissions(item.require)),
      ...QUICK_ACTIONS.flatMap((action) => requiredPermissions(action.require)),
    ];

    // A typo here silently hides a whole section from everyone.
    for (const permission of used) {
      expect(known.has(permission), `unknown permission "${permission}"`).toBe(true);
    }
  });

  it('gives every sidebar entry a distinct destination', () => {
    const destinations = navItems.map((item) => item.to);
    // `/family/finance` is intentionally listed twice — once for parents under
    // Finance — so compare on label+destination pairs instead of bare paths.
    const pairs = navItems.map((item) => `${item.label}::${item.to}`);
    expect(new Set(pairs).size).toBe(destinations.length);
  });

  it('routes the known deep-linked pages, not just the top level', () => {
    for (const path of [
      '/students/stu_1',
      '/students/stu_1/edit',
      '/guardians/gdn_1',
      '/admissions/adm_1',
      '/report-cards/stu_1/trm_1',
      '/transcripts/stu_1',
      '/finance/invoices/inv_1',
      '/finance/receipts/pay_1',
      '/cbt/attempts/att_1',
      '/discipline/inc_1',
      '/family/stu_1',
      '/family/finance',
      '/profile/notifications',
      '/settings/roles',
      '/settings/website',
      '/audit',
      '/analytics/retention',
      '/verify/BRF-ab12-1',
      '/s/brightfield',
    ]) {
      expect(resolves(path), `${path} did not resolve`).toBe(true);
    }
  });

  it('still falls through to a not-found page for an unknown address', () => {
    expect(resolves('/definitely-not-a-page')).toBe(false);
  });
});
