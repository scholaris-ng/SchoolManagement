import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { sendPushToTokens } from '../../../infrastructure/firebase/push';
import { MembershipRepository } from '../../auth/repositories/membership.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notificationPreference.repository';
import { PushTokenRepository } from '../repositories/pushToken.repository';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationSeverity,
} from '../entities/notification.entity';
import type { NotificationChannel } from '../entities/notificationPreference.entity';
import type {
  NotificationDTO,
  NotificationPreferenceDTO,
  UnreadCountsDTO,
} from '../dto/notifications.dto';
import type {
  FetchNotificationsQuery,
  RegisterPushTokenInput,
  UpdatePreferenceInput,
} from '../validators/notifications.schema';

/**
 * What a person gets when they have never touched the settings screen.
 *
 * In-app and push on, email and sms off — the two channels that actually
 * deliver today are the two that default to on, so nobody is promised a message
 * the server cannot send.
 */
const DEFAULT_CHANNELS: Record<NotificationChannel, boolean> = {
  IN_APP: true,
  PUSH: true,
  EMAIL: false,
  SMS: false,
};

/** What a caller inside the server asks for when it wants somebody told something. */
export interface NotifyPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  /** Must be a real client route — the bell passes it straight to `navigate()`. */
  actionUrl?: string | null;
  severity?: NotificationSeverity;
  entityType?: string | null;
  entityId?: string | null;
  /**
   * Usually the person who caused the event. Telling somebody what they just
   * did themselves is noise, and an inbox full of it is an inbox people stop
   * reading.
   */
  exceptUserId?: string | null;
}

/** Roles that should hear about school-wide events. */
const ADMIN_ROLE_KEYS = ['SCHOOL_ADMIN', 'PRINCIPAL'];

export class NotificationsService {
  static Instance = new NotificationsService();

  private constructor(
    private readonly notifications = NotificationRepository.Instance,
    private readonly preferences = NotificationPreferenceRepository.Instance,
    private readonly pushTokens = PushTokenRepository.Instance,
    private readonly memberships = MembershipRepository.Instance,
  ) {}

  // ─── The inbox ──────────────────────────────────────────────────────────────

