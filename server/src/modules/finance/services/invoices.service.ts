import type { DeepPartial, EntityManager } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { WebsiteService } from '../../school/services/website.service';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { buildInvoicePdfAttachment, sendInvoiceEmail } from '../../../shared/utils/mailer';
import { chooseRecipient, guardianGreeting } from '../../../shared/utils/whatsapp';
import {
  WhatsAppShareService,
  type WhatsAppShare,
} from '../../../shared/services/whatsappShare.service';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import { FeeStructureRepository } from '../repositories/feeStructure.repository';
import { InvoiceRepository, type CarryForwardCandidate } from '../repositories/invoice.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { StudentDiscountRepository } from '../repositories/studentDiscount.repository';
import { DiscountRepository } from '../repositories/discount.repository';
import { applyDiscounts, type ApplicableDiscount } from './discountCalculator';
import { DocumentDeliveriesService, type DeliveryDocument } from './documentDeliveries.service';
import { Invoice, type BroughtForwardSource } from '../entities/invoice.entity';
import type { InvoiceLine, InvoiceLineAccountSnapshot } from '../entities/invoiceLine.entity';
import type { FeeCategory } from '../entities/feeItem.entity';
import type {
  DeleteInvoicesResultDTO,
  FeeItemDTO,
  InvoiceDTO,
  StudentFinanceSummaryDTO,
  StudentLedgerResultDTO,
} from '../dto/finance.dto';
import type {
  BulkDeleteInvoicesInput,
  CreateInvoiceInput,
  FetchDebtorsQuery,
  FetchInvoicesQuery,
  SendInvoiceEmailInput,
  UpdateInvoiceInput,
} from '../validators/invoices.schema';

/** One charge, already priced, as `issueInvoice` wants it. */
export interface IssueLine {
  feeItemId: string;
  description: string;
  category: FeeCategory;
  quantity: number;
  unitAmount: number;
  discountAmount: number;
  isOptional: boolean;
  /** Where this charge is paid into, snapshotted from the fee item's selected accounts. */
  accounts: InvoiceLineAccountSnapshot[];
}

/** Everything one invoice needs that the caller already knows. */
export interface IssueInvoiceParams {
  schoolId: string;
  studentId: string;
  classId: string | null;
  sessionId: string;
  sessionName: string;
  termId: string;
  /** Session start plus term sequence is the only sound "which term is earlier". */
  sessionStartDate: string;
  termSequence: number;
  feeStructureId: string | null;
  issueDate: string;
  dueDate: string;
  sequence: number;
  note: string | null;
  lines: IssueLine[];
  /**
   * What the student's granted discounts (`StudentDiscount`) take off these
   * lines. Resolved by the caller — one query for a whole bulk run rather
   * than one per pupil — and applied here, so a hand-raised bill and a
   * generated one cannot disagree about what a scholarship is worth.
   */
  discounts?: ApplicableDiscount[];
  createdByUserId: string | null;
}

/** A page of invoices is worth this many students' worth of carry-forward work. */
const MONEY_SCALE = 100;

/**
 * What families owe (spec section 26).
 *
 * The one piece of real judgement in this file is `issueInvoice`, and
 * specifically **carry and close**. When a bill is raised for a term, any
 * balance the family still owes from an *earlier* term is added to the new
 * bill as `broughtForward`, and the old invoices are closed against it. The
 * alternative — leaving both open — is what makes a school's debtors list
 * unreadable: a parent with three terms of arrears appears to owe the sum of
 * three overlapping documents, none of which is the amount to pay.
 *
 * Closing is reversible. Each absorbed invoice keeps a pointer to the one that
 * absorbed it, so cancelling the new bill reopens the old ones exactly as they
 * were, and the ledger still counts their original charges as real billing.
 *
 * Same-term invoices are deliberately left alone. A school that raises tuition
 * and boarding as two bills in one term has not created arrears, and folding
 * one into the other would be a surprise, not a tidy-up.
 */
export class InvoicesService {
  static Instance = new InvoicesService();

  private constructor(
    private readonly invoices = InvoiceRepository.Instance,
    private readonly ledger = LedgerRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly feeItems = FeeItemRepository.Instance,
    private readonly feeStructures = FeeStructureRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly websites = WebsiteService.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly sharing = WhatsAppShareService.Instance,
    private readonly grants = StudentDiscountRepository.Instance,
    private readonly discountDefinitions = DiscountRepository.Instance,
    private readonly deliveries = DocumentDeliveriesService.Instance,
  ) {}

  /* -- Reads ----------------------------------------------------------------- */

