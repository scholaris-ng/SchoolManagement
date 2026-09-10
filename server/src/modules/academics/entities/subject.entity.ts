import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SubjectLevel } from './subjectLevel.entity';

/** A weekly slot in a subject's usual spread, independent of any class's timetable. */
export interface SubjectScheduleSlot {
  day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  periodId: string;
}

/** Something the school teaches (spec section 6). */
@Entity('subjects')
@Index(['schoolId', 'code'], { unique: true })
@Index(['schoolId', 'isActive'])
export class Subject extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  /** Core subjects are taken by everyone at the level; electives are chosen. */
  @Column({ type: 'boolean', name: 'is_core', default: true })
  isCore: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  /**
   * A default weekly shape used when generating a timetable. Genuinely dynamic
   * configuration, read and written whole, never queried across rows.
   */
  @Column({ type: 'jsonb', default: [] })
  schedule: SubjectScheduleSlot[];

  @OneToMany(() => SubjectLevel, (link) => link.subject)
  levelLinks?: SubjectLevel[];
}
