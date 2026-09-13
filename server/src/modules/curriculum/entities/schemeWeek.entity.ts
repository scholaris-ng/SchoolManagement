import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchemeOfWork } from './schemeOfWork.entity';
import { CurriculumTopic } from './curriculumTopic.entity';

/**
 * One week of a scheme (spec section 14). The topic and its objectives are
 * copied in by title and statement, not merely linked: a scheme is a document
 * the teacher was approved against, and it must still read the same after the
 * curriculum is edited. `topicId` is kept so coverage can still be traced.
 */
@Entity('scheme_weeks')
@Index('IDX_scheme_weeks_scheme_week', ['schemeId', 'weekNumber'], { unique: true })
export class SchemeWeek extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_scheme_weeks_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_scheme_weeks_school' })
  school?: School;

  @Column({ name: 'scheme_id', type: 'uuid' })
  schemeId: string;

  @ManyToOne(() => SchemeOfWork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id', foreignKeyConstraintName: 'FK_scheme_weeks_scheme' })
  scheme?: SchemeOfWork;

  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'topic_id', foreignKeyConstraintName: 'FK_scheme_weeks_topic' })
  topic?: CurriculumTopic | null;

  @Column({ name: 'topic_title', type: 'varchar', length: 200, default: '' })
  topicTitle: string;

  @Column({ name: 'objective_ids', type: 'uuid', array: true, default: () => "'{}'" })
  objectiveIds: string[];

  @Column({ name: 'objective_statements', type: 'text', array: true, default: () => "'{}'" })
  objectiveStatements: string[];

  @Column({ type: 'text', nullable: true })
  activities: string | null;

  @Column({ type: 'text', nullable: true })
  resources: string | null;

  @Column({ name: 'is_break', type: 'boolean', default: false })
  isBreak: boolean;
}