  async fetchInvoices(
    context: RequestContext,
    query: FetchInvoicesQuery,
  ): Promise<Paginated<InvoiceDTO>> {
    // A parent holds `finance.read` for their own children and nobody else's.
    const visibleIds = await this.access.visibleStudentIds(context);
    return this.invoices.fetchPaginated(context.schoolId, { ...query, visibleIds });
  }

  /**
   * 404 rather than 403 when a parent asks for somebody else's bill: that a
   * given child is billed by this school is not something an unrelated family
   * gets to confirm.
   */
  async fetchInvoice(context: RequestContext, id: string): Promise<InvoiceDTO> {
    const invoice = await this.invoices.findOneDTO(context.schoolId, id);
    if (!invoice) throw AppError.notFound('Invoice');
    if (!(await this.access.canSeeStudent(context, invoice.studentId))) {
      throw AppError.notFound('Invoice');
    }

    // Letterhead details for the printed copy — assembled here rather than
    // joined in the repository, the same way `PaymentsService.fetchReceipt`
    // builds its receipt's equivalent fields: only this single-invoice read
    // needs them, never the list.
    //
    // The phone and email prefer the school's own website settings —
    // `contactEmail`/`contactPhone`, wherever an administrator has published
    // a different point of contact for enquiries — but `WebsiteService`
    // seeds those from the school's registration email/phone only once, when
    // its row is first created; a school whose website row predates that, or
    // that never touched the field, is left with a permanently blank column
    // rather than the value it set on the School settings screen. Falling
    // back to `school.phone`/`school.email` here, on every read, is what
    // actually keeps that promise.
    const [school, website] = await Promise.all([
      this.schools.findById(context.schoolId),
      this.websites.getForSchool(context.schoolId),
    ]);
    if (!school) throw AppError.internal();

    return {
      ...invoice,
      schoolName: school.name,
      schoolLogoUrl: school.branding?.logoUrl ?? null,
      schoolAddress:
        website.address ||
        [school.addressLine1, school.addressLine2, school.city, school.state]
          .filter(Boolean)
          .join(', '),
      schoolPhone: website.contactPhone || school.phone,
      schoolEmail: website.contactEmail || school.email,
    };
  }

  /**
   * Emails one invoice to a guardian a bursar has picked by hand.
   *
   * Refuses a guardian who is not actually linked to this invoice's own
   * student — the client only ever offers ones that are, but the check
   * belongs here regardless, not to a screen someone could work around.
   * Never touches `hasPortalAccess`, `userId` or anything else `invite()`
   * owns: sending this email opens no account for anyone, on purpose.
   */
  async emailInvoice(
    context: RequestContext,
    id: string,
    input: SendInvoiceEmailInput,
  ): Promise<{ sent: boolean; email: string }> {
    const invoice = await this.fetchInvoice(context, id);

    const link = await this.guardians.findLinkByPair(
      context.schoolId,
      invoice.studentId,
      input.guardianId,
    );
    if (!link) {
      throw AppError.validation('That guardian is not linked to this student.');
    }

    const guardian = await this.guardians.findByIdScoped(context.schoolId, input.guardianId);
    if (!guardian || !guardian.email) {
      throw AppError.validation('Add an email address for this guardian first.');
    }

    // Two different addresses on purpose: the school's own record routes the
    // send (see `SendArgs.schoolEmail`), while the contact address it may have
    // published on its website is what a parent is told to write to.
    const school = await this.schools.findById(context.schoolId);

    await sendInvoiceEmail({
      to: guardian.email,
      firstName: guardian.firstName,
      schoolName: invoice.schoolName ?? context.membership.schoolName,
      schoolLogoUrl: invoice.schoolLogoUrl,
      schoolAddress: invoice.schoolAddress,
      schoolPhone: invoice.schoolPhone,
      schoolEmail: school?.email,
      studentName: invoice.studentName,
      admissionNo: invoice.admissionNo,
      className: invoice.className,
      invoiceNo: invoice.invoiceNo,
      issueDate: invoice.issueDate,
      termName: invoice.termName,
      sessionName: invoice.sessionName,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      broughtForward: invoice.broughtForward,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      note: invoice.note,
      lines: invoice.lines,
      accounts: uniqueAccounts(invoice.lines),
      contactEmail: invoice.schoolEmail ?? '',
    });

    // The only channel that starts out `CONFIRMED`: this server handed the
    // message to the mail server itself and it was accepted. Not allowed to fail
    // the call — the email has gone and cannot be recalled, so an error here
    // would say the send failed and invite a second copy.
    await this.deliveries
      .log(context, invoiceDocument(invoice), {
        channel: 'EMAIL',
        status: 'CONFIRMED',
        recipientName: guardianGreeting(guardian),
        recipientContact: guardian.email,
        guardianId: input.guardianId,
      })
      .catch(() => undefined);

    await this.audit.record(context, {
      action: 'invoice.emailed',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityLabel: `${invoice.invoiceNo} · ${invoice.studentName}`,
      after: { guardianId: input.guardianId, email: guardian.email },
    });

    return { sent: true, email: guardian.email };
  }