  async fetchAll(
    context: RequestContext,
    query: FetchNotificationsQuery,
  ): Promise<Paginated<NotificationDTO>> {
    return this.notifications.fetchPaginated(context.schoolId, context.user.id, {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
  }

  async fetchUnreadCounts(context: RequestContext): Promise<UnreadCountsDTO> {
    return {
      notifications: await this.notifications.countUnread(context.schoolId, context.user.id),
      // No messaging module yet, so there is nothing to count. Answered as 0
      // rather than omitted: the client's bell reads both fields.
      messages: 0,
    };
  }

  async markRead(context: RequestContext, id: string): Promise<NotificationDTO> {
    const updated = await this.notifications.markRead(context.schoolId, context.user.id, id);
    if (!updated) throw AppError.notFound('Notification');

    const dto = await this.notifications.findOneDTO(context.schoolId, context.user.id, id);
    if (!dto) throw AppError.notFound('Notification');
    return dto;
  }

  async markAllRead(context: RequestContext): Promise<{ updated: number }> {
    const updated = await this.notifications.markAllRead(context.schoolId, context.user.id);
    return { updated };
  }

  // ─── Preferences ────────────────────────────────────────────────────────────

  /**
   * Every category, always — stored rows layered over the defaults.
   *
   * The settings screen renders one row per category, so answering with only
   * the categories a person happens to have touched would show them a
   * half-empty page.
   */
  async fetchPreferences(context: RequestContext): Promise<NotificationPreferenceDTO[]> {
    const stored = await this.preferences.findForUser(context.user.id);
    const byCategory = new Map(stored.map((row) => [row.category, row]));

    return NOTIFICATION_CATEGORIES.map((category) => {
      const row = byCategory.get(category);
      return {
        category,
        channels: row
          ? { IN_APP: row.inApp, PUSH: row.push, EMAIL: row.email, SMS: row.sms }
          : { ...DEFAULT_CHANNELS },
      };
    });
  }

  async updatePreference(
    context: RequestContext,
    input: UpdatePreferenceInput,
  ): Promise<NotificationPreferenceDTO[]> {
    await this.preferences.upsertChannel(
      context.user.id,
      input.category,
      input.channel,
      input.enabled,
      DEFAULT_CHANNELS,
    );
    return this.fetchPreferences(context);
  }

  // ─── Push registration ──────────────────────────────────────────────────────

  async registerPushToken(
    context: RequestContext,
    input: RegisterPushTokenInput,
  ): Promise<{ registered: boolean }> {
    await this.pushTokens.claim(
      context.user.id,
      input.token,
      input.platform,
      input.userAgent ?? context.userAgent,
    );
    return { registered: true };
  }

  // ─── Sending, for the rest of the server ────────────────────────────────────

  /**
   * Tells one person something.
   *
   * Takes ids rather than a `RequestContext` on purpose: the recipient is
   * almost never the person whose request triggered this, and passing the
   * actor's context would make it far too easy to notify the wrong one.
   */
  async notifyUser(schoolId: string, userId: string, payload: NotifyPayload): Promise<void> {
    await this.notifyUsers(schoolId, [userId], payload);
  }

  /**
   * Tells several people the same thing.
   *
   * Never throws. Every caller is a business operation that has already
   * succeeded — a student was admitted, a term was opened — and failing to
   * announce it must not roll that back or surface as an error to the person
   * who did it.
   */
  async notifyUsers(
    schoolId: string,
    userIds: string[],
    payload: NotifyPayload,
  ): Promise<void> {
    const recipients = Array.from(new Set(userIds)).filter(
      (userId) => Boolean(userId) && userId !== payload.exceptUserId,
    );
    if (recipients.length === 0) return;

    try {
      const flags = await this.preferences.findFlagsForUsers(recipients);
      const preferenceOf = new Map(
        flags
          .filter((row) => row.category === payload.category)
          .map((row) => [row.userId, row]),
      );

      const wantsInApp = recipients.filter(
        (userId) => preferenceOf.get(userId)?.inApp ?? DEFAULT_CHANNELS.IN_APP,
      );
      if (wantsInApp.length === 0) return;

      await this.notifications.createMany(
        wantsInApp.map((userId) => ({
          schoolId,
          userId,
          category: payload.category,
          title: payload.title,
          body: payload.body,
          actionUrl: payload.actionUrl ?? null,
          severity: payload.severity ?? 'INFO',
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          readAt: null,
        })),
      );

      const wantsPush = wantsInApp.filter(
        (userId) => preferenceOf.get(userId)?.push ?? DEFAULT_CHANNELS.PUSH,
      );
      await this.pushTo(wantsPush, payload);
    } catch (error) {
      console.error(`[notifications] Failed to notify for ${payload.category}:`, error);
    }
  }

  /** Everyone who runs the school — for events with no single owner. */
  async notifySchoolAdmins(schoolId: string, payload: NotifyPayload): Promise<void> {
    try {
      const userIds = await this.memberships.findUserIdsByRoleKeys(schoolId, ADMIN_ROLE_KEYS);
      await this.notifyUsers(schoolId, userIds, payload);
    } catch (error) {
      console.error('[notifications] Could not resolve school administrators:', error);
    }
  }

  private async pushTo(userIds: string[], payload: NotifyPayload): Promise<void> {
    if (userIds.length === 0) return;

    const tokens = await this.pushTokens.tokensForUsers(userIds);
    if (tokens.length === 0) return;

    const result = await sendPushToTokens(
      tokens.map((row) => row.token),
      {
        title: payload.title,
        body: payload.body,
        actionUrl: payload.actionUrl,
        category: payload.category,
      },
    );

    if (result.deadTokens.length > 0) {
      await this.pushTokens.deleteTokens(result.deadTokens);
    }
  }
}
