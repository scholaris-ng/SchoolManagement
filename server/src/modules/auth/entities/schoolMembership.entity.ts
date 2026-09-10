import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolBranch } from '../../school/entities/schoolBranch.entity';
import { MembershipRole } from '../../rbac/entities/membershipRole.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { User } from './user.entity';

/**
 * One person's standing in one school — the join that makes this multi-tenant
 * (spec section 4).
 *
 * Tenant resolution reads from here and nowhere else. A browser may name a
 * school in `X-School-Id`, but it is only honoured when a matching ACTIVE row
 * exists for the authenticated user, so a forged header buys nothing.
 */
@Entity('school_memberships')
@Index(['userId', 'schoolId'], { unique: true })
@Index(['schoolId', 'status'])
export class SchoolMembership extends SoftDeletableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  @Index()
  branchId: string | null;

  @ManyToOne(() => SchoolBranch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: SchoolBranch | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';

  /**
   * Which domain record this membership *is*. Exactly one is normally set: a
   * parent's membership points at their guardian row, a pupil's at their
   * student row, a teacher's at their staff row.
   *
   * `staffId` is a real foreign key. The student and guardian tables arrive in
   * phase 2 (spec section 51), so those two are plain uuid columns for now and
   * gain their constraints in the migration that creates those tables.
   */
  @Column({ name: 'staff_id', type: 'uuid', nullable: true })
  @Index()
  staffId: string | null;

  @ManyToOne(() => Staff, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'staff_id' })
  staff?: Staff | null;

  @Column({ name: 'guardian_id', type: 'uuid', nullable: true })
  @Index()
  guardianId: string | null;

  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  @Index()
  studentId: string | null;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @OneToMany(() => MembershipRole, (link) => link.membership)
  roleLinks?: MembershipRole[];
}
