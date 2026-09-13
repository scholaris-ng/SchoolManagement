import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Curriculum } from './curriculum.entity';

/**
 * One unit of a curriculum, in teaching order (spec section 13). "Suggested
 * weeks" is what scheme generation spreads a term's weeks across.
 */
@Entity('curriculum_topics')
@Index('IDX_curriculum_topics_curriculum_sequence', ['curriculumId', 'sequence'])
export class CurriculumTopic extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_curriculum_topics_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_curriculum_topics_school' })
  school?: School;

  @Column({ name: 'curriculum_id', type: 'uuid' })
  curriculumId: string;

  @ManyToOne(() => Curriculum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'FK_curriculum_topics_curriculum' })
  curriculum?: Curriculum;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'suggested_weeks', type: 'int', default: 1 })
  suggestedWeeks: number;
}
