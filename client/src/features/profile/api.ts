import { useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import type { AuthenticatedUser } from '@/types/tenant';

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string | null;
  photoUrl?: string | null;
}

/**
 * The signed-in user's own record.
 *
 * Deliberately narrow: a user may edit how they are named and reached, never
 * their memberships, roles or permissions. Those are granted by a school
 * administrator and only ever change server-side (spec section 5).
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: UpdateProfileInput) => http.patch<AuthenticatedUser>('/users/me', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Profile updated');
    },
  });
}
