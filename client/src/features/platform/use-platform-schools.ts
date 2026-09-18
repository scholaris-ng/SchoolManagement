import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/format';
import { toast } from '@/lib/toast-bus';
import { PlatformEndpoints } from './platform.endpoints';

export function usePlatformSchools() {
  return useQuery({
    queryKey: queryKeys.platform.schools(),
    queryFn: PlatformEndpoints.fetchSchools,
  });
}

export function useActivateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ schoolId, months }: { schoolId: string; months: number }) =>
      PlatformEndpoints.activateSchool(schoolId, months),
    onSuccess: async (school, { months }) => {
      toast.success(`${school.name} activated`, {
        description: `${months} month${months === 1 ? '' : 's'} added. Access now runs until ${formatDate(school.endsAt)}.`,
      });
      // Re-read rather than patch one row: the list is ordered by when each
      // school lapses, and this one has just moved.
      await queryClient.invalidateQueries({ queryKey: queryKeys.platform.schools() });
    },
  });
}
