import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Term } from './term.entity';

/** An academic year, named by the school — "2025/2026" (spec section 9). */
@Entity('academic_sessions')
// Partial so a deleted session's name is free to reuse — a plain unique index
// would still see the soft-deleted row and block recreating "2026/2027" after
// deleting it.
@Index(['schoolId', 'name'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['schoolId', 'isCurrent'])
export class AcademicSession extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  /**
   * Mirrors whichever term is current. The term is the switch an administrator
   * actually throws; this follows it so queries that only care about the year
   * do not have to join through terms.
   */
  @Column({ type: 'boolean', name: 'is_current', default: false })
  isCurrent: boolean;

  @Column({ type: 'varchar', length: 16, default: 'PLANNED' })
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';

  @OneToMany(() => Term, (term) => term.session)
  terms?: Term[];
}
