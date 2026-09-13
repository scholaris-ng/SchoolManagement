import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Term } from '../../academics/entities/term.entity';

/**
 * The parts of a report card that are written rather than computed (spec
 * section 21): the two comments, and the verification code stamped on it
 * when every sheet behind it is published. Everything else — scores, grades,
 * position, attendance, behaviour — is assembled from the record on read, so
 * a card can never disagree with the sheets it was printed from.
 */
@Entity('report_cards')
@Index('IDX_report_cards_student_term', ['studentId', 'termId'], { unique: true })
@Index('IDX_report_cards_verification_code', ['verificationCode'], { unique: true, where: '"verification_code" IS NOT NULL' })
export class ReportCardRecord extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_report_cards_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_report_cards_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_report_cards_student' })
  student?: Student;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_report_cards_term' })
  term?: Term;

  @Column({ name: 'form_teacher_comment', type: 'text', nullable: true })
  formTeacherComment: string | null;

  @Column({ name: 'principal_comment', type: 'text', nullable: true })
  principalComment: string | null;

  @Column({ name: 'verification_code', type: 'varchar', length: 24, nullable: true })
  verificationCode: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}

/** Mirrors `CommentTemplate` in `client/src/types/results.ts`. */
export const COMMENT_AUDIENCES = ['FORM_TEACHER', 'PRINCIPAL'] as const;
export const COMMENT_BANDS = ['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'GENERAL'] as const;

/** Stock remarks a teacher picks from, so a hundred cards do not take a hundred evenings. */
@Entity('comment_templates')
@Index('IDX_comment_templates_school_audience', ['schoolId', 'audience'])
export class CommentTemplate extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_comment_templates_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_comment_templates_school' })
  school?: School;

  @Column({ type: 'varchar', length: 16 })
  audience: (typeof COMMENT_AUDIENCES)[number];

  @Column({ type: 'varchar', length: 16 })
  band: (typeof COMMENT_BANDS)[number];

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;
}

/**
 * A transcript issued — the moment it acquired a verification code and a
 * named issuer (spec section 22). Re-issuing writes a fresh code; the old one
 * stops verifying, which is what "revoked" means on the public page.
 */
@Entity('transcript_issues')
@Index('IDX_transcript_issues_student', ['studentId'], { unique: true })
@Index('IDX_transcript_issues_verification_code', ['verificationCode'], { unique: true })
export class TranscriptIssue extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_transcript_issues_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_transcript_issues_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_transcript_issues_student' })
  student?: Student;

  @Column({ name: 'verification_code', type: 'varchar', length: 24 })
  verificationCode: string;

  @Column({ name: 'issued_by_name', type: 'varchar', length: 160 })
  issuedByName: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'cumulative_average', type: 'numeric', precision: 5, scale: 2, default: 0 })
  cumulativeAverage: string;
}
