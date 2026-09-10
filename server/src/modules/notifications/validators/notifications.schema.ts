import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { NOTIFICATION_CATEGORIES } from '../entities/notification.entity';
import { NOTIFICATION_CHANNELS } from '../entities/notificationPreference.entity';

export const fetchNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

/**
 * One channel of one category at a time, matching how the settings screen
 * toggles them. Sending the whole preference set would make a stale tab able to
 * overwrite a change made somewhere else.
 */
export const updatePreferenceSchema = z.object({
  body: z
    .object({
      category: z.enum(NOTIFICATION_CATEGORIES),
      channel: z.enum(NOTIFICATION_CHANNELS),
      enabled: z.boolean(),
    })
    .strict(),
});

export const registerPushTokenSchema = z.object({
  body: z
    .object({
      // FCM registration tokens are long and have no fixed length; the ceiling
      // matches the column so an oversized value is refused before the insert.
      token: z.string().trim().min(20).max(512),
      platform: z.enum(['WEB', 'ANDROID', 'IOS']).default('WEB'),
      userAgent: z.string().trim().max(400).optional(),
    })
    .strict(),
});

export type FetchNotificationsQuery = z.infer<typeof fetchNotificationsSchema>['query'];
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>['body'];
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>['body'];
