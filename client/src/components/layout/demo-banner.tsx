import { FlaskConical } from 'lucide-react';
import { env } from '@/lib/env';

/**
 * A permanent, unmissable strip on demo deployments.
 *
 * A demo build serves seeded, fictional records from an in-browser mock API —
 * nothing is stored, nothing is sent anywhere, and every name in it is invented.
 * That has to be visible on every screen: a school portal full of plausible
 * children's records is exactly the sort of thing someone could otherwise
 * mistake for the real system.
 */
export function DemoBanner() {
  if (!env.isDemo) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-subtle px-4 py-1.5 text-center text-xs font-medium text-warning no-print"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        Demo — every student, guardian and payment here is invented, and nothing you
        change is saved.
      </span>
    </div>
  );
}
