import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Term } from '../../academics/entities/term.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../auth/entities/user.entity';

/** Mirrors `AssessmentMode` and `AssessmentState` in `client/src/types/assessment.ts`. */
export const ASSESSMENT_MODES = ['PRACTICE', 'EXAM'] as const;
export const ASSESSMENT_STATES = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'GRADED'] as const;
export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'GRADED', 'ABANDONED'] as const;

export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];
export type AssessmentState = (typeof ASSESSMENT_STATES)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/**
 * A paper (spec section 25): which questions, for which classes, for how
 * long, and how many times a pupil may sit it. The question ids are stored in
 * order, so a paper keeps asking what it asked even as the bank grows.
 */
@Entity('cbt_assessments')
@Index('IDX_cbt_assessments_school_state', ['schoolId', 'state'])
export class CbtAssessment extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_cbt_assessments_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_cbt_assessments_school' })
  school?: School;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 10, default: 'PRACTICE' })
  mode: AssessmentMode;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_cbt_assessments_subject' })
  subject?: Subject;

  @Column({ name: 'class_ids', type: 'uuid', array: true, default: () => "'{}'" })
  classIds: string[];

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_cbt_assessments_term' })
  term?: Term;

  @Column({ name: 'question_ids', type: 'uuid', array: true, default: () => "'{}'" })
  questionIds: string[];

  @Column({ name: 'duration_minutes', type: 'int', default: 30 })
  durationMinutes: number;

  @Column({ name: 'attempts_allowed', type: 'int', default: 1 })
  attemptsAllowed: number;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'shuffle_questions', type: 'boolean', default: true })
  shuffleQuestions: boolean;

  @Column({ name: 'shuffle_options', type: 'boolean', default: true })
  shuffleOptions: boolean;

  /** Practice papers usually mark themselves; an exam usually waits. */
  @Column({ name: 'show_result_immediately', type: 'boolean', default: true })
  showResultImmediately: boolean;

  @Column({ name: 'pass_score', type: 'int', default: 50 })
  passScore: number;

  @Column({ type: 'varchar', length: 12, default: 'DRAFT' })
  state: AssessmentState;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id', foreignKeyConstraintName: 'FK_cbt_assessments_created_by' })
  createdBy?: User | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 160 })
  createdByName: string;

  @VersionColumn()
  version: number;
}

/**
 * One sitting. The paper is fixed at the moment it starts — question order
 * and option order included — so a reload cannot reshuffle a pupil's paper
 * mid-exam, and `expires_at` is the server's word on when time is up rather
 * than the browser's.
 *
 * Answers are saved as they are given (`flushAnswers`) so a lost connection
 * costs the last few seconds rather than the whole paper.
 */
@Entity('cbt_attempts')
@Index('IDX_cbt_attempts_assessment_student', ['assessmentId', 'studentId'])
export class CbtAttempt extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_cbt_attempts_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_cbt_attempts_school' })
  school?: School;

  @Column({ name: 'assessment_id', type: 'uuid' })
  assessmentId: string;

  @ManyToOne(() => CbtAssessment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id', foreignKeyConstraintName: 'FK_cbt_attempts_assessment' })
  assessment?: CbtAssessment;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_cbt_attempts_student' })
  student?: Student;

  /** The paper as this pupil received it, in their own order. */
  @Column({ name: 'question_ids', type: 'uuid', array: true, default: () => "'{}'" })
  questionIds: string[];

  /** `{ [questionId]: answer }` — the option id, or the typed text. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers: Record<string, string | null>;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  score: string | null;

  @Column({ name: 'total_marks', type: 'int', default: 0 })
  totalMarks: number;

  @Column({ type: 'varchar', length: 16, default: 'IN_PROGRESS' })
  status: AttemptStatus;
}
