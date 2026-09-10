import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * A parent or guardian (spec section 8).
 *
 * The record belongs to the person, not to a child: one guardian covers every
 * child they have at the school, and one login reaches all of them. That is why
 * `student_guardians` is a join table rather than a column on the student.
 */
@Entity('guardians')
@Index(['schoolId', 'email'], { unique: true })
@Index(['schoolId', 'lastName'])
@Index(['schoolId', 'createdAt'])
export class Guardian extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** Set once they have been invited and the account exists. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', name: 'first_name', length: 60 })
  firstName: string;

  @Column({ type: 'varchar', name: 'last_name', length: 60 })
  lastName: string;

  /** Unique within the school — it is how an invitation finds the right person. */
  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', name: 'alt_phone', length: 20, nullable: true })
  altPhone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  occupation: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', name: 'photo_url', length: 500, nullable: true })
  photoUrl: string | null;

  /**
   * Whether the parent portal is open to them. Separate from `userId`: access
   * can be withdrawn without deleting the account, and granted before they have
   * ever signed in.
   */
  @Column({ type: 'boolean', name: 'has_portal_access', default: false })
  hasPortalAccess: boolean;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @VersionColumn()
  version: number;
}
