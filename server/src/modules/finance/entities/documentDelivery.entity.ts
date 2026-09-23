import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Guardian } from '../../guardians/entities/guardian.entity';

/**
 * Which finance document a copy was of.
 *
 * `RECEIPT` is keyed by its payment, since a receipt has no identity of its own
 * — see `PaymentsService.fetchReceipt`.
 */
export type DeliveryDocumentType = 'RECEIPT' | 'INVOICE' | 'BILL' | 'FEE_SCHEDULE';

/** How a copy reached the family. `OTHER` is post, a courier, or a staff member's own phone. */
export type DeliveryChannel = 'PRINT' | 'EMAIL' | 'WHATSAPP' | 'OTHER';

/**
 * Which shape of paper came out of the printer.
 *
 * `POS` is the narrow black-and-white slip a thermal roll takes; `FULL_PAGE` is
 * the whole document on A4 or a half sheet. Worth keeping apart, because at a
 * desk these are two different acts: one produces a document a parent files, the
 * other a till slip handed over on the spot — and a family holding only the slip
 * may well come back asking for "the proper one".
 */
export type PrintFormat = 'POS' | 'FULL_PAGE';

/**
 * How much is actually known about a copy going out.
 *
 * `CONFIRMED` means either this system delivered it itself (an email the mailer
 * accepted) or a member of staff has said so. `PREPARED` is everything this
 * system only started — a page sent to a printer, a WhatsApp message typed but
 * perhaps never sent. `FAILED` is a send that was attempted and refused, kept
 * because "we tried and it bounced" is exactly what the office needs to see.
 */
export type DeliveryStatus = 'PREPARED' | 'CONFIRMED' | 'FAILED';

/**
 * One copy of one finance document going out (spec sections 25–27).
 *
 * A document is raised once; the copies of it are many — printed at the desk,
 * emailed to a guardian, sent again on WhatsApp a term later when the family
 * loses the paper. Each of those is a row here, which is what lets the office
 * answer "has this gone out, to whom, how, and by whose hand?" for any document
 * it issues, and see every one of them on a single register.
 */
@Entity('document_deliveries')
// Composite, matching the migration's own indexes exactly, so a later
// `migration:generate` does not propose replacing them.
@Index(['documentType', 'documentId', 'sentAt'])
@Index(['schoolId', 'sentAt'])
@Index(['schoolId', 'status'])
export class DocumentDelivery extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'document_type', type: 'varchar', length: 16 })
  documentType: DeliveryDocumentType;

  /**
   * The document this was a copy of — a payment, invoice, custom bill or fee
   * structure id, according to `documentType`.
   *
   * No foreign key on purpose: it points at one of four tables, and a delivery
   * has to stay readable after the document behind it is cancelled or deleted.
   * See the migration for the full reasoning.
   */
  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  /** `INV-2026-0007`, captured at send time so the register reads without a join. */
  @Column({ name: 'document_label', type: 'varchar', length: 80 })
  documentLabel: string;

  /** Null for a document that is not about one child — a fee schedule, a custom bill. */
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ManyToOne(() => Student, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  /** Captured too, so the row still names the child after they leave the school. */
  @Column({ name: 'student_name', type: 'varchar', length: 160, nullable: true })
  studentName: string | null;

  @Column({ type: 'varchar', length: 16 })
  channel: DeliveryChannel;

  /**
   * Which shape of paper this was, for a `PRINT`. Null on every other channel —
   * a check constraint enforces that, so an emailed copy can never claim a paper
   * size.
   */
  @Column({ name: 'print_format', type: 'varchar', length: 16, nullable: true })
  printFormat: PrintFormat | null;

  @Column({ type: 'varchar', length: 16, default: 'PREPARED' })
  status: DeliveryStatus;

  /**
   * Who it went to, in words at send time. Null for a print, where the paper is
   * simply handed across the counter.
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

  /** Whether the copy carried each invoice's itemised charges. Only meaningful on a receipt. */
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
   * When the copy went out — not `created_at`, because a delivery recorded after
   * the fact ("I posted it on Monday") is dated when it happened.
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
