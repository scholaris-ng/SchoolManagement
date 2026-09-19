import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { Term } from '../../academics/entities/term.entity';
import { Discount } from './discount.entity';

/**
 * A discount granted to one named student — the link between a `Discount`
 * definition and the invoices that should carry it.
 *
 * The scope decides which bills it reaches: a `termId` limits it to that term,
 * a `sessionId` alone to every term of that session, and neither means "until
 * revoked" (a staff child's concession, a scholarship for the whole stay).
 * `termId` always comes with its own `sessionId`, derived when the grant is
 * written, so a query never has to join `terms` to know which session it is in.
 *
 * Revoking flips `isActive` rather than deleting: an invoice that already
 * carries the discount keeps its own snapshot, but the office's later question
 * — "who gave this family that, and who took it away?" — still has an answer.
 */
@Entity('student_discounts')
@Index(['schoolId', 'studentId', 'isActive'])
@Index(['discountId'])
export class StudentDiscount extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'discount_id', type: 'uuid' })
  discountId: string;

  @ManyToOne(() => Discount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'discount_id' })
  discount?: Discount;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @ManyToOne(() => AcademicSession, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession | null;

  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  termId: string | null;

  @ManyToOne(() => Term, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'term_id' })
  term?: Term | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'granted_by_user_id', type: 'uuid', nullable: true })
  grantedByUserId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId: string | null;
}
