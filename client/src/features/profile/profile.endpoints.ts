import { http } from '@/lib/http';
import type { AuthenticatedUser } from '@/types/tenant';

/**
 * The name is sent as its two parts, never as the joined string. The user
 * row stores all three, and editing only the joined one left the parts
 * behind — which is what anything grouping or sorting people reads.
 */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  photoUrl?: string | null;
}

/** Endpoint layer for the signed-in user's own record. */
export const ProfileEndpoints = {
  update: (values: UpdateProfileInput) => http.patch<AuthenticatedUser>('/users/me', values),
};
