import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  AppNotification,
  NotificationChannel,
  NotificationCategory,
  NotificationPreference,
} from '@/types/engagement';

/**
 * Endpoint layer for the notification module.
 *
 * Pure, typed async functions over the transport. No React, no state, no error
 * handling — hooks own all of that (frontend guide sections 6 and 7).
 */

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export interface UpdateNotificationPreferenceInput {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export const NotificationEndpoints = {
  fetchUnreadCounts: () => http.get<UnreadCounts>('/notifications/unread-count'),

  fetchAll: (query: ListQuery) =>
    http.get<Paginated<AppNotification>>('/notifications', { query }),

  markRead: (id: string) => http.patch<AppNotification>(`/notifications/${id}/read`),

  markAllRead: () => http.post<{ updated: number }>('/notifications/read-all'),

  fetchPreferences: () => http.get<NotificationPreference[]>('/notifications/preferences'),

  updatePreference: (input: UpdateNotificationPreferenceInput) =>
    http.patch<NotificationPreference[]>('/notifications/preferences', input),

  registerPushToken: (token: string, userAgent: string) =>
    http.post<{ registered: boolean }>('/notifications/push-tokens', {
      token,
      platform: 'WEB',
      userAgent,
    }),
};
