import { useAuth } from '@/app/providers/auth-provider';
import { activationMailto, isLocked, viewAccess } from './school-access';

/** The active school's access, ready to draw — or `null` before anyone is signed in to one. */
export function useSchoolAccess() {
  const { user, membership } = useAuth();
  // No `access` means an API that predates it — see `isLocked`.
  if (!membership?.access) return null;

  return {
    ...viewAccess(membership.access),
    locked: isLocked(user, membership),
    membership,
    mailto: membership.access.contactEmail
      ? activationMailto({
          to: membership.access.contactEmail,
          schoolName: membership.schoolName,
          schoolSlug: membership.schoolSlug,
          userEmail: user?.email,
          plan: membership.access.plan,
        })
      : null,
  };
}
