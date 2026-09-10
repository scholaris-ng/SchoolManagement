import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { User } from '../../auth/entities/user.entity';
import { TeachingAssignment } from './teachingAssignment.entity';

/**
 * An employee of the school (spec section 51 item 15).
 *
 * Created in phase 1 rather than phase 2 because two foundation concerns
 * already depend on it: a class names its form teachers, and the session
 * endpoint refuses a membership whose staff record is on leave or exited. Its
 * own endpoints arrive with the rest of phase 2.
 */
@Entity('staff')
@Index(['schoolId', 'staffNo'], { unique: true })
@Index(['schoolId', 'status'])
@Index(['schoolId', 'lastName'])
export class Staff extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** Set once the person has been invited and has signed in at least once. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'varchar', name: 'staff_no', length: 40 })
  staffNo: string;

  @Column({ type: 'varchar', name: 'first_name', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', name: 'last_name', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 10 })
  gender: 'MALE' | 'FEMALE';

  @Column({ type: 'varchar', name: 'photo_url', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'varchar', length: 120 })
  designation: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ name: 'employment_type', type: 'varchar', length: 20, default: 'FULL_TIME' })
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';

  @Column({ name: 'employment_date', type: 'date' })
  employmentDate: string;

  /**
   * The roster is the single source of truth for whether this person may sign
   * in — there is no separate "disable login" switch to forget to flip. A
   * membership whose staff row is ON_LEAVE or EXITED is refused at session
   * resolution, immediately rather than at their next sign-in.
   */
  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: 'ACTIVE' | 'ON_LEAVE' | 'EXITED';

  @OneToMany(() => TeachingAssignment, (assignment) => assignment.staff)
  teachingAssignments?: TeachingAssignment[];

  @VersionColumn()
  version: number;
}