  /**
   * Stores this invoice's PDF and hands back a WhatsApp message carrying its
   * link, addressed to the guardian who pays this child's fees — or, if theirs
   * has no usable number, to the next guardian who has one. See `chooseRecipient`.
   *
   * Nothing is sent from here — the browser opens WhatsApp with the message
   * typed and the bursar presses Send. Like `emailInvoice`, it never touches
   * `hasPortalAccess` or anything else `invite()` owns.
   */
  async shareInvoiceOnWhatsApp(context: RequestContext, id: string): Promise<WhatsAppShare> {
    const invoice = await this.fetchInvoice(context, id);
    const recipient = chooseRecipient(
      await this.guardians.findContactsForStudent(context.schoolId, invoice.studentId),
    );
    const schoolName = invoice.schoolName ?? context.membership.schoolName;

    const pdf = await buildInvoicePdfAttachment({
      schoolName,
      schoolLogoUrl: invoice.schoolLogoUrl,
      schoolAddress: invoice.schoolAddress,
      schoolPhone: invoice.schoolPhone,
      schoolEmail: invoice.schoolEmail,
      studentName: invoice.studentName,
      admissionNo: invoice.admissionNo,
      className: invoice.className,
      invoiceNo: invoice.invoiceNo,
      issueDate: invoice.issueDate,
      termName: invoice.termName,
      sessionName: invoice.sessionName,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      broughtForward: invoice.broughtForward,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      note: invoice.note,
      lines: invoice.lines,
      accounts: uniqueAccounts(invoice.lines),
    });

    const share = await this.sharing.shareDocument({
      kind: 'invoice',
      pdf,
      name: invoice.invoiceNo,
      greeting: recipient.greeting,
      subject: `${invoice.studentName}'s invoice for ${invoice.termName} (${invoice.sessionName})`,
      phone: recipient.phone,
      notice: recipient.notice,
      confidential: true,
      schoolName,
      contactEmail: invoice.schoolEmail,
    });

    // `PREPARED`: the message was written and the PDF stored, but sending it is
    // a person pressing Send in WhatsApp, outside this system entirely.
    await this.deliveries.log(context, invoiceDocument(invoice), {
      channel: 'WHATSAPP',
      status: 'PREPARED',
      recipientName: recipient.greeting,
      recipientContact: share.phone,
      guardianId: recipient.guardian?.id ?? null,
      note: share.phone ? null : 'WhatsApp asked the sender to choose the chat.',
    });

    await this.audit.record(context, {
      action: 'invoice.whatsappShared',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityLabel: `${invoice.invoiceNo} · ${invoice.studentName}`,
      after: { guardianId: recipient.guardian?.id ?? null },
    });

    return share;
  }

  async fetchLedger(context: RequestContext, studentId: string): Promise<StudentLedgerResultDTO> {
    if (!(await this.access.canSeeStudent(context, studentId))) {
      throw AppError.notFound('Student');
    }
    const summary = await this.ledger.summaryFor(context.schoolId, studentId);
    if (!summary) throw AppError.notFound('Student');

    return { summary, entries: await this.ledger.ledgerFor(context.schoolId, studentId) };
  }

  async fetchDebtors(
    context: RequestContext,
    query: FetchDebtorsQuery,
  ): Promise<Paginated<StudentFinanceSummaryDTO>> {
    const visibleIds = await this.access.visibleStudentIds(context);
    return this.ledger.fetchDebtors(context.schoolId, {
      ...query,
      overdueOnly: query.overdueOnly === 'true',
      visibleIds,
    });
  }

  /* -- Raising one bill by hand ---------------------------------------------- */

