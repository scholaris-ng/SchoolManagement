import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { Announcement } from '@/types/engagement';

export function useAnnouncements(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.announcements.list(schoolId, query),
    queryFn: () => http.get<Paginated<Announcement>>('/announcements', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAnnouncement(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.announcements.detail(schoolId, id ?? ''),
    queryFn: () => http.get<Announcement>(`/announcements/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Publishing an announcement.
 *
 * The channels chosen here are *requests*, not guarantees: the server honours
 * each recipient's notification preferences and records what was actually
 * delivered on each channel (spec section 28).
 */
export function useSaveAnnouncement(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<Announcement>) =>
      id
        ? http.patch<Announcement>(`/announcements/${id}`, values)
        : http.post<Announcement>('/announcements', values),
    onSuccess: (announcement) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.announcements.list(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(schoolId),
      });
      toast.success(
        announcement.status === 'PUBLISHED'
          ? `Published to ${announcement.recipientCount} recipients`
          : 'Announcement saved',
      );
    },
  });
}
