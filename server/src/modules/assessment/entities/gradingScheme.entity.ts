import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/** Mirrors `AssessmentComponent['type']` in `client/src/types/results.ts`. */
export const COMPONENT_TYPES = ['CONTINUOUS_ASSESSMENT', 'EXAM'] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

/**
 * How a school grades (spec section 19): which components make up a mark
 * (CA 1, CA 2, exam…), and which bands a total falls into. Nothing here is
 * fixed by the software — a school gets one default seeded and edits it, or
 * writes another for a different section and points it at those levels.
 */
@Entity('grading_schemes')
export class GradingScheme extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_grading_schemes_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_grading_schemes_school' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'pass_mark', type: 'int', default: 40 })
  passMark: number;

  /** Empty means the scheme applies wherever no other claims the level. */
  @Column({ name: 'level_ids', type: 'uuid', array: true, default: () => "'{}'" })
  levelIds: string[];

  @Column({ name: 'show_position', type: 'boolean', default: true })
  showPosition: boolean;

  @VersionColumn()
  version: number;
}

/** One column of the score sheet. */
@Entity('assessment_components')
@Index('IDX_assessment_components_scheme_sequence', ['schemeId', 'sequence'])
export class AssessmentComponent extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_assessment_components_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_assessment_components_school' })
  school?: School;

  @Column({ name: 'scheme_id', type: 'uuid' })
  schemeId: string;

  @ManyToOne(() => GradingScheme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id', foreignKeyConstraintName: 'FK_assessment_components_scheme' })
  scheme?: GradingScheme;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'max_score', type: 'int' })
  maxScore: number;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar', length: 24, default: 'CONTINUOUS_ASSESSMENT' })
  type: ComponentType;
}

/** What a percentage is called, and whether it passes. */
@Entity('grade_bands')
@Index('IDX_grade_bands_scheme', ['schemeId'])
export class GradeBand extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_grade_bands_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_grade_bands_school' })
  school?: School;

  @Column({ name: 'scheme_id', type: 'uuid' })
  schemeId: string;

  @ManyToOne(() => GradingScheme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id', foreignKeyConstraintName: 'FK_grade_bands_scheme' })
  scheme?: GradingScheme;

  @Column({ type: 'varchar', length: 8 })
  label: string;

  @Column({ name: 'min_score', type: 'int' })
  minScore: number;

  @Column({ name: 'max_score', type: 'int' })
  maxScore: number;

  @Column({ type: 'varchar', length: 80 })
  remark: string;

  @Column({ name: 'grade_point', type: 'numeric', precision: 4, scale: 2, nullable: true })
  gradePoint: string | null;

  @Column({ name: 'is_pass', type: 'boolean', default: true })
  isPass: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;
}
