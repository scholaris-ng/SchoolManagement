import { http } from '@/lib/http';
import type { AuthenticatedUser } from '@/types/tenant';

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string | null;
  photoUrl?: string | null;
}

/** Endpoint layer for the signed-in user's own record. */
export const ProfileEndpoints = {
  update: (values: UpdateProfileInput) => http.patch<AuthenticatedUser>('/users/me', values),
};
