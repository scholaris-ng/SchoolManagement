import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { BehaviourScale } from './behaviourScale.entity';

/** Mirrors `BehaviourTrait['category']` in `client/src/types/behaviour.ts`. */
export const TRAIT_CATEGORIES = ['AFFECTIVE', 'PSYCHOMOTOR', 'SKILL', 'OTHER'] as const;

export type TraitCategory = (typeof TRAIT_CATEGORIES)[number];

/**
 * Something the school rates a pupil on — punctuality, neatness, teamwork
 * (spec section 23). Each is rated on one scale, and the ones flagged for the
 * report card are what the behaviour section prints.
 */
@Entity('behaviour_traits')
@Index('IDX_behaviour_traits_school_sequence', ['schoolId', 'sequence'])
export class BehaviourTrait extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_behaviour_traits_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_behaviour_traits_school' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  category: TraitCategory;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'scale_id', type: 'uuid' })
  scaleId: string;

  @ManyToOne(() => BehaviourScale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scale_id', foreignKeyConstraintName: 'FK_behaviour_traits_scale' })
  scale?: BehaviourScale;

  /** Empty means the trait applies at every level. */
  @Column({ name: 'level_ids', type: 'uuid', array: true, default: () => "'{}'" })
  levelIds: string[];

  @Column({ name: 'appears_on_report_card', type: 'boolean', default: true })
  appearsOnReportCard: boolean;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
