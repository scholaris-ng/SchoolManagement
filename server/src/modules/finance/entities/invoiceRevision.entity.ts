import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Invoice } from './invoice.entity';
import type { InvoiceChange, InvoiceSnapshot } from '../services/invoiceRevisions';

/**
 * One version of one invoice: the invoice as it stood after an edit, what that
 * edit changed, and who made it and why.
 *
 * Written only by `InvoicesService.updateInvoice`, inside the same transaction
 * as the edit itself, so a version can never exist for a change that did not
 * happen or be missing for one that did. Never updated and never deleted
 * except along with its invoice.
 */
@Entity('invoice_revisions')
@Index(['invoiceId', 'revisionNo'], { unique: true })
@Index(['schoolId'])
export class InvoiceRevision extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  /** 1 is the invoice as it stood before its first tracked edit. */
  @Column({ name: 'revision_no', type: 'int' })
  revisionNo: number;

  @Column({ type: 'jsonb' })
  snapshot: InvoiceSnapshot;

  /** What differed from the version before this one. Empty on version 1. */
  @Column({ type: 'jsonb', default: [] })
  changes: InvoiceChange[];

  /** Why the edit was made. Required whenever what the family is billed moved. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** What had been received against the invoice when this version was written. */
  @Column({ name: 'amount_paid', type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountPaid: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 160 })
  createdByName: string;
}
