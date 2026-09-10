import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { User } from '../../auth/entities/user.entity';

/**
 * One browser or device registered for web push.
 *
 * The unique constraint is on the token alone, not on (user, token). FCM issues
 * one token per browser profile, so when a second person signs in on a shared
 * computer — a staff-room machine, a school office desktop — that same token
 * must be *reassigned* to them. Keying on the pair instead would leave the
 * first person's row in place and keep pushing that family's notifications to
 * a device they no longer hold.
 */
@Entity('push_tokens')
@Index(['userId'])
export class PushToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 512, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 16, default: 'WEB' })
  platform: 'WEB' | 'ANDROID' | 'IOS';

  @Column({ type: 'varchar', name: 'user_agent', length: 400, nullable: true })
  userAgent: string | null;

  /**
   * Refreshed every time the browser re-registers. A token that has not been
   * seen for months is almost certainly dead, which is what makes pruning
   * possible later without guessing.
   */
  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
