import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { Student } from '../../students/entities/student.entity';
import { Guardian } from './guardian.entity';

export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';

/**
 * Which guardian belongs to which child, and on what terms.
 *
 * A join table carrying the qualities of the relationship itself, because they
 * are properties of the pairing rather than of either side: a father may be the
 * emergency contact for one child and not another, and the person who pays is
 * not always the person who collects.
 */
@Entity('student_guardians')
@Index(['studentId', 'guardianId'], { unique: true })
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'guardianId'])
export class StudentGuardian extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  @Index()
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'guardian_id', type: 'uuid' })
  @Index()
  guardianId: string;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardian_id' })
  guardian?: Guardian;

  @Column({ type: 'varchar', length: 16, default: 'GUARDIAN' })
  relationship: GuardianRelationship;

  /** Who the school calls first. At most one per child, enforced in the service. */
  @Column({ type: 'boolean', name: 'is_primary_contact', default: false })
  isPrimaryContact: boolean;

  @Column({ type: 'boolean', name: 'is_emergency_contact', default: false })
  isEmergencyContact: boolean;

  /** Who invoices are addressed to (spec section 26). */
  @Column({ type: 'boolean', name: 'is_financially_responsible', default: false })
  isFinanciallyResponsible: boolean;

  /**
   * Whether they may collect the child. A safeguarding decision, so it is
   * stored explicitly rather than inferred from the relationship type
   * (spec section 12).
   */
  @Column({ type: 'boolean', name: 'can_pick_up', default: false })
  canPickUp: boolean;
}
