import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { SchoolMembership } from './schoolMembership.entity';

/**
 * A person, across every school they belong to (spec section 5).
 *
 * Firebase answers "who is this?" and owns the credential; this row is the
 * application's own record of them. Nothing here decides what they may do —
 * that lives entirely in their memberships.
 */
@Entity('users')
export class User extends SoftDeletableEntity {
  @Column({ type: 'varchar', name: 'firebase_uid', length: 128, unique: true })
  @Index()
  firebaseUid: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', name: 'display_name', length: 160 })
  displayName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', name: 'photo_url', length: 500, nullable: true })
  photoUrl: string | null;

  /**
   * Platform operator, not a school role. Grants `platform.manage` everywhere,
   * so it is deliberately a column here rather than a membership a school
   * administrator could grant themselves.
   */
  @Column({ type: 'boolean', name: 'is_platform_admin', default: false })
  isPlatformAdmin: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => SchoolMembership, (membership) => membership.user)
  memberships?: SchoolMembership[];
}
