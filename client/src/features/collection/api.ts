import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { CollectionEndpoints } from './collection.endpoints';
import type { ReleaseChildInput } from './collection.endpoints';

export type { ReleaseChildInput };

export function useCollectionEvents(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.collection.events(schoolId, query),
    queryFn: () => CollectionEndpoints.fetchEvents(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

/** Records that a child left the premises. */
export function useReleaseChild() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReleaseChildInput) => CollectionEndpoints.releaseChild(input),
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection.events(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.pickupPersons(schoolId, event.studentId),
      });
      toast.success('Collection recorded', {
        description: event.parentNotified
          ? `${event.studentName} released to ${event.pickupPersonName}. The guardian has been notified.`
          : `${event.studentName} released to ${event.pickupPersonName}.`,
      });
    },
  });
}
