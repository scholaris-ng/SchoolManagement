import { createHash, randomInt } from 'node:crypto';
import { IsNull, LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { EmailVerification } from '../entities/emailVerification.entity';

/** Wrong guesses tolerated before a code is burned. */
export const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * A six-digit code from a cryptographic source, not `Math.random`. It is a
 * credential for the length of its life, however short that is.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export class EmailVerificationRepository {
  static Instance = new EmailVerificationRepository();

  private readonly repo = AppDataSource.getRepository(EmailVerification);

  private constructor() {}

  /**
   * Issues a code, invalidating any earlier one for this user.
   *
   * Only the newest code can work, so a resend cannot leave two valid codes in
   * circulation — and a code read over someone's shoulder stops working the
   * moment a new one is requested.
   */
  async issue(userId: string, ttlMinutes: number): Promise<string> {
    const code = generateCode();
    const now = new Date();

    await this.repo.manager.transaction(async (manager) => {
      // `IsNull()`, not `null`: TypeORM renders a bare null as `consumed_at =
      // NULL`, which matches nothing, and the previous code would stay live.
      await manager.update(
        EmailVerification,
        { userId, consumedAt: IsNull() },
        { consumedAt: now, attempts: MAX_VERIFICATION_ATTEMPTS },
      );
      await manager.save(
        manager.create(EmailVerification, {
          userId,
          codeHash: hashCode(code),
          expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
          consumedAt: null,
          attempts: 0,
        }),
      );
    });

    return code;
  }

  /** The live code for a user, if there is one. */
  async findActive(userId: string): Promise<EmailVerification | null> {
    return this.repo.findOne({
      where: { userId, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async consume(id: string): Promise<void> {
    await this.repo.update(id, { consumedAt: new Date() });
  }

  async recordFailedAttempt(id: string): Promise<number> {
    await this.repo.increment({ id }, 'attempts', 1);
    const row = await this.repo.findOne({ where: { id } });
    return row?.attempts ?? MAX_VERIFICATION_ATTEMPTS;
  }

  /** Housekeeping for expired rows that were never used. */
  async purgeExpired(): Promise<number> {
    const result = await this.repo.delete({
      consumedAt: IsNull(),
      expiresAt: LessThanOrEqual(new Date()),
    });
    return result.affected ?? 0;
  }
}
