import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

export interface ScalePoint {
  value: number;
  label: string;
}

/**
 * What a rating means (spec section 23): "1 to 5, where 5 is excellent". A
 * school gets a default pair seeded on first read (`BehaviourService`) and
 * rates every trait on one of them.
 */
@Entity('behaviour_scales')
export class BehaviourScale extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_behaviour_scales_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_behaviour_scales_school' })
  school?: School;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'int' })
  min: number;

  @Column({ type: 'int' })
  max: number;

  /** One label per value from `min` to `max`, in order. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  points: ScalePoint[];
}
