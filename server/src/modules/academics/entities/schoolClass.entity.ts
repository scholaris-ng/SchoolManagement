import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolLevel } from './schoolLevel.entity';
import { Room } from './room.entity';
import { ClassFormTeacher } from './classFormTeacher.entity';

/** A teaching group within a level — "JSS 1A" (spec section 6). */
@Entity('school_classes')
@Index(['schoolId', 'code'], { unique: true })
@Index(['schoolId', 'levelId'])
@Index(['schoolId', 'isActive'])
export class SchoolClass extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'level_id', type: 'uuid' })
  @Index()
  levelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: SchoolLevel;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** The streaming suffix — "A", "Gold", "Blue" — where a school uses one. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  arm: string | null;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'int', default: 40 })
  capacity: number;

  /**
   * Kept in step with enrolment rather than counted per read: a class list is
   * on every dashboard and picker, and counting rows each time would be a
   * query per class per page.
   */
  @Column({ name: 'enrolled_count', type: 'int', default: 0 })
  enrolledCount: number;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne(() => Room, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'room_id' })
  room?: Room | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => ClassFormTeacher, (link) => link.schoolClass)
  formTeacherLinks?: ClassFormTeacher[];
}
