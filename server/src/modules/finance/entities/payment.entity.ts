import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { PaymentAccount } from './paymentAccount.entity';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'CHEQUE';
export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';
export type PaymentSource = 'RAVEN' | 'MANUAL';

/**
 * Money that arrived (spec section 27).
 *
 * A row here is written only from something that proves the money moved: a
 * provider's own record of a credit, confirmed by calling the provider back
 * rather than trusting the notification that prompted it; or, later, a member
 * of staff recording cash they took at the desk. A browser returning from a
 * payment page proves nothing and never writes one of these.
 *
 * No soft delete: a payment that was reversed is marked `REVERSED`, not
 * removed. The ledger has to keep adding up to what the bank says.
 */
@Entity('payments')
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'paidAt'])
@Index(['provider', 'providerReference'], { unique: true })
export class Payment extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ManyToOne(() => Student, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  /** The account this arrived into, where a provider issued one. */
  @Column({ name: 'payment_account_id', type: 'uuid', nullable: true })
  paymentAccountId: string | null;

  @ManyToOne(() => PaymentAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount?: PaymentAccount | null;

  /** Ours — printed on the receipt and quoted by a parent. `PAY-20260912-3F9A2C`. */
  @Column({ type: 'varchar', length: 40 })
  reference: string;

  @Column({ type: 'varchar', length: 20 })
  provider: PaymentSource;

  /**
   * The provider's own id for the credit — Raven's `session_id`. Unique per
   * provider, which is what makes a notification delivered twice harmless.
   */
  @Column({ name: 'provider_reference', type: 'varchar', length: 80, nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethod;

  /** `numeric` reaches the driver as a string; the DTO layer is where it becomes a number. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  fee: string;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'SUCCESSFUL' })
  status: PaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  /** Who paid, as the bank reported it — a name and account, when Raven passes one on. */
  @Column({ name: 'payer_name', type: 'varchar', length: 160, nullable: true })
  payerName: string | null;

  @Column({ name: 'is_reconciled', type: 'boolean', default: false })
  isReconciled: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Null for a provider credit: nobody in the office keyed it in. */
  @Column({ name: 'recorded_by_user_id', type: 'uuid', nullable: true })
  recordedByUserId: string | null;

  @Column({ name: 'provider_payload', type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;
}
