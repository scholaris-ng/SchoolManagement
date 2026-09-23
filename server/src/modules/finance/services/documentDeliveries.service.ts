import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { guardianGreeting } from '../../../shared/utils/whatsapp';
import { resolveTimezone } from '../../../shared/utils/timezone';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { CustomBillRepository } from '../repositories/customBill.repository';
import { FeeStructureRepository } from '../repositories/feeStructure.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { DocumentDeliveryRepository } from '../repositories/documentDelivery.repository';
import type {
  DeliveryChannel,
  DeliveryDocumentType,
  DeliveryStatus,
  PrintFormat,
} from '../entities/documentDelivery.entity';
import type { DocumentDeliveryDTO } from '../dto/finance.dto';
import type {
  FetchDeliveriesQuery,
  LogPrintDeliveryInput,
  RecordDeliveryInput,
} from '../validators/documentDeliveries.schema';

/**
 * Which document a copy was of, as the sending code already knows it.
 *
 * The label and the child's name are passed in rather than looked up, because
 * every caller is holding the document's own DTO at the moment it sends — and
 * because these are *captured* values: what the document was called when it went
 * out, which must not change afterwards.
 */
export interface DeliveryDocument {
  type: DeliveryDocumentType;
  id: string;
  label: string;
  studentId?: string | null;
  studentName?: string | null;
}

/** What a send knows about the copy it just made. */
export interface DeliveryEntry {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  /** Only meaningful on `PRINT`; `write` drops it on any other channel. */
  printFormat?: PrintFormat | null;
  recipientName?: string | null;
  recipientContact?: string | null;
  guardianId?: string | null;
  includeCharges?: boolean;
  note?: string | null;
  failureReason?: string | null;
  sentAt?: Date;
}

/**
 * The register of finance documents that have left the office — receipts,
 * invoices, custom bills and fee schedules (spec sections 25–27).
 *
 * A document only does its job once the family holds it, and the ways it reaches
 * them — paper over the counter, an email, a WhatsApp message — leave no shared
 * trace the office can work from. The audit log records the *act*, for security;
 * this records the *delivery*, for the bursar with a parent on the phone saying
 * they never got it.
 *
 * Nothing here decides whether a copy arrived. `status` says only as much as is
 * actually known: an email the mailer accepted is `CONFIRMED`, a page sent to a
 * printer or a message handed to WhatsApp is `PREPARED` until a person says
 * otherwise, and a refused send is `FAILED`. A register that claimed more than
 * that would be worth less than no register at all.
 *
 * Depends on repositories only, never on the services that send: those four —
 * `PaymentsService`, `InvoicesService`, `CustomBillsService`,
 * `FeeStructuresService` — all depend on this one.
 */
export class DocumentDeliveriesService {
  static Instance = new DocumentDeliveriesService();

