import { Outlet } from 'react-router-dom';
import { RequirePermission } from '@/components/guards/permission-gate';
import type { PermissionRequirement } from '@/lib/permissions';

/**
 * Wraps a subtree in a route-level permission check.
 *
 * This mirrors the sidebar's filtering so a deep-linked or bookmarked URL
 * refuses cleanly instead of rendering a page whose every request then 403s.
 * The API remains the authority (spec section 5).
 */
export function guarded(requirement: PermissionRequirement) {
  return (
    <RequirePermission require={requirement}>
      <Outlet />
    </RequirePermission>
  );
}
