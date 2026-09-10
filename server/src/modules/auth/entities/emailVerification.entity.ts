import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { User } from './user.entity';

/**
 * A one-time code proving someone controls an email address.
 *
 * The code itself is never stored — only a SHA-256 hash of it. A verification
 * code is a short-lived credential: anyone who can read this table could
 * otherwise take over an account mid-registration.
 *
 * Rows are kept after use rather than deleted, so a support question about a
 * failed sign-up has something to look at.
 */
@Entity('email_verifications')
@Index(['userId', 'consumedAt'])
export class EmailVerification extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** SHA-256 of the six-digit code. Never the code itself. */
  @Column({ type: 'varchar', name: 'code_hash', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Set the moment the code is accepted, which is what stops it being reused. */
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  /**
   * Wrong guesses against this code. Six digits is only a million
   * possibilities, so the row is burned after a handful of attempts rather
   * than left open to be walked through.
   */
  @Column({ type: 'int', default: 0 })
  attempts: number;
}
