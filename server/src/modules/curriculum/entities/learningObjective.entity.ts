import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { CurriculumTopic } from './curriculumTopic.entity';

/** Mirrors `LearningObjective['bloomLevel']` in `client/src/types/curriculum.ts`. */
export const BLOOM_LEVELS = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYSE',
  'EVALUATE',
  'CREATE',
] as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[number];

/**
 * One performance objective within a topic — the level the product tracks
 * coverage at (spec section 13).
 *
 * Coverage is two dates on the objective itself. A curriculum already belongs
 * to one class in one session, so "was this taught to this class this year"
 * has one answer, and the date is enough to say when. `assessed_at` can never
 * be set while `taught_at` is null: nothing is tested before it is taught, and
 * clearing "taught" clears "assessed" with it.
 *
 * The code the screen prints (`2.3`) is derived from the topic's sequence and
 * this one's at read time, so renumbering never leaves a stale label behind.
 */
@Entity('learning_objectives')
@Index('IDX_learning_objectives_topic_sequence', ['topicId', 'sequence'])
export class LearningObjective extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_learning_objectives_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_learning_objectives_school' })
  school?: School;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id', foreignKeyConstraintName: 'FK_learning_objectives_topic' })
  topic?: CurriculumTopic;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'bloom_level', type: 'varchar', length: 16, nullable: true })
  bloomLevel: BloomLevel | null;

  @Column({ name: 'taught_at', type: 'date', nullable: true })
  taughtAt: string | null;

  @Column({ name: 'assessed_at', type: 'date', nullable: true })
  assessedAt: string | null;
}
