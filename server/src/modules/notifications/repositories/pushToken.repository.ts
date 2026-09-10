import { BaseRepository } from '../../../shared/repositories/baseRepository';
import { PushToken } from '../entities/pushToken.entity';

export class PushTokenRepository extends BaseRepository<PushToken> {
  static Instance = new PushTokenRepository();

  private constructor() {
    super(PushToken);
  }

  /**
   * Claims a token for this user, taking it from whoever held it before.
   *
   * The conflict target is the token alone: a shared device re-registers the
   * same FCM token under whoever signs in next, and the previous owner must
   * stop receiving that device's pushes the moment they do.
   */
  async claim(
    userId: string,
    token: string,
    platform: string,
    userAgent: string | null,
  ): Promise<void> {
    await this.repo.query(
      `INSERT INTO push_tokens (user_id, token, platform, user_agent, last_seen_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (token)
       DO UPDATE SET user_id = EXCLUDED.user_id,
                     platform = EXCLUDED.platform,
                     user_agent = EXCLUDED.user_agent,
                     last_seen_at = now(),
                     updated_at = now()`,
      [userId, token, platform, userAgent],
    );
  }

  async tokensForUsers(userIds: string[]): Promise<{ userId: string; token: string }[]> {
    if (userIds.length === 0) return [];
    return this.repo.query(
      `SELECT user_id AS "userId", token FROM push_tokens WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
  }

  /** Called when FCM reports a token is dead. Left behind, they only slow every later send. */
  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.repo.query(`DELETE FROM push_tokens WHERE token = ANY($1::text[])`, [tokens]);
  }
}
