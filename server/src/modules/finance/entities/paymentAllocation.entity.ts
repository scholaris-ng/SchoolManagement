import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';

/**
 * How much of one payment settled one invoice (spec section 26).
 *
 * This is the join that makes instalments work without a schedule table: a
 * family pays ₦80,000 against a ₦185,000 bill, and the invoice becomes
 * `PART_PAID` because the allocations against it sum to less than its total.
 * Three payments against the same invoice are three rows; one payment split
 * across two children's invoices is two.
 *
 * A payment may also be recorded with no allocation at all — money on account,
 * which the office assigns to a bill later. `unallocatedAmount` on the payment
 * projection is what is left over.
 *
 * `RESTRICT` to the invoice: an invoice something was paid against must never
 * vanish, and cancellation is refused once any money has landed on it anyway.
 */
@Entity('payment_allocations')
@Index(['paymentId'])
@Index(['invoiceId'])
@Index(['paymentId', 'invoiceId'], { unique: true })
export class PaymentAllocation extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  /** Always positive — a check constraint enforces it in the database too. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  /** Null when Raven's own credit allocated itself against a tied invoice. */
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /**
   * Which of the invoice's `invoice_lines` the office says this payment
   * covered — an annotation for the receipt, not a second allocation ledger.
   * Empty means nobody has marked anything, which the receipt reads as "the
   * whole invoice", same as before this column existed. See
   * `PaymentsService.markReceiptItems`.
   */
  @Column({ name: 'paid_line_ids', type: 'jsonb', default: [] })
  paidLineIds: string[];
}
