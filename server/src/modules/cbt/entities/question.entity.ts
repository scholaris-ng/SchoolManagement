import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { SchoolLevel } from '../../academics/entities/schoolLevel.entity';
import { CurriculumTopic } from '../../curriculum/entities/curriculumTopic.entity';
import { LearningObjective } from '../../curriculum/entities/learningObjective.entity';
import { User } from '../../auth/entities/user.entity';

/** Mirrors `QuestionType` and `Difficulty` in `client/src/types/assessment.ts`. */
export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

/**
 * One question in the school's bank (spec section 25).
 *
 * Tied to a learning objective wherever the teacher names one, which is what
 * lets "was this taught?" and "was this tested?" be the same question asked
 * twice — the coverage report is built on that link.
 *
 * Options live in jsonb rather than their own table: they are only ever read
 * and written with the question, never queried across, which is exactly the
 * case spec section 42 permits.
 */
@Entity('questions')
@Index('IDX_questions_school_subject', ['schoolId', 'subjectId'])
export class Question extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_questions_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_questions_school' })
  school?: School;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_questions_subject' })
  subject?: Subject;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'topic_id', foreignKeyConstraintName: 'FK_questions_topic' })
  topic?: CurriculumTopic | null;

  @Column({ name: 'objective_id', type: 'uuid', nullable: true })
  objectiveId: string | null;

  @ManyToOne(() => LearningObjective, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'objective_id', foreignKeyConstraintName: 'FK_questions_objective' })
  objective?: LearningObjective | null;

  @Column({ name: 'level_id', type: 'uuid', nullable: true })
  levelId: string | null;

  @ManyToOne(() => SchoolLevel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'level_id', foreignKeyConstraintName: 'FK_questions_level' })
  level?: SchoolLevel | null;

  @Column({ type: 'varchar', length: 20 })
  type: QuestionType;

  @Column({ type: 'varchar', length: 10, default: 'MEDIUM' })
  difficulty: Difficulty;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  options: QuestionOption[];

  /** For short answers; multiple choice carries its answer on the option. */
  @Column({ name: 'correct_answer', type: 'text', nullable: true })
  correctAnswer: string | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ type: 'int', default: 1 })
  marks: number;

  /** How many papers have used it — what stops a bank going stale unnoticed. */
  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id', foreignKeyConstraintName: 'FK_questions_created_by' })
  createdBy?: User | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 160 })
  createdByName: string;
}
