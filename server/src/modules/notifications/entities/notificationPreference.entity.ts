import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { User } from '../../auth/entities/user.entity';
import type { NotificationCategory } from './notification.entity';

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Which channels a person wants for one category of notification.
 *
 * Rows are written lazily — a user with no row for a category simply gets the
 * defaults below, so nothing has to be seeded when an account is created and a
 * newly added category needs no backfill.
 *
 * Deliberately keyed on the user rather than the membership: someone with
 * children at two schools does not want to configure "fee reminders by push"
 * twice.
 *
 * NOTE ON EMAIL AND SMS: both columns are stored and returned, because the
 * client's `NotificationPreference.channels` is a complete
 * `Record<NotificationChannel, boolean>` — but no delivery adapter exists for
 * either yet. Toggling them today changes a stored preference and nothing else.
 * They start disabled so nobody is promised a message that will not arrive.
 */
@Entity('notification_preferences')
@Index(['userId', 'category'], { unique: true })
export class NotificationPreference extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 16 })
  category: NotificationCategory;

  /** The inbox. Off means the notification is never written at all. */
  @Column({ type: 'boolean', name: 'in_app', default: true })
  inApp: boolean;

  @Column({ type: 'boolean', default: true })
  push: boolean;

  @Column({ type: 'boolean', default: false })
  email: boolean;

  @Column({ type: 'boolean', default: false })
  sms: boolean;
}