  async createInvoice(context: RequestContext, input: CreateInvoiceInput): Promise<InvoiceDTO> {
    const student = await this.students.findOneDTO(context.schoolId, input.studentId);
    if (!student) throw AppError.notFound('Student');

    const term = await this.terms.findOneDTO(context.schoolId, input.termId);
    if (!term) throw AppError.notFound('Term');

    // Priced from the fee items, never from the request — see the note on
    // `createInvoiceSchema` for why the browser does not get to name a price.
    const items = await this.feeItems.fetchForSchool(context.schoolId);
    const byId = new Map(items.map((item) => [item.id, item]));
    // A fee structure can override an item's price for this pupil's class —
    // see `structureAmountsFor`. A manual invoice follows the same prices
    // "Add all standard fees" showed the bursar, never the item's school-wide
    // default for a charge the structure has repriced.
    const structureAmounts = await this.structureAmountsFor(
      context.schoolId,
      student.id,
      term.id,
    );

    const lines: IssueLine[] = input.lines.map((line) => {
      const item = byId.get(line.feeItemId);
      if (!item) throw AppError.validation('One of those charges is not a fee item of this school.');

      const unitAmount = this.resolveUnitAmount(item, line.priceOptionId, structureAmounts);
      const gross = Math.round(unitAmount * line.quantity * MONEY_SCALE);
      const discount = Math.round(line.discountAmount * MONEY_SCALE);
      if (discount > gross) {
        throw AppError.validation(
          `The discount on ${item.name} is more than the charge itself.`,
        );
      }

      return {
        feeItemId: item.id,
        description: item.name,
        category: item.category,
        quantity: line.quantity,
        unitAmount,
        discountAmount: line.discountAmount,
        isOptional: item.isOptional,
        // Narrowed to whichever accounts the bursar picked for this charge,
        // same as a fee structure line — everywhere the item can be paid
        // into, unless told otherwise.
        accounts: accountsFor(item, line.accountIds),
      };
    });

    const discounts = await this.discountsFor(
      context.schoolId,
      student.id,
      term.sessionId,
      term.id,
      input.discountIds,
    );

    const invoice = await AppDataSource.transaction(async (manager) => {
      const sequence = await this.invoices.nextSequence(manager, context.schoolId, term.sessionId);
      return this.issueInvoice(manager, {
        schoolId: context.schoolId,
        studentId: student.id,
        classId: student.currentClassId,
        sessionId: term.sessionId,
        sessionName: term.sessionName,
        termId: term.id,
        sessionStartDate: term.sessionStartDate,
        termSequence: term.sequence,
        feeStructureId: null,
        issueDate: todayIso(),
        dueDate: input.dueDate,
        sequence,
        note: input.note ? input.note : null,
        lines,
        discounts,
        createdByUserId: context.user.id,
      });
    });

    await this.audit.record(context, {
      action: 'invoice.created',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityLabel: `${invoice.invoiceNo} · ${student.fullName}`,
      after: {
        total: invoice.total,
        broughtForward: invoice.broughtForward,
        termId: term.id,
        lines: lines.length,
        discounts: invoice.appliedDiscounts.map((discount) => discount.name),
      },
    });

    return this.requireDTO(context.schoolId, invoice.id);
  }

  /**
   * The single path every invoice is born through — the manual form and the
   * bulk generator both call this, so carry-forward, numbering and totals
   * cannot drift apart between them.
   *
   * Runs inside the caller's transaction and takes a per-student advisory lock
   * first. Without it, two bills raised for one child at the same instant
   * would each carry the other's balance forward and the family would be
   * charged their arrears twice.
   */
  async issueInvoice(manager: EntityManager, params: IssueInvoiceParams): Promise<Invoice> {
    const [invoice] = await this.issueInvoices(manager, [params]);
    return invoice;
  }

  /**
   * The same path, for a whole cohort at once.
   *
   * A bulk run used to be this method's body in a loop, which meant five or
   * six round trips per pupil — around twelve thousand of them for a run of
   * two thousand bills, all inside one transaction holding its locks open the
   * whole time. The work per invoice is identical; only the number of
   * statements changes, because each step is now set-based: one lock, one
   * carry-forward read, and chunked inserts.
   *
   * The arithmetic lives in `computeInvoice` and is shared with the single
   * call above, so a generated bill and a hand-raised one still cannot
   * disagree about a total, a discount or a carry.
   */
  async issueInvoices(manager: EntityManager, batch: IssueInvoiceParams[]): Promise<Invoice[]> {
    if (batch.length === 0) return [];

    // Sorted so that two runs over the same pupils queue in the same order
    // rather than deadlocking half way through each other.
    await this.invoices.lockStudentsForInvoicing(
      manager,
      [...new Set(batch.map((params) => `invoice:student:${params.studentId}`))].sort(),
    );

    // One carry-forward read per distinct "which term is earlier" key. A bulk
    // run bills a single term, so in practice that is one read for the cohort.
    const carriedByStudent = new Map<string, CarryForwardCandidate[]>();
    for (const [, group] of groupBy(batch, (params) => `${params.sessionStartDate}|${params.termSequence}`)) {
      const carried = await this.invoices.lockOpenEarlierInvoices(
        manager,
        group[0].schoolId,
        [...new Set(group.map((params) => params.studentId))],
        { sessionStartDate: group[0].sessionStartDate, termSequence: group[0].termSequence },
      );
      for (const [studentId, rows] of carried) carriedByStudent.set(studentId, rows);
    }

    const computed = batch.map((params) =>
      computeInvoice(params, carriedByStudent.get(params.studentId) ?? []),
    );

    const ids = await this.invoices.createMany(
      computed.map((entry) => entry.row),
      manager,
    );

    await this.invoices.createLines(
      computed.flatMap((entry, index) => entry.lines.map((line) => ({ ...line, invoiceId: ids[index] }))),
      manager,
    );

    await this.invoices.closeCarriedForward(
      manager,
      computed.flatMap((entry, index) =>
        entry.absorbed.map((row) => ({
          id: row.id,
          intoInvoiceId: ids[index],
          intoInvoiceNo: entry.invoiceNo,
          closedByUserId: batch[index].createdByUserId,
        })),
      ),
    );

    const repo = manager.getRepository(Invoice);
    return computed.map((entry, index) => repo.create({ ...entry.row, id: ids[index] }));
  }

