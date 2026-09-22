import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { PaymentAllocation } from './paymentAllocation.entity';
import { InvoiceLine } from './invoiceLine.entity';

/**
 * How much of one allocation settled one specific charge on that invoice.
 *
 * Optional and additive to `PaymentAllocation`: most allocations carry none
 * of these, which means the office paid the invoice as a whole rather than
 * naming which charge the money was for. Where rows do exist for an
 * allocation, they always sum to that allocation's own `amount` exactly — a
 * partial, unexplained remainder would leave a line's balance ambiguous, so
 * `PaymentsService` refuses to write one. Unlike `paidLineIds` on the parent
 * allocation, this is real money: an invoice line's own balance is
 * `lineTotal` minus the sum of these, not a label on a receipt.
 */
@Entity('payment_line_allocations')
@Index(['paymentAllocationId'])
@Index(['invoiceLineId'])
@Index(['paymentAllocationId', 'invoiceLineId'], { unique: true })
export class PaymentLineAllocation extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'payment_allocation_id', type: 'uuid' })
  paymentAllocationId: string;

  @ManyToOne(() => PaymentAllocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_allocation_id' })
  paymentAllocation?: PaymentAllocation;

  @Column({ name: 'invoice_line_id', type: 'uuid' })
  invoiceLineId: string;

  @ManyToOne(() => InvoiceLine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_line_id' })
  invoiceLine?: InvoiceLine;

  /** Always positive — a check constraint enforces it in the database too. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;
}
