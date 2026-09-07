import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { CollectionEvent } from '@/types/people';

export function useCollectionEvents(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.collection.events(schoolId, query),
    queryFn: () => http.get<Paginated<CollectionEvent>>('/collection/events', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export interface ReleaseChildInput {
  studentId: string;
  pickupPersonId?: string | null;
  pickupPersonName: string;
  relationship: string;
  method: CollectionEvent['method'];
  note?: string;
}

/**
 * Recording that a child left the premises.
 *
 * These records are append-only by design: who collected a child, when, and
 * which member of staff released them. That history is the point of the
 * feature, so nothing here edits or deletes (spec section 12).
 */
export function useReleaseChild() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReleaseChildInput) =>
      http.post<CollectionEvent>('/collection/events', input),
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
