import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

export interface CustomBillLine {
  description: string;
  amount: number;
}

/**
 * A one-off bill for whoever or whatever a school needs to invoice outside
 * its own enrolled students — a contractor, a visiting examiner, a single
 * charge to a prospective family before admission is final — where forcing a
 * real student record onto it would be a fiction.
 *
 * Deliberately outside the real billing system: it never touches a student's
 * balance, the debtors list, or payment allocation (spec section 26 is about
 * `Invoice`, not this), because there is no student behind it for any of
 * that to mean anything about. It exists purely to be printed or shared —
 * the same letterhead treatment a real invoice gets, addressed by a name
 * typed in rather than a student record.
 */
@Entity('custom_bills')
@Index(['schoolId'])
export class CustomBill extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'payer_name', type: 'varchar', length: 200 })
  payerName: string;

  @Column({ type: 'jsonb' })
  lines: CustomBillLine[];

  /** Σ line amounts — stored so a total is one read, recomputed on every write. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: string;

  /** Printed bold, the same as a generated invoice's note. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /**
   * Which of the school's centrally-managed accounts (`PaymentDestination`)
   * settle this bill — a bill-level list, not per line: a custom bill's
   * charges are freeform text, not fee items with their own accounts, so
   * there is nothing to attach an account to but the bill as a whole. Any
   * one of these settles the full total; they are alternatives, not a split.
   */
  @Column({ name: 'payment_destination_ids', type: 'jsonb', default: [] })
  paymentDestinationIds: string[];

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;
}
