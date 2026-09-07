import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  AppNotification,
  NotificationChannel,
  NotificationCategory,
  NotificationPreference,
} from '@/types/engagement';

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export function useUnreadCounts() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(schoolId),
    queryFn: () => http.get<UnreadCounts>('/notifications/unread-count'),
    enabled: Boolean(schoolId),
    // Cheap poll so a parent sees a new message without reloading. Realtime
    // message content itself arrives over Firestore, not this endpoint.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useNotifications(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.notifications.inbox(schoolId, query),
    queryFn: () => http.get<Paginated<AppNotification>>('/notifications', { query }),
    enabled: Boolean(schoolId),
  });
}

export function useMarkNotificationRead() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => http.patch<AppNotification>(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.inbox(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(schoolId),
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => http.post<{ updated: number }>('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.inbox(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(schoolId),
      });
    },
  });
}

export function useNotificationPreferences() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.notifications.preferences(schoolId),
    queryFn: () => http.get<NotificationPreference[]>('/notifications/preferences'),
    enabled: Boolean(schoolId),
  });
}

export function useUpdateNotificationPreference() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled: boolean;
    }) => http.patch<NotificationPreference[]>('/notifications/preferences', input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.notifications.preferences(schoolId), data);
    },
  });
}

/** Registers this browser for web push once the user opts in. */
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (token: string) =>
      http.post<{ registered: boolean }>('/notifications/push-tokens', {
        token,
        platform: 'WEB',
        userAgent: navigator.userAgent,
      }),
  });
}
