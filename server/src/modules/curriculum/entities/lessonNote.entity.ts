import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Term } from '../../academics/entities/term.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { SchemeOfWork } from './schemeOfWork.entity';
import { SchemeWeek } from './schemeWeek.entity';

/** Mirrors `LessonNoteStatus` in `client/src/types/curriculum.ts`. */
export const LESSON_NOTE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED'] as const;

export type LessonNoteStatus = (typeof LESSON_NOTE_STATUSES)[number];

/**
 * What one teacher planned to teach in one week, and what actually happened
 * (spec section 15). The class, subject, topic and objectives are copied from
 * the scheme week at creation, so the note keeps saying what it said even
 * after the scheme moves on. A head teacher can send it back for changes —
 * `RETURNED` — which a scheme cannot be.
 */
@Entity('lesson_notes')
@Index('IDX_lesson_notes_teacher_status', ['teacherId', 'status'])
@Index('IDX_lesson_notes_school_date', ['schoolId', 'date'])
export class LessonNote extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_lesson_notes_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_lesson_notes_school' })
  school?: School;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id', foreignKeyConstraintName: 'FK_lesson_notes_teacher' })
  teacher?: Staff;

  @Column({ name: 'teacher_name', type: 'varchar', length: 160 })
  teacherName: string;

  @Column({ name: 'scheme_id', type: 'uuid' })
  schemeId: string;

  @ManyToOne(() => SchemeOfWork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id', foreignKeyConstraintName: 'FK_lesson_notes_scheme' })
  scheme?: SchemeOfWork;

  @Column({ name: 'scheme_week_id', type: 'uuid' })
  schemeWeekId: string;

  @ManyToOne(() => SchemeWeek, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_week_id', foreignKeyConstraintName: 'FK_lesson_notes_scheme_week' })
  schemeWeek?: SchemeWeek;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_lesson_notes_class' })
  schoolClass?: SchoolClass;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_lesson_notes_subject' })
  subject?: Subject;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_lesson_notes_term' })
  term?: Term;

  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 200 })
  topic: string;

  @Column({ name: 'objective_ids', type: 'uuid', array: true, default: () => "'{}'" })
  objectiveIds: string[];

  @Column({ name: 'objective_statements', type: 'text', array: true, default: () => "'{}'" })
  objectiveStatements: string[];

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  resources: string | null;

  @Column({ type: 'text', nullable: true })
  assignment: string | null;

  @Column({ type: 'text', nullable: true })
  challenges: string | null;

  @Column({ name: 'student_difficulties', type: 'text', nullable: true })
  studentDifficulties: string | null;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: LessonNoteStatus;

  @Column({ name: 'reviewer_name', type: 'varchar', length: 160, nullable: true })
  reviewerName: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment: string | null;

  @VersionColumn()
  version: number;
}