  /* -- Withdrawing one -------------------------------------------------------- */

  /**
   * Cancelling is refused once any money has landed on the bill.
   *
   * Unwinding a payment is a different operation with different consequences —
   * the family has parted with the money, and the receipt they hold has to
   * keep meaning something. Reverse the payment first, then cancel.
   */
  async cancelInvoice(context: RequestContext, id: string, reason: string): Promise<InvoiceDTO> {
    const existing = await this.invoices.findOneDTO(context.schoolId, id);
    if (!existing) throw AppError.notFound('Invoice');

    if (existing.status === 'CANCELLED') {
      throw AppError.conflict('That invoice has already been cancelled.');
    }
    if (existing.status === 'PAID') {
      throw AppError.conflict('A paid invoice cannot be cancelled.');
    }
    if (Math.round(existing.amountPaid * MONEY_SCALE) > 0) {
      throw AppError.conflict(
        'Money has already been received against this invoice. Reverse the payment first.',
      );
    }

    const reopened = await AppDataSource.transaction(async (manager) => {
      await this.invoices.cancel(manager, id, reason, context.user.id);
      // Anything this bill absorbed goes back to standing on its own, or the
      // arrears it carried would vanish with it.
      return this.invoices.reopenCarriedForward(manager, id);
    });

    await this.audit.record(context, {
      action: 'invoice.cancelled',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: `${existing.invoiceNo} · ${existing.studentName}`,
      before: { status: existing.status, total: existing.total },
      after: { reason, reopenedInvoices: reopened.length },
      severity: 'WARNING',
    });

    return this.requireDTO(context.schoolId, id);
  }

  /* -- Editing one --------------------------------------------------------- */

