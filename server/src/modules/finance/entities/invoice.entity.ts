import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { Term } from '../../academics/entities/term.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { FeeStructure } from './feeStructure.entity';

/**
 * The money states an invoice is *stored* in. `OVERDUE` is deliberately not
 * one of them: it is "still open, and the due date has passed", which is a
 * fact about today's date rather than about the row, and storing it would mean
 * a nightly job to keep it true. The projections derive it in SQL.
 */
export type InvoiceStatus = 'ISSUED' | 'PART_PAID' | 'PAID' | 'CANCELLED';

/** One earlier invoice this one absorbed, recorded so the carry can be undone. */
export interface BroughtForwardSource {
  invoiceId: string;
  invoiceNo: string;
  amount: number;
}

/**
 * What one family owes for one term (spec section 26).
 *
 * No soft delete. A bill that should not have been raised is `CANCELLED`, with
 * a reason and an author — a deleted row cannot explain itself to the parent
 * who was already sent it, and the invoice number must stay taken so it is
 * never reissued to somebody else.
 *
 * Neither `amountPaid` nor `balance` is a column. Both are the sum of
 * successful allocations against this invoice, computed on read; a stored
 * balance is a second source of truth, and it goes wrong the first time a
 * payment write half-fails.
 */
@Entity('invoices')
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'termId'])
@Index(['schoolId', 'status'])
@Index(['schoolId', 'dueDate'])
@Index(['schoolId', 'invoiceNo'], { unique: true })
// Bulk billing's backstop against a double-click or two bursars at once. See
// the migration for why cancelled rows are excluded.
@Index(['feeStructureId', 'studentId', 'termId'], {
  unique: true,
  where: `"fee_structure_id" IS NOT NULL AND "status" <> 'CANCELLED'`,
})
export class Invoice extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  /** `INV/2025-2026/00042` — unique per school, and quoted by the family. */
  @Column({ name: 'invoice_no', type: 'varchar', length: 40 })
  invoiceNo: string;

  /** The number behind the number, so the next one is MAX + 1 per session. */
  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => AcademicSession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Term;

  /** Where the pupil sat when the bill was issued, not where they sit now. */
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @ManyToOne(() => SchoolClass, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass | null;

  /** Set when this came out of a bulk run, which is also what deduplicates it. */
  @Column({ name: 'fee_structure_id', type: 'uuid', nullable: true })
  feeStructureId: string | null;

  @ManyToOne(() => FeeStructure, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fee_structure_id' })
  feeStructure?: FeeStructure | null;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  /** Σ line totals before discounts. `numeric` arrives as a string. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal: string;

  @Column({ name: 'discount_total', type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountTotal: string;

  /** What the family still owed from earlier terms when this was issued. */
  @Column({ name: 'brought_forward', type: 'numeric', precision: 12, scale: 2, default: 0 })
  broughtForward: string;

  /** The invoices that made up `broughtForward`, so cancelling can reopen them. */
  @Column({ name: 'brought_forward_from', type: 'jsonb', default: [] })
  broughtForwardFrom: BroughtForwardSource[];

  /** `subtotal - discountTotal + broughtForward`. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 16, default: 'ISSUED' })
  status: InvoiceStatus;

  /**
   * Set on an invoice that was closed because its balance moved onto a later
   * one. Such a row is `CANCELLED` but is *not* a mistake — it still counts as
   * real billing, which is why the ledger's totals test this column rather
   * than the status alone.
   */
  @Column({ name: 'carried_forward_to_invoice_id', type: 'uuid', nullable: true })
  carriedForwardToInvoiceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_by_user_id', type: 'uuid', nullable: true })
  cancelledByUserId: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @VersionColumn()
  version: number;
}
