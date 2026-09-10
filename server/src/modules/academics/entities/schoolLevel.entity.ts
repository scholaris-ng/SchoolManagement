import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/**
 * A rung on the school's own ladder — Creche, Nursery 1, JSS 1, Year 7,
 * Reception (spec section 6).
 *
 * Never hardcoded: a Nigerian school defines Creche through SSS 3 and a
 * British-curriculum school defines Reception through Year 11, and the same
 * screens and queries serve both.
 */
@Entity('school_levels')
@Index(['schoolId', 'code'], { unique: true })
@Index(['schoolId', 'sequence'])
export class SchoolLevel extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  /** Position in the ladder — what promotion walks up. */
  @Column({ type: 'int' })
  sequence: number;

  /**
   * Set when this level is graded differently from the school default; a
   * nursery marked "Excellent / Good / Fair" alongside a senior school marked
   * A–F. Constrained once grading schemes land in phase 3.
   */
  @Column({ name: 'grading_scheme_id', type: 'uuid', nullable: true })
  gradingSchemeId: string | null;
}