  private constructor(
    private readonly deliveries = DocumentDeliveryRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly invoices = InvoiceRepository.Instance,
    private readonly bills = CustomBillRepository.Instance,
    private readonly structures = FeeStructureRepository.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Reads ----------------------------------------------------------------- */

  /** The whole register, for the "Documents sent" screen. */
  async fetchDeliveries(
    context: RequestContext,
    query: FetchDeliveriesQuery,
  ): Promise<Paginated<DocumentDeliveryDTO>> {
    // Only a date bound needs the school's zone, so an unfiltered page pays for
    // no extra read.
    const timezone =
      query.dateFrom || query.dateTo ? await this.schoolTimezone(context.schoolId) : undefined;
    return this.deliveries.fetchPaginated(context.schoolId, { ...query, timezone });
  }

  /** One document's own history, for the card on its page. */
  async fetchForDocument(
    context: RequestContext,
    type: DeliveryDocumentType,
    id: string,
  ): Promise<DocumentDeliveryDTO[]> {
    await this.resolveDocument(context, type, id);
    return this.deliveries.findForDocument(context.schoolId, type, id);
  }

  /* -- Writes ----------------------------------------------------------------- */

  /**
   * Records a copy the office sent by its own means — paper handed across the
   * counter, a message from a staff member's own phone, a posted copy.
   *
   * These are `CONFIRMED` on a member of staff's word, which is the strongest
   * evidence there can be for a delivery this system never touched. Entries a
   * send makes for itself go through `log` instead.
   */
  async record(
    context: RequestContext,
    type: DeliveryDocumentType,
    id: string,
    input: RecordDeliveryInput,
  ): Promise<DocumentDeliveryDTO> {
    const document = await this.resolveSendable(context, type, id);

    const sentAt = input.sentAt ? new Date(input.sentAt) : new Date();
    if (Number.isNaN(sentAt.getTime())) throw AppError.validation('That date is not valid.');
    // A delivery is something that has happened. A date in the future would let
    // the register say a document is already out when it is not; a minute of
    // slack absorbs a desk clock that runs fast.
    if (sentAt.getTime() > Date.now() + 60_000) {
      throw AppError.validation('A document cannot have been sent in the future.');
    }

    let recipientName = input.recipientName?.trim() || null;
    let recipientContact = input.recipientContact?.trim() || null;

    // Naming a guardian is the usual case, and it fills in who it went to, so
    // nobody retypes an address that is already on file.
    if (input.guardianId) {
      if (!document.studentId) {
        throw AppError.validation('This document is not about a particular student.');
      }
      const link = await this.guardians.findLinkByPair(
        context.schoolId,
        document.studentId,
        input.guardianId,
      );
      if (!link) throw AppError.validation('That guardian is not linked to this student.');

      const guardian = await this.guardians.findByIdScoped(context.schoolId, input.guardianId);
      if (!guardian) throw AppError.notFound('Guardian');
      recipientName = recipientName ?? guardianGreeting(guardian);
      recipientContact =
        recipientContact ??
        (input.channel === 'EMAIL' ? guardian.email : guardian.phone ?? guardian.altPhone) ??
        null;
    }

    return this.write(context, document, {
      channel: input.channel,
      status: 'CONFIRMED',
      printFormat: input.printFormat ?? null,
      recipientName,
      recipientContact,
      guardianId: input.guardianId ?? null,
      includeCharges: input.includeCharges,
      note: input.note?.trim() || null,
      sentAt,
    });
  }

  /**
   * A print the browser has just started.
   *
   * `PREPARED`, never confirmed: the print dialog belongs to the operating
   * system, so nothing here knows whether paper came out, let alone whether it
   * reached the family. Somebody at the desk confirms it, or it stands as what it
   * is — a document that was printed and may still be sitting on the tray.
   */
  async logPrint(
    context: RequestContext,
    type: DeliveryDocumentType,
    id: string,
    input: LogPrintDeliveryInput,
  ): Promise<DocumentDeliveryDTO> {
    const document = await this.resolveSendable(context, type, id);
    return this.write(context, document, {
      channel: 'PRINT',
      status: 'PREPARED',
      // The browser is the only thing that knows which of the two the person
      // chose in the print dialog a moment ago, so it says.
      printFormat: input.printFormat,
      includeCharges: input.includeCharges,
      note: input.note?.trim() || null,
    });
  }

  /**
   * The entry a send makes for itself — an email the mailer took, or a message
   * handed to WhatsApp.
   *
   * Separate from `record` because the status is not the caller's to claim: it
   * follows from what the channel can actually prove. Callers inside this server
   * have already loaded the document, so — unlike `record` — this neither looks
   * it up again nor re-checks that it may be sent.
   */
  async log(
    context: RequestContext,
    document: DeliveryDocument,
    entry: DeliveryEntry,
  ): Promise<DocumentDeliveryDTO> {
    return this.write(context, document, entry);
  }

  /**
   * "Yes, the family has this" — the one thing a person can add that the system
   * cannot work out for itself: whether the paper was handed over, or Send was
   * actually pressed in WhatsApp.
   */
  async confirm(context: RequestContext, id: string): Promise<DocumentDeliveryDTO> {
    const entity = await this.deliveries.findEntity(context.schoolId, id);
    if (!entity) throw AppError.notFound('Delivery record');
    if (entity.status === 'CONFIRMED') {
      throw AppError.conflict('This copy is already recorded as delivered.');
    }
    if (entity.status === 'FAILED') {
      throw AppError.validation(
        'That send failed, so it cannot be confirmed. Record the copy you sent instead.',
      );
    }

    const applied = await this.deliveries.confirm(context.schoolId, id, {
      userId: context.user.id,
      name: context.user.displayName,
    });
    if (!applied) throw AppError.conflict('This copy is already recorded as delivered.');

    await this.audit.record(context, {
      action: 'document.delivery.confirmed',
      entityType: 'DocumentDelivery',
      entityId: id,
      entityLabel: `${entity.documentLabel} · ${entity.channel}`,
      after: { status: 'CONFIRMED' },
    });

    const row = await this.deliveries.findOneRow(context.schoolId, id);
    if (!row) throw AppError.internal();
    return row;
  }

  /* -- Internals --------------------------------------------------------------- */

  private async write(
    context: RequestContext,
    document: DeliveryDocument,
    entry: DeliveryEntry,
  ): Promise<DocumentDeliveryDTO> {
    const created = await this.deliveries.create({
      schoolId: context.schoolId,
      documentType: document.type,
      documentId: document.id,
      documentLabel: document.label,
      studentId: document.studentId ?? null,
      studentName: document.studentName ?? null,
      channel: entry.channel,
      // Only paper has a shape. Dropped rather than trusted on any other
      // channel, so the column matches its check constraint whatever a caller
      // passes — an emailed copy has no paper size to claim.
      printFormat: entry.channel === 'PRINT' ? entry.printFormat ?? null : null,
      status: entry.status,
      recipientName: entry.recipientName ?? null,
      recipientContact: entry.recipientContact ?? null,
      guardianId: entry.guardianId ?? null,
      includeCharges: entry.includeCharges ?? false,
      note: entry.note ?? null,
      failureReason: entry.failureReason ?? null,
      sentByUserId: context.user.id,
      sentByName: context.user.displayName,
      sentAt: entry.sentAt ?? new Date(),
    });

    await this.audit.record(context, {
      action: 'document.delivery.recorded',
      entityType: 'DocumentDelivery',
      entityId: created.id,
      entityLabel: `${document.label} · ${entry.channel}`,
      after: { documentType: document.type, channel: entry.channel, status: entry.status },
    });

    const row = await this.deliveries.findOneRow(context.schoolId, created.id);
    if (!row) throw AppError.internal();
    return row;
  }

  /**
   * The document behind a (type, id) from a URL: it has to exist in this school,
   * and this is where its label and child are captured from.
   */
  private async resolveDocument(
    context: RequestContext,
    type: DeliveryDocumentType,
    id: string,
  ): Promise<DeliveryDocument & { sendable: boolean; refusal: string | null }> {
    if (type === 'RECEIPT') {
      const payment = await this.payments.findOneDTO(context.schoolId, id);
      if (!payment) throw AppError.notFound('Receipt');
      return {
        type,
        id,
        label: payment.receiptNo ?? payment.reference,
        studentId: payment.studentId,
        studentName: payment.studentName,
        // The same bar `PaymentsService.emailReceipt` holds a send to.
        sendable: payment.status === 'SUCCESSFUL',
        refusal: 'This payment was reversed, so its receipt can no longer be sent.',
      };
    }

    if (type === 'INVOICE') {
      const invoice = await this.invoices.findOneDTO(context.schoolId, id);
      if (!invoice) throw AppError.notFound('Invoice');
      return {
        type,
        id,
        label: invoice.invoiceNo,
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        sendable: invoice.status !== 'CANCELLED',
        refusal: 'This invoice was cancelled, so it can no longer be sent.',
      };
    }

    if (type === 'BILL') {
      const bill = await this.bills.findOneDTO(context.schoolId, id);
      if (!bill) throw AppError.notFound('Bill');
      // A custom bill is made out to a payer by name and belongs to no student.
      return { type, id, label: bill.payerName, sendable: true, refusal: null };
    }

    const structure = await this.structures.findOneDTO(context.schoolId, id);
    if (!structure) throw AppError.notFound('Fee schedule');
    return { type, id, label: structure.name, sendable: true, refusal: null };
  }

  /**
   * As `resolveDocument`, but refusing a document that may no longer be sent.
   *
   * Reading a cancelled invoice's history is fine and necessary — it did go out,
   * and a family holding a copy is exactly what the office needs to know about.
   * Recording a *new* copy of it as having been sent is not.
   */
  private async resolveSendable(
    context: RequestContext,
    type: DeliveryDocumentType,
    id: string,
  ): Promise<DeliveryDocument> {
    const document = await this.resolveDocument(context, type, id);
    if (!document.sendable) {
      throw AppError.conflict(document.refusal ?? 'This document can no longer be sent.');
    }
    return document;
  }

  private async schoolTimezone(schoolId: string): Promise<string> {
    const school = await this.schools.findById(schoolId);
    return resolveTimezone(school?.settings?.timezone);
  }
}
