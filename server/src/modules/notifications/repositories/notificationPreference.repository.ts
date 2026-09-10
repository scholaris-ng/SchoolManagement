import { BaseRepository } from '../../../shared/repositories/baseRepository';
import { NotificationPreference } from '../entities/notificationPreference.entity';
import type { NotificationCategory } from '../entities/notification.entity';
import type { NotificationChannel } from '../entities/notificationPreference.entity';

const COLUMN_FOR_CHANNEL: Record<NotificationChannel, string> = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
};

export interface PreferenceFlags {
  userId: string;
  category: NotificationCategory;
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

/**
 * Preferences belong to a person, not a school, so this is a plain
 * `BaseRepository` rather than a tenant-scoped one — there is no `school_id` to
 * scope by.
 */
export class NotificationPreferenceRepository extends BaseRepository<NotificationPreference> {
  static Instance = new NotificationPreferenceRepository();

  private constructor() {
    super(NotificationPreference);
  }

  async findForUser(userId: string): Promise<NotificationPreference[]> {
    return this.repo.find({ where: { userId } });
  }

  /**
   * Just the channel flags for a set of recipients, for deciding who to push
   * to. A projection rather than entities — a fan-out to a whole staff room
   * should not hydrate a row object per person.
   */
  async findFlagsForUsers(userIds: string[]): Promise<PreferenceFlags[]> {
    if (userIds.length === 0) return [];
    return this.repo.query(
      `SELECT user_id AS "userId", category, in_app AS "inApp", push, email, sms
         FROM notification_preferences
        WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
  }

  /**
   * Writes one channel of one category, creating the row on first touch.
   *
   * The column name comes from a fixed lookup, never from the request: the
   * channel arrives from the client and this is an interpolated identifier, so
   * an allowlist is the difference between a preference toggle and a SQL
   * injection.
   */
  async upsertChannel(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    defaults: Record<NotificationChannel, boolean>,
  ): Promise<void> {
    const column = COLUMN_FOR_CHANNEL[channel];
    if (!column) throw new Error(`Unknown notification channel: ${channel}`);

    await this.repo.query(
      `INSERT INTO notification_preferences (user_id, category, in_app, push, email, sms)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, category)
       DO UPDATE SET ${column} = EXCLUDED.${column}, updated_at = now()`,
      [
        userId,
        category,
        channel === 'IN_APP' ? enabled : defaults.IN_APP,
        channel === 'PUSH' ? enabled : defaults.PUSH,
        channel === 'EMAIL' ? enabled : defaults.EMAIL,
        channel === 'SMS' ? enabled : defaults.SMS,
      ],
    );
  }
}
