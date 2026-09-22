import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SmsMessage } from './smsMessage.entity';

/**
 * `TOPUP` and `ADJUSTMENT` are a platform administrator's doing; `DEBIT` and
 * `REFUND` are the send path's. `units` is signed: positive adds, negative takes.
 */
export const SMS_CREDIT_ENTRY_TYPES = ['TOPUP', 'DEBIT', 'REFUND', 'ADJUSTMENT'] as const;
export type SmsCreditEntryType = (typeof SMS_CREDIT_ENTRY_TYPES)[number];

/**
 * One movement of a school's prepaid SMS credit.
 *
 * The balance itself lives on `schools.sms_credits`, where the send path can
 * check and decrement it in one statement. This table is the explanation: a
 * school asking "where did our 500 units go?" gets a list, and a platform
 * administrator asking "who topped this up and when?" gets a name.
 */
@Entity('sms_credit_entries')
@Index(['schoolId', 'createdAt'])
export class SmsCreditEntry extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 12 })
  type: SmsCreditEntryType;

  /** Signed: a top-up of 500 is `500`, a two-page message is `-2`. */
  @Column({ type: 'int' })
  units: number;

  /** The school's balance once this entry had applied. */
  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  /** For a top-up: what was paid, in naira, and the per-page price it bought at. */
  @Column({ name: 'amount_ngn', type: 'numeric', precision: 12, scale: 2, nullable: true })
  amountNgn: string | null;

  @Column({ name: 'unit_price_ngn', type: 'numeric', precision: 10, scale: 2, nullable: true })
  unitPriceNgn: string | null;

  /** "Paid by transfer on 22 Sep" — whatever the administrator wants remembered. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** For a debit or refund: the message it was for. */
  @Column({ name: 'sms_message_id', type: 'uuid', nullable: true })
  smsMessageId: string | null;

  @ManyToOne(() => SmsMessage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sms_message_id' })
  smsMessage?: SmsMessage | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  /** The administrator's email, or "System" for the send path. */
  @Column({ name: 'actor_name', type: 'varchar', length: 160, nullable: true })
  actorName: string | null;
}
