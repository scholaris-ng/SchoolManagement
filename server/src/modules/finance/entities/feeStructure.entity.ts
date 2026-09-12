import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { Term } from '../../academics/entities/term.entity';

/**
 * What a school charges a group of pupils for one term (spec section 26).
 *
 * This is the sheet a bursar fills in once — "Junior secondary, second term:
 * tuition, exam, development levy, boarding if they board" — and then bills
 * the whole cohort from in one action. It is a *definition*, like a fee item:
 * nothing here says any family owes anything. Generating invoices from it is
 * what makes the claim, and those invoices copy the amounts rather than
 * pointing at them, so editing this next year leaves last year's bills alone.
 *
 * `levelIds` and `classIds` are jsonb arrays rather than join tables because
 * they are a filter the generator applies once, never a relationship anything
 * queries backwards — no screen asks "which structures mention this class?".
 * Empty `levelIds` means every level; empty `classIds` means every class
 * within those levels.
 */
@Entity('fee_structures')
@Index(['schoolId'])
@Index(['schoolId', 'sessionId'])
@Index(['schoolId', 'termId'])
export class FeeStructure extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => AcademicSession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession;

  /**
   * Null means "any term in this session" — the same fees every term, which is
   * how most Nigerian schools bill tuition. Generating from a structure with
   * no term of its own has to be told which term it is billing.
   */
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  termId: string | null;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'term_id' })
  term?: Term | null;

  @Column({ name: 'level_ids', type: 'jsonb', default: [] })
  levelIds: string[];

  @Column({ name: 'class_ids', type: 'jsonb', default: [] })
  classIds: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /** Optimistic lock — two bursars editing one structure must not clobber. */
  @VersionColumn()
  version: number;
}
