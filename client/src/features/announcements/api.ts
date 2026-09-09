import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { Announcement } from '@/types/engagement';
import { AnnouncementEndpoints } from './announcements.endpoints';

export function useAnnouncements(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.announcements.list(schoolId, query),
    queryFn: () => AnnouncementEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAnnouncement(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.announcements.detail(schoolId, id ?? ''),
    queryFn: () => AnnouncementEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/** Publishes or drafts an announcement. */
export function useSaveAnnouncement(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<Announcement>) =>
      id ? AnnouncementEndpoints.update(id, values) : AnnouncementEndpoints.create(values),
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
