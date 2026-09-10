import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/**
 * One row of the school's daily grid — "Period 1", "Break" (spec section 16).
 *
 * Defined once for the school rather than per class, so every timetable shares
 * the same shape and a lesson can be compared across classes by period.
 */
@Entity('timetable_periods')
@Index(['schoolId', 'sequence'])
export class TimetablePeriod extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** Local wall-clock `HH:mm`, not an instant — a period does not move with DST. */
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'int' })
  sequence: number;

  /** Breaks occupy the grid but hold no lesson. */
  @Column({ type: 'boolean', name: 'is_break', default: false })
  isBreak: boolean;
}
