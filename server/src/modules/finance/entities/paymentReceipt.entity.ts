import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';
import type { PaymentMethod } from './payment.entity';

export type PaymentReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * A family's own evidence of a payment made outside the system — a bank
 * teller slip, a transfer alert, a POS stub — photographed and submitted for
 * the office to check, since nothing here proves money moved the way a
 * provider's own API confirmation does (spec section 27).
 *
 * This is deliberately not a `Payment`. A row here is a *claim*, and stays
 * one — visible only to the family who made it and the staff who must judge
 * it — until a member of staff approves it, at which point a real `Payment`
 * is written and `paymentId` points at it. A rejected or still-pending claim
 * never appears on the ledger, so a forged or duplicated slip cannot inflate
 * what a family is credited with just by being uploaded.
 */
@Entity('payment_receipts')
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'status'])
export class PaymentReceipt extends BaseEntity {
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

  /** Which bill the family says this settles. Null means money on account. */
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice | null;

  /** What the family says they paid — checked against the slip by the office, not by this server. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethod;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  /** The teller number or transfer reference off the slip, in the family's own words. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** The Cloudinary link the slip was uploaded to — stable, so nothing re-signs it on read. */
  @Column({ name: 'file_url', type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: PaymentReceiptStatus;

  @Column({ name: 'submitted_by_user_id', type: 'uuid', nullable: true })
  submittedByUserId: string | null;

  /** Captured at submission so this still reads correctly once the parent's account is gone. */
  @Column({ name: 'submitted_by_name', type: 'varchar', length: 160 })
  submittedByName: string;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: 'reviewed_by_name', type: 'varchar', length: 160, nullable: true })
  reviewedByName: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  /** Why it was rejected, or a note the office added while approving. */
  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  /** Set once approved — the real payment this claim turned into. */
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;
}
