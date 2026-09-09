import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { NotificationEndpoints } from './notifications.endpoints';
import type {
  UnreadCounts,
  UpdateNotificationPreferenceInput,
} from './notifications.endpoints';

export type { UnreadCounts, UpdateNotificationPreferenceInput };

export function useUnreadCounts() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(schoolId),
    queryFn: () => NotificationEndpoints.fetchUnreadCounts(),
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
    queryFn: () => NotificationEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
  });
}

export function useMarkNotificationRead() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => NotificationEndpoints.markRead(id),
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
    mutationFn: () => NotificationEndpoints.markAllRead(),
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
    queryFn: () => NotificationEndpoints.fetchPreferences(),
    enabled: Boolean(schoolId),
  });
}

export function useUpdateNotificationPreference() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateNotificationPreferenceInput) =>
      NotificationEndpoints.updatePreference(input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.notifications.preferences(schoolId), data);
    },
  });
}

/** Registers this browser for web push once the user opts in. */
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (token: string) =>
      NotificationEndpoints.registerPushToken(token, navigator.userAgent),
  });
}