  /**
   * The student and term are fixed at issuance — only the due date, the
   * note, and (while nothing has been paid) the charges themselves can move.
   */
  async updateInvoice(
    context: RequestContext,
    id: string,
    input: UpdateInvoiceInput,
  ): Promise<InvoiceDTO> {
    const existing = await this.invoices.findOneDTO(context.schoolId, id);
    if (!existing) throw AppError.notFound('Invoice');
    if (existing.status === 'CANCELLED') {
      throw AppError.conflict('A cancelled invoice cannot be edited.');
    }

    const fields: Parameters<typeof this.invoices.updateFields>[1] = {};
    if (input.dueDate !== undefined) fields.dueDate = input.dueDate;
    if (input.note !== undefined) fields.note = input.note ? input.note : null;

    let newLines: IssueLine[] | null = null;
    if (input.lines) {
      if (Math.round(existing.amountPaid * MONEY_SCALE) > 0) {
        throw AppError.conflict(
          'Money has already been received against this invoice, so the amount cannot be changed. Reverse the payment first, or edit only the due date and note.',
        );
      }

      const items = await this.feeItems.fetchForSchool(context.schoolId);
      const byId = new Map(items.map((item) => [item.id, item]));
      const structureAmounts = await this.structureAmountsFor(
        context.schoolId,
        existing.studentId,
        existing.termId,
      );

      const priced: IssueLine[] = input.lines.map((line) => {
        const item = byId.get(line.feeItemId);
        if (!item) {
          throw AppError.validation('One of those charges is not a fee item of this school.');
        }

        const unitAmount = this.resolveUnitAmount(item, line.priceOptionId, structureAmounts);
        const gross = Math.round(unitAmount * line.quantity * MONEY_SCALE);
        const discount = Math.round(line.discountAmount * MONEY_SCALE);
        if (discount > gross) {
          throw AppError.validation(`The discount on ${item.name} is more than the charge itself.`);
        }

        return {
          feeItemId: item.id,
          description: item.name,
          category: item.category,
          quantity: line.quantity,
          unitAmount,
          discountAmount: line.discountAmount,
          isOptional: item.isOptional,
          accounts: accountsFor(item, line.accountIds),
        };
      });

      // Re-priced from whatever the student is entitled to now, plus the
      // discounts ticked on the form — the edit is a fresh pricing of the
      // same charges, and the amounts typed on the form are always zero. A
      // caller that names none keeps the ones the bill already carried, and
      // one of those that has since been switched off is dropped quietly
      // rather than failing an edit that never asked for it.
      const discounts = await this.discountsFor(
        context.schoolId,
        existing.studentId,
        existing.sessionId,
        existing.termId,
        input.discountIds ?? existing.appliedDiscounts.map((entry) => entry.discountId),
        input.discountIds !== undefined,
      );
      const { lineDiscounts, applied } = applyDiscounts(priced, discounts);
      newLines = priced.map((line, index) => ({ ...line, discountAmount: lineDiscounts[index] }));

      let subtotalKobo = 0;
      let discountKobo = 0;
      for (const line of newLines) {
        subtotalKobo += Math.round(line.unitAmount * line.quantity * MONEY_SCALE);
        discountKobo += Math.round(line.discountAmount * MONEY_SCALE);
      }

      const broughtForwardKobo = Math.round(existing.broughtForward * MONEY_SCALE);
      const totalKobo = subtotalKobo - discountKobo + broughtForwardKobo;

      fields.subtotal = fromKobo(subtotalKobo);
      fields.discountTotal = fromKobo(discountKobo);
      fields.appliedDiscounts = applied;
      fields.total = fromKobo(totalKobo);
      // Only reachable with nothing paid yet, so the only two states an edit
      // can land on are the same ones a fresh invoice can — never PART_PAID.
      fields.status = totalKobo <= 0 ? 'PAID' : 'ISSUED';
    }

    await AppDataSource.transaction(async (manager) => {
      if (newLines) {
        await this.invoices.deleteLines(id, manager);
        await this.invoices.createLines(
          newLines!.map((line, index) => ({
            schoolId: context.schoolId,
            invoiceId: id,
            feeItemId: line.feeItemId,
            description: line.description,
            category: line.category,
            quantity: line.quantity,
            unitAmount: line.unitAmount.toFixed(2),
            discountAmount: line.discountAmount.toFixed(2),
            lineTotal: fromKobo(
              Math.round(line.unitAmount * line.quantity * MONEY_SCALE) -
                Math.round(line.discountAmount * MONEY_SCALE),
            ),
            isOptional: line.isOptional,
            sortOrder: index,
            accounts: line.accounts,
          })),
          manager,
        );
      }
      await this.invoices.updateFields(id, fields, manager);
    });

    await this.audit.record(context, {
      action: 'invoice.updated',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: `${existing.invoiceNo} · ${existing.studentName}`,
      before: { total: existing.total, dueDate: existing.dueDate, note: existing.note },
      after: {
        total: fields.total !== undefined ? Number(fields.total) : existing.total,
        dueDate: input.dueDate ?? existing.dueDate,
        note: input.note !== undefined ? (input.note || null) : existing.note,
      },
    });

    return this.requireDTO(context.schoolId, id);
  }

  /* -- Deleting many -------------------------------------------------------- */

  /**
   * Removes every id that is safe to remove and reports the rest with why —
   * see `Invoice.deletable` for the three conditions and the note on
   * `InvoiceNumberCounters1791900000000` for why this is safe to hard-delete
   * at all, unlike everywhere else in this file.
   */
  async deleteInvoices(
    context: RequestContext,
    input: BulkDeleteInvoicesInput,
  ): Promise<DeleteInvoicesResultDTO> {
    const ids = Array.from(new Set(input.ids));
    const rows = await this.invoices.findManyForDeleteCheck(context.schoolId, ids);
    const found = new Map(rows.map((row) => [row.id, row]));

    const toDelete: { id: string; invoiceNo: string; studentName: string }[] = [];
    const skipped: DeleteInvoicesResultDTO['skipped'] = [];

    for (const id of ids) {
      const row = found.get(id);
      if (!row) {
        skipped.push({ id, invoiceNo: '', reason: 'That invoice could not be found.' });
      } else if (row.hasAllocations) {
        skipped.push({
          id,
          invoiceNo: row.invoiceNo,
          reason: 'A payment has been recorded against this invoice.',
        });
      } else if (row.hasBroughtForwardFrom) {
        skipped.push({
          id,
          invoiceNo: row.invoiceNo,
          reason: 'This invoice carries forward a balance from an earlier one.',
        });
      } else if (row.carriedForwardToInvoiceId) {
        skipped.push({
          id,
          invoiceNo: row.invoiceNo,
          reason: "This invoice's balance was carried forward to a later invoice.",
        });
      } else {
        toDelete.push(row);
      }
    }

    if (toDelete.length > 0) {
      await AppDataSource.transaction((manager) =>
        this.invoices.deleteMany(toDelete.map((row) => row.id), manager),
      );

      for (const row of toDelete) {
        await this.audit.record(context, {
          action: 'invoice.deleted',
          entityType: 'Invoice',
          entityId: row.id,
          entityLabel: `${row.invoiceNo} · ${row.studentName}`,
          severity: 'WARNING',
        });
      }
    }

    return { deletedIds: toDelete.map((row) => row.id), skipped };
  }

