import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/** A teaching space the timetable can place a lesson in (spec section 16). */
@Entity('rooms')
@Index(['schoolId', 'code'], { unique: true })
export class Room extends SoftDeletableEntity {
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

  @Column({ type: 'int', default: 30 })
  capacity: number;

  @Column({ type: 'varchar', length: 20, default: 'CLASSROOM' })
  type: 'CLASSROOM' | 'LABORATORY' | 'HALL' | 'LIBRARY' | 'OTHER';
}
