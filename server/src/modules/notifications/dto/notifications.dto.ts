import type { NotificationCategory, NotificationSeverity } from '../entities/notification.entity';
import type { NotificationChannel } from '../entities/notificationPreference.entity';

/**
 * The wire shapes, mirroring `client/src/types/engagement.ts` and
 * `client/src/features/notifications/notifications.endpoints.ts`.
 *
 * Hand-written rather than returning entities: the client contract is fixed and
 * already shipped, so it is the DTO that must not drift, not the table.
 */

export interface NotificationDTO {
  id: string;
  schoolId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
}

export interface UnreadCountsDTO {
  notifications: number;
  /**
   * Unread parent–teacher messages. Always 0 until the messaging module exists;
   * the field is part of the shipped client contract, so it is answered
   * honestly rather than omitted.
   */
  messages: number;
}

export interface NotificationPreferenceDTO {
  category: NotificationCategory;
  channels: Record<NotificationChannel, boolean>;
}