  private async requireDTO(schoolId: string, id: string): Promise<InvoiceDTO> {
    const dto = await this.invoices.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * Every discount one bill carries: what the pupil has been granted for this
   * session and term, then any others the bursar ticked for this bill alone.
   * A ticked discount the pupil already holds is not applied twice.
   *
   * `strict` refuses an id that is not an active discount of this school;
   * without it such an id is skipped, for callers replaying a bill's own
   * earlier discounts rather than taking a choice from the browser.
   */
  private async discountsFor(
    schoolId: string,
    studentId: string,
    sessionId: string,
    termId: string,
    chosenIds: string[] = [],
    strict = true,
  ): Promise<ApplicableDiscount[]> {
    const byStudent = await this.grants.fetchApplicable(schoolId, [studentId], sessionId, termId);
    const granted = byStudent.get(studentId) ?? [];

    const extraIds = Array.from(new Set(chosenIds)).filter(
      (id) => !granted.some((discount) => discount.discountId === id),
    );
    if (extraIds.length === 0) return granted;

    const definitions = await this.discountDefinitions.fetchForSchool(schoolId);
    const chosen: ApplicableDiscount[] = [];
    for (const id of extraIds) {
      const definition = definitions.find((entry) => entry.id === id && entry.isActive);
      if (!definition) {
        if (strict) throw AppError.validation('One of those discounts is not available.');
        continue;
      }
      chosen.push({
        discountId: definition.id,
        name: definition.name,
        type: definition.type,
        mode: definition.mode,
        value: definition.value,
        appliesToFeeItemIds: definition.appliesToFeeItemIds,
      });
    }
    return [...granted, ...chosen];
  }

  /**
   * Whatever fee structure is written for this pupil's class and term prices
   * its own lines differently from a fee item's school-wide default — the
   * same override `FeeStructuresService.generateInvoices` bills a bulk run
   * from. A manual invoice (raised by hand, or "Add all standard fees" on
   * this form) follows those same prices rather than the item's default,
   * so a bursar's bill never disagrees with the structure it was built from.
   * Resolved server-side from student and term alone, never from anything
   * the request names, for the same reason a line's price never is.
   */
  private async structureAmountsFor(
    schoolId: string,
    studentId: string,
    termId: string,
  ): Promise<Map<string, number>> {
    const match = await this.feeStructures.findApplicable(schoolId, studentId, termId);
    if (!match) return new Map();
    const definitions = await this.feeStructures.lineDefinitions(schoolId, match.id);
    return new Map(definitions.map((line) => [line.feeItemId, line.amount]));
  }

  /**
   * What one line actually bills at, in the order a bursar's own choices
   * should win: the named price option they picked for this line (see
   * `FeeItem.priceOptions`) beats the structure's own price for the item,
   * which beats the item's plain default. An id that doesn't match one of
   * the item's own options is treated the same as not picking one — the
   * same leniency `accountIds` gets — rather than refused.
   */
  private resolveUnitAmount(
    item: FeeItemDTO,
    priceOptionId: string | undefined,
    structureAmounts: Map<string, number>,
  ): number {
    const picked = priceOptionId
      ? item.priceOptions.find((option) => option.id === priceOptionId)
      : undefined;
    return picked?.amount ?? structureAmounts.get(item.id) ?? item.amount;
  }
}

/**
 * `INV/2025-2026/00042`.
 *
 * The same slug treatment `applicationNumber` gives an admission number, so
 * the two families of reference a school hands out read alike, with five
 * digits rather than four: a large school issues one invoice per pupil per
 * term, which reaches four figures in a single session.
 */
/** One invoice worked out in full, before a single row is written. */
interface ComputedInvoice {
  invoiceNo: string;
  row: DeepPartial<Invoice>;
  /** Without `invoiceId`: that only exists once the invoice row is in. */
  lines: DeepPartial<InvoiceLine>[];
  absorbed: CarryForwardCandidate[];
}

/**
 * Everything one bill comes to — discounts, totals, carry-forward, status —
 * with no IO of its own, so the single and bulk paths run the identical
 * arithmetic over the identical inputs.
 */
function computeInvoice(
  params: IssueInvoiceParams,
  carried: CarryForwardCandidate[],
): ComputedInvoice {
  const { lineDiscounts, applied } = applyDiscounts(params.lines, params.discounts ?? []);
  const lines = params.lines.map((line, index) => ({
    ...line,
    discountAmount: lineDiscounts[index],
  }));

  let subtotalKobo = 0;
  let discountKobo = 0;
  for (const line of lines) {
    subtotalKobo += Math.round(line.unitAmount * line.quantity * MONEY_SCALE);
    discountKobo += Math.round(line.discountAmount * MONEY_SCALE);
  }

  const absorbed = carried.filter((row) => Math.round(row.balance * MONEY_SCALE) > 0);
  const broughtForwardKobo = absorbed.reduce(
    (sum, row) => sum + Math.round(row.balance * MONEY_SCALE),
    0,
  );
  const broughtForwardFrom: BroughtForwardSource[] = absorbed.map((row) => ({
    invoiceId: row.id,
    invoiceNo: row.invoiceNo,
    amount: row.balance,
  }));

  const totalKobo = subtotalKobo - discountKobo + broughtForwardKobo;
  const invoiceNo = invoiceNumber(params.sessionName, params.sequence);

  return {
    invoiceNo,
    absorbed,
    row: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      invoiceNo,
      sequence: params.sequence,
      sessionId: params.sessionId,
      termId: params.termId,
      classId: params.classId,
      feeStructureId: params.feeStructureId,
      issueDate: params.issueDate,
      dueDate: params.dueDate,
      subtotal: fromKobo(subtotalKobo),
      discountTotal: fromKobo(discountKobo),
      appliedDiscounts: applied,
      broughtForward: fromKobo(broughtForwardKobo),
      broughtForwardFrom,
      total: fromKobo(totalKobo),
      // A bill for nothing — everything waived, or a zero carry — is settled
      // the moment it is raised. Reporting it as owing would put a family on
      // the debtors list for ₦0.
      status: totalKobo <= 0 ? 'PAID' : 'ISSUED',
      note: params.note,
      createdByUserId: params.createdByUserId,
    },
    lines: lines.map((line, index) => ({
      schoolId: params.schoolId,
      feeItemId: line.feeItemId,
      description: line.description,
      category: line.category,
      quantity: line.quantity,
      unitAmount: line.unitAmount.toFixed(2),
      discountAmount: line.discountAmount.toFixed(2),
      lineTotal: fromKobo(
        Math.round(line.unitAmount * line.quantity * MONEY_SCALE) -
          Math.round(line.discountAmount * MONEY_SCALE),
      ),
      isOptional: line.isOptional,
      sortOrder: index,
      accounts: line.accounts,
    })),
  };
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

export function invoiceNumber(sessionName: string, sequence: number): string {
  const session = sessionName
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
    .toUpperCase();
  return `INV/${session || 'SESSION'}/${String(sequence).padStart(5, '0')}`;
}

/** Money is compared in kobo and written back as a fixed-point string. */
function fromKobo(kobo: number): string {
  return (kobo / MONEY_SCALE).toFixed(2);
}

/**
 * Every account across an invoice's lines, once each — for the emailed copy,
 * the same dedup `account-summary.ts` does client-side for the printed one:
 * a charge can name more than one account (`fee-structure-dialog.tsx`), and
 * two lines sometimes name the same real account separately.
 */
function uniqueAccounts(
  lines: InvoiceDTO['lines'],
): { label: string; accountNumber: string; accountName: string }[] {
  const byKey = new Map<string, { label: string; accountNumber: string; accountName: string }>();
  for (const line of lines) {
    for (const account of line.accounts) {
      const key = `${account.bankName}::${account.accountNumber}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          label: account.label || account.bankName,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
        });
      }
    }
  }
  return Array.from(byKey.values());
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Which of a fee item's own accounts one invoice line is billed under.
 * Omitted `accountIds` means every account the item has — the same default
 * `FeeStructuresService`'s line-pricing gives a structure line that never
 * narrowed it down. An id that is not actually one of the item's own is
 * silently dropped, the same leniency `feeItems.schema.ts` documents for a
 * fee item's own account list.
 */
function accountsFor(item: FeeItemDTO, accountIds?: string[]): InvoiceLineAccountSnapshot[] {
  const selected = accountIds
    ? item.accounts.filter((account) => accountIds.includes(account.id))
    : item.accounts;
  return selected.map((account) => ({
    label: account.label,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
  }));
}

/**
 * How an invoice names itself in the delivery register.
 *
 * Captured as it stands at the moment of sending, never looked up again: the
 * register has to keep saying what went out, under the number it went out as —
 * see `DocumentDeliveriesService`.
 */
function invoiceDocument(invoice: InvoiceDTO): DeliveryDocument {
  return {
    type: 'INVOICE',
    id: invoice.id,
    label: invoice.invoiceNo,
    studentId: invoice.studentId,
    studentName: invoice.studentName,
  };
}
