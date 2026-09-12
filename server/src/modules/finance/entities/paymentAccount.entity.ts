import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Invoice } from './invoice.entity';

export type PaymentProvider = 'RAVEN';

export type PaymentAccountStatus = 'ACTIVE' | 'PAID' | 'CLOSED';

/**
 * A bank account number a family can transfer school fees into, issued by a
 * payment provider for one student and one amount (spec section 27).
 *
 * Raven's collection accounts are not permanent: each is generated for a
 * specific amount and customer, so a school raises one per bill — "Amina
 * Sule, second term, ₦185,000" — rather than one per child for life. Anything
 * credited to the number is matched back to this row, which is what turns an
 * anonymous bank transfer into a payment against a named student.
 */
@Entity('payment_accounts')
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['provider', 'accountNumber'], { unique: true })
@Index(['invoiceId'])
export class PaymentAccount extends BaseEntity {
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

  /**
   * The bill this account was raised for, when it was raised for one. A credit
   * landing on a tied account allocates itself against that invoice, which is
   * the difference between a transfer that pays a bill and a transfer that
   * merely arrives and waits for the office to say what it was for.
   */
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice | null;

  @Column({ type: 'varchar', length: 20 })
  provider: PaymentProvider;

  @Column({ name: 'account_number', type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ name: 'account_name', type: 'varchar', length: 160 })
  accountName: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 80 })
  bankName: string;

  /** What the family was asked to pay. `numeric` reaches the driver as a string. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'is_permanent', type: 'boolean', default: false })
  isPermanent: boolean;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: PaymentAccountStatus;

  /** What the bill was for, in the office's own words — "Second term fees". */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /** Raven's response, verbatim, for anything a support question needs later. */
  @Column({ name: 'provider_payload', type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;
}
