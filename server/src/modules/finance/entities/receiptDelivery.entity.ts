import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Guardian } from '../../guardians/entities/guardian.entity';
import { Payment } from './payment.entity';

/** How a copy of a receipt left the office. `OTHER` covers post, a courier, or a staff member's own phone. */
export type ReceiptDeliveryChannel = 'PRINT' | 'EMAIL' | 'WHATSAPP' | 'OTHER';

/**
 * Whether the family can be taken to have the receipt.
 *
 * `CONFIRMED` means either this system delivered it itself (an email the
 * mailer accepted) or a member of staff has said so. `PREPARED` is everything
 * this system only started — a page sent to a printer, a WhatsApp message
 * typed but perhaps never sent. `FAILED` is a send that was attempted and
 * refused, kept because "we tried and it bounced" is exactly what the office
 * needs to see.
 */
export type ReceiptDeliveryStatus = 'PREPARED' | 'CONFIRMED' | 'FAILED';

/**
 * One copy of one receipt going out (spec section 26 — a receipt is proof of
 * payment, and proof only helps a family that actually holds it).
 *
 * A payment is recorded once; its receipt may be printed at the desk, emailed
 * to a guardian, and re-sent on WhatsApp a term later when the family loses
 * the paper. Each of those is a row here, so the receipt page can answer "has
 * this gone out, to whom, how, and by whose hand?" without anyone digging
 * through the audit log.
 */
@Entity('receipt_deliveries')
// Both cover the two reads there are: one receipt's log, and a school's copies
// by date. Composite to match the migration's own indexes exactly, so a later
// `migration:generate` does not propose replacing them.
@Index(['paymentId', 'sentAt'])
@Index(['schoolId', 'sentAt'])
export class ReceiptDelivery extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** The payment whose receipt this is — receipts have no identity of their own. */
  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({ type: 'varchar', length: 16 })
  channel: ReceiptDeliveryChannel;

  @Column({ type: 'varchar', length: 16, default: 'PREPARED' })
  status: ReceiptDeliveryStatus;

  /**
   * Who it went to, captured in words at send time so the row still reads
   * correctly after the guardian's record changes or goes. Null for a print,
   * where the paper is simply handed over the counter.
   */
  @Column({ name: 'recipient_name', type: 'varchar', length: 160, nullable: true })
  recipientName: string | null;

  /** The email address or phone number it actually went to, as used. */
  @Column({ name: 'recipient_contact', type: 'varchar', length: 160, nullable: true })
  recipientContact: string | null;

  @Column({ name: 'guardian_id', type: 'uuid', nullable: true })
  guardianId: string | null;

  @ManyToOne(() => Guardian, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'guardian_id' })
  guardian?: Guardian | null;

  /** Which shape of receipt went out — the itemised copy, or the summary. */
  @Column({ name: 'include_charges', type: 'boolean', default: false })
  includeCharges: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Why a `FAILED` send failed, in the words the mailer or gateway gave. */
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'sent_by_user_id', type: 'uuid', nullable: true })
  sentByUserId: string | null;

  @Column({ name: 'sent_by_name', type: 'varchar', length: 160 })
  sentByName: string;

  /**
   * When the copy went out — not `created_at`, because a delivery recorded
   * after the fact ("I posted it on Monday") is dated when it happened.
   */
  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId: string | null;

  @Column({ name: 'confirmed_by_name', type: 'varchar', length: 160, nullable: true })
  confirmedByName: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;
}
