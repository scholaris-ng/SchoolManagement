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
 * rather than trusting the notification that prompted it; or a member of staff
 * recording cash they took at the desk. A browser returning from a payment
 * page proves nothing and never writes one of these.
 *
 * Which bills a credit settled lives in `payment_allocations`, not here. A
 * payment can pay part of one invoice, all of two, or nothing at all — money
 * on account that the office places later.
 *
 * No soft delete: a payment that was reversed is marked `REVERSED`, not
 * removed. The ledger has to keep adding up to what the bank says.
 */
@Entity('payments')
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'paidAt'])
@Index(['provider', 'providerReference'], { unique: true })
@Index(['verificationCode'], { unique: true })
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

  /**
   * The reference the *payer* quotes — a teller number off a bank slip, a POS
   * terminal's stub, a cheque number. Distinct from `providerReference`, which
   * is unique per provider and could not hold this: two families genuinely do
   * write the same narration on a deposit slip.
   */
  @Column({ name: 'external_reference', type: 'varchar', length: 80, nullable: true })
  externalReference: string | null;

  /**
   * Printed on the receipt so a family can have one checked later. Globally
   * unique, not per school, because the code is the whole lookup — a public
   * `/verify/:code` page is not built yet, but the code is generated and
   * stored from today so receipts issued now stay verifiable when it is.
   */
  @Column({ name: 'verification_code', type: 'varchar', length: 16 })
  verificationCode: string;

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

  /**
   * Whether somebody has checked this credit against the bank statement. A
   * Raven credit is already proven — it was read back from Raven's API — but
   * cash taken at the desk is only ever as good as the count, so the bursar's
   * sign-off is recorded separately from the payment itself.
   */
  @Column({ name: 'is_reconciled', type: 'boolean', default: false })
  isReconciled: boolean;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt: Date | null;

  @Column({ name: 'reconciled_by_user_id', type: 'uuid', nullable: true })
  reconciledByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Null for a provider credit: nobody in the office keyed it in. */
  @Column({ name: 'recorded_by_user_id', type: 'uuid', nullable: true })
  recordedByUserId: string | null;

  /** Set together, or not at all: when a `REVERSED` payment was undone, by whom, and why. */
  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ name: 'reversed_by_user_id', type: 'uuid', nullable: true })
  reversedByUserId: string | null;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason: string | null;

  @Column({ name: 'provider_payload', type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;
}
