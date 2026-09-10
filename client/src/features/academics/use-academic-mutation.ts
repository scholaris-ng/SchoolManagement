import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';

/**
 * Every academic write follows the same shape: call an endpoint, invalidate the
 * caches it can affect, confirm it. This factory holds that once so each
 * mutation below is only its request and its blast radius.
 */
/** Writes to the academic structure, each invalidating what it can affect. */

export function useAcademicMutation<TInput, TResult>(config: {
  request: (input: TInput) => Promise<TResult>;
  invalidate: (schoolId: string | null) => unknown[][];
  successMessage: string;
}) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: config.request,
    onSuccess: () => {
      config.invalidate(schoolId).forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
      toast.success(config.successMessage);
    },
  });
}
