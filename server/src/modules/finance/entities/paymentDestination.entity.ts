import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';

/**
 * A bank account a school gets paid into — managed once, in one place, and
 * referenced by id from wherever it applies: a fee item's own charges
 * (`FeeItem.paymentDestinationIds`), a particular fee structure's narrower
 * pick of those (`FeeStructureLine.accountIds`), or a one-off custom bill
 * (`CustomBill.paymentDestinationIds`).
 *
 * This replaces an earlier design where each fee item held its own private
 * copies of the same bank details, which meant a school changing its main
 * account had to go and re-type it on every fee item that used it. An
 * invoice line still copies the details it was raised under
 * (`InvoiceLineAccountSnapshot`) — that stays a snapshot on purpose, so an
 * account edited or deleted here never rewrites a bill already sent — but
 * everywhere a charge is still being *defined*, it now points at one of
 * these rather than owning its own copy.
 *
 * No database-level uniqueness on `(schoolId, bankName, accountNumber)`:
 * the data this table is seeded from (`1791500000000-PaymentDestinations`)
 * already has the same real account entered under more than one fee item,
 * and a hard constraint would have made that migration fail outright.
 * `PaymentDestinationsService.create` checks for an existing match itself
 * and refuses a new one, which is enough to stop *new* duplicates without
 * requiring the historical data to already be clean.
 */
@Entity('payment_destinations')
@Index(['schoolId'])
export class PaymentDestination extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** A nickname to tell accounts apart when picking one — "Main account", "PTA account". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 80 })
  bankName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ name: 'account_name', type: 'varchar', length: 160 })
  accountName: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
