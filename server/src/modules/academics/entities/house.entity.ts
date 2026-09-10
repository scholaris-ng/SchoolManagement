import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/** A house pupils are sorted into and earn points for (spec section 25). */
@Entity('houses')
@Index(['schoolId', 'name'], { unique: true })
export class House extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: '#2563eb' })
  color: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motto: string | null;

  /** Constrained once the students table lands in phase 2. */
  @Column({ name: 'captain_student_id', type: 'uuid', nullable: true })
  captainStudentId: string | null;

  /**
   * Running total, incremented as points are awarded rather than summed over
   * the award ledger on every read — a leaderboard is on every dashboard, and
   * the alternative is an aggregate per house per page load.
   */
  @Column({ type: 'int', default: 0 })
  points: number;
}
