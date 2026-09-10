import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Notification categories and severities.
 *
 * These mirror `client/src/types/engagement.ts` exactly. Stored as varchar
 * rather than a PostgreSQL enum, matching how `Student.status` and
 * `Staff.status` are already modelled: adding a category should be a code
 * change, not a migration that locks the table.
 */
export const NOTIFICATION_CATEGORIES = [
  'ATTENDANCE',
  'RESULT',
  'FEE',
  'ADMISSION',
  'CALENDAR',
  'MESSAGE',
  'BEHAVIOUR',
  'COLLECTION',
  'ANNOUNCEMENT',
  'SYSTEM',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

/**
 * One delivered notification, addressed to one person in one school.
 *
 * A row *is* the in-app channel — there is no separate "delivery" table for it,
 * because the inbox is the delivery. Push is a fan-out on top of this row, so a
 * failed push still leaves the recipient something to find when they next open
 * the bell.
 *
 * Not soft-deletable: the client offers no way to delete a notification, only
 * to read it, and a read notification is history rather than clutter.
 */
@Entity('notifications')
@Index(['schoolId', 'userId', 'createdAt'])
@Index(['userId', 'readAt'])
export class Notification extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /**
   * The recipient. A person with children at two schools has one user account
   * and two membership rows, so the school is carried separately — their inbox
   * shows the school they are currently working in, not both at once.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 16 })
  category: NotificationCategory;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /**
   * A client route, passed straight to `navigate()` by the notification bell.
   * Anything that is not a real route in the React app is a dead end for the
   * person who taps it.
   */
  @Column({ type: 'varchar', name: 'action_url', length: 500, nullable: true })
  actionUrl: string | null;

  @Column({ type: 'varchar', length: 16, default: 'INFO' })
  severity: NotificationSeverity;

  /** What this is about, for deep-linking and for future grouping. */
  @Column({ type: 'varchar', name: 'entity_type', length: 80, nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', name: 'entity_id', length: 80, nullable: true })
  entityId: string | null;

  /** Null means unread; the timestamp is kept rather than a boolean flag. */
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
