import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Term } from '../../academics/entities/term.entity';
import { Student } from '../../students/entities/student.entity';
import { GradingScheme, AssessmentComponent } from './gradingScheme.entity';

/** Mirrors `ResultStatus` in `client/src/types/results.ts`. */
export const RESULT_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/**
 * One class, one subject, one term: the worksheet a teacher fills in and
 * that moves DRAFT → SUBMITTED → APPROVED → PUBLISHED, each step gated by its
 * own permission (spec section 20). Made the first time anyone asks for the
 * term's sheets, from the teaching assignments — nothing is typed to create
 * one. `version` is the optimistic lock `saveScores` echoes back.
 */
@Entity('score_sheets')
@Index('IDX_score_sheets_class_subject_term', ['classId', 'subjectId', 'termId'], { unique: true })
@Index('IDX_score_sheets_school_term', ['schoolId', 'termId'])
export class ScoreSheet extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_score_sheets_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_score_sheets_school' })
  school?: School;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_score_sheets_class' })
  schoolClass?: SchoolClass;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_score_sheets_subject' })
  subject?: Subject;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_score_sheets_term' })
  term?: Term;

  @Column({ name: 'grading_scheme_id', type: 'uuid' })
  gradingSchemeId: string;

  @ManyToOne(() => GradingScheme, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'grading_scheme_id', foreignKeyConstraintName: 'FK_score_sheets_scheme' })
  gradingScheme?: GradingScheme;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: ResultStatus;

  @Column({ name: 'submitted_by_name', type: 'varchar', length: 160, nullable: true })
  submittedByName: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 160, nullable: true })
  approvedByName: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @VersionColumn()
  version: number;
}

/**
 * One mark: this pupil, this component, on this sheet. Null is "not entered";
 * a pupil with no row on any component is absent. Written by upsert so a
 * corrected mark replaces the old one rather than sitting beside it.
 */
@Entity('score_entries')
@Index('IDX_score_entries_sheet_student_component', ['scoreSheetId', 'studentId', 'componentId'], {
  unique: true,
})
export class ScoreEntry extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_score_entries_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_score_entries_school' })
  school?: School;

  @Column({ name: 'score_sheet_id', type: 'uuid' })
  scoreSheetId: string;

  @ManyToOne(() => ScoreSheet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'score_sheet_id', foreignKeyConstraintName: 'FK_score_entries_sheet' })
  scoreSheet?: ScoreSheet;

  @Column({ name: 'student_id', type: 'uuid' })
  @Index('IDX_score_entries_student')
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_score_entries_student' })
  student?: Student;

  @Column({ name: 'component_id', type: 'uuid' })
  componentId: string;

  @ManyToOne(() => AssessmentComponent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'component_id', foreignKeyConstraintName: 'FK_score_entries_component' })
  component?: AssessmentComponent;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  score: string | null;
}
