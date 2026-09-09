import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { ProfileEndpoints } from './profile.endpoints';
import type { UpdateProfileInput } from './profile.endpoints';

export type { UpdateProfileInput };

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
    mutationFn: (values: UpdateProfileInput) => ProfileEndpoints.update(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Profile updated');
    },
  });
}
