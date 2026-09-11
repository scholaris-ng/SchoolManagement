import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Term } from '../../academics/entities/term.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Statuses and absence reasons, mirroring `client/src/types/attendance.ts`
 * exactly. Stored as varchar rather than a PostgreSQL enum, matching how
 * `Student.status` and `Notification.category` are already modelled: a school
 * asking for a new reason should be a code change, not a migration that locks
 * the table.
 */
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ABSENCE_REASONS = [
  'SICK',
  'PERMITTED',
  'FAMILY',
  'TRANSPORT',
  'UNEXPLAINED',
  'OTHER',
] as const;

export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

/**
 * One child, one day, one mark (spec section 11).
 *
 * A row exists only once somebody has actually taken the register. An unmarked
 * pupil has no row, which is what lets the register screen distinguish "nobody
 * has been marked yet" from "everybody was present" — two facts a default value
 * in the table would collapse into one.
 *
 * `class_id` is stored rather than read back through the pupil's current class:
 * a register is a record of who sat in which room on a named day, and it must
 * still say that after the child is promoted or moved to another arm.
 *
 * Not soft-deletable. Correcting a register overwrites the mark, and the client
 * offers no way to delete one — an absence that was entered in error becomes a
 * `PRESENT` mark, not a missing row.
 */
@Entity('attendance_records')
// One mark per child per day, whichever class it was taken in. This is also the
// conflict target the register upsert writes against.
@Index('IDX_attendance_records_student_date', ['studentId', 'date'], { unique: true })
// The register itself: one class, one date.
@Index('IDX_attendance_records_school_class_date', ['schoolId', 'classId', 'date'])
// The school-wide rate for a day, and the trend that is the same figure over a
// window of them.
@Index('IDX_attendance_records_school_date', ['schoolId', 'date'])
export class AttendanceRecord extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_attendance_records_school')
  schoolId: string;

  /**
   * Every foreign key here is named, as the indexes above are: the migration
   * spells the same names out, so `migration:generate` sees the schema it
   * expects rather than offering to rename them to its own hashes.
   */
  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_attendance_records_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_attendance_records_student' })
  student?: Student;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_attendance_records_class' })
  schoolClass?: SchoolClass;

  /**
   * The term the date falls in. Attendance is reported per term, and a mark
   * outside every term is not a school day — the register refuses to save one,
   * so this is never null.
   */
  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_attendance_records_term' })
  term?: Term;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 16 })
  status: AttendanceStatus;

  /** Why the child was away — what makes an alert and a trend worth reading. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  reason: AbsenceReason | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'marked_by_user_id', type: 'uuid', nullable: true })
  markedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'marked_by_user_id',
    foreignKeyConstraintName: 'FK_attendance_records_marked_by',
  })
  markedBy?: User | null;

  /**
   * Captured as it was at the time, the way an audit entry captures an actor's
   * name: the register must still read correctly after the teacher leaves and
   * their user row is gone.
   */
  @Column({ type: 'varchar', name: 'marked_by_name', length: 160, nullable: true })
  markedByName: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz' })
  markedAt: Date;

  /**
   * Set once the same-day absence alert has gone out. Null is the whole
   * mechanism that stops a guardian being messaged twice about one absence when
   * the register is corrected later in the day.
   */
  @Column({ name: 'guardian_notified_at', type: 'timestamptz', nullable: true })
  guardianNotifiedAt: Date | null;
}
