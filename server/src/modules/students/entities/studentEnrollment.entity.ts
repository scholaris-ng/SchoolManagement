import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { Term } from '../../academics/entities/term.entity';
import { SchoolLevel } from '../../academics/entities/schoolLevel.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Student } from './student.entity';

export type EnrollmentStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PROMOTED'
  | 'REPEATED'
  | 'WITHDRAWN'
  | 'TRANSFERRED';

/**
 * Where a pupil sat in one session — appended, never overwritten
 * (spec section 13).
 *
 * This is the record that makes a transcript possible years later. Promotion
 * closes the current row and opens a new one; it does not edit the old one. A
 * pupil who repeats a year has two rows for the same level, which is exactly
 * what the history should show.
 */
@Entity('student_enrollments')
@Index(['schoolId', 'studentId', 'sessionId'])
@Index(['schoolId', 'classId', 'status'])
@Index(['schoolId', 'sessionId'])
export class StudentEnrollment extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  @Index()
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'session_id', type: 'uuid' })
  @Index()
  sessionId: string;

  @ManyToOne(() => AcademicSession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession;

  /** Set when a school enrols per term rather than per year. */
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  termId: string | null;

  @ManyToOne(() => Term, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'term_id' })
  term?: Term | null;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: SchoolLevel;

  @Column({ name: 'class_id', type: 'uuid' })
  @Index()
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: EnrollmentStatus;

  @Column({ name: 'enrolled_on', type: 'date' })
  enrolledOn: string;

  @Column({ name: 'exited_on', type: 'date', nullable: true })
  exitedOn: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
