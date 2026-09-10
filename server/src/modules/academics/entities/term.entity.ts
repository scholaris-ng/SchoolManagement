import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { AcademicSession } from './academicSession.entity';

/** A term within a session. The unit almost everything academic is scoped by. */
@Entity('terms')
@Index(['schoolId', 'sessionId', 'sequence'], { unique: true })
@Index(['schoolId', 'isCurrent'])
export class Term extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'session_id', type: 'uuid' })
  @Index()
  sessionId: string;

  @ManyToOne(() => AcademicSession, (session) => session.terms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  /**
   * Derived from the dates on every write, never accepted from the request — a
   * term's length is a fact about when it runs, and a scheme of work plans
   * against this number.
   */
  @Column({ name: 'teaching_weeks', type: 'int', default: 0 })
  teachingWeeks: number;

  @Column({ type: 'boolean', name: 'is_current', default: false })
  isCurrent: boolean;

  @Column({ type: 'varchar', length: 16, default: 'PLANNED' })
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
}
