import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Term } from '../../academics/entities/term.entity';
import { User } from '../../auth/entities/user.entity';
import { BehaviourTrait } from './behaviourTrait.entity';

/**
 * One rating of one pupil on one trait, on the day it was noticed (spec
 * section 23). Recorded through the term as things happen; the report card's
 * behaviour section is the average of these, never a number typed in at the
 * end. Append-only — a mistaken observation is followed by a better one, not
 * rewritten.
 */
@Entity('behaviour_observations')
@Index('IDX_behaviour_observations_student_term', ['studentId', 'termId'])
@Index('IDX_behaviour_observations_school_observed', ['schoolId', 'observedAt'])
export class BehaviourObservation extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_behaviour_observations_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_behaviour_observations_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_behaviour_observations_student' })
  student?: Student;

  @Column({ name: 'trait_id', type: 'uuid' })
  traitId: string;

  @ManyToOne(() => BehaviourTrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trait_id', foreignKeyConstraintName: 'FK_behaviour_observations_trait' })
  trait?: BehaviourTrait;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_behaviour_observations_term' })
  term?: Term;

  @Column({ type: 'int' })
  rating: number;

  /** Captured with the observation: a scale edited later must not re-grade the past. */
  @Column({ name: 'scale_max', type: 'int' })
  scaleMax: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'observed_by_user_id', type: 'uuid', nullable: true })
  observedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'observed_by_user_id', foreignKeyConstraintName: 'FK_behaviour_observations_observed_by' })
  observedBy?: User | null;

  @Column({ name: 'observed_by_name', type: 'varchar', length: 160 })
  observedByName: string;

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date;
}
