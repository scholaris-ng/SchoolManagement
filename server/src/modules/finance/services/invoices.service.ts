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
import {
  InvoiceRepository,
  type CarryForwardCandidate,
  type CarryableLine,
} from '../repositories/invoice.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { StudentDiscountRepository } from '../repositories/studentDiscount.repository';
import { DiscountRepository } from '../repositories/discount.repository';
import { applyDiscounts, resolveDiscountScope, type ApplicableDiscount } from './discountCalculator';
import {
  changesBilling,
  diffSnapshots,
  planCarriedSync,
  planLineSync,
  snapshotOf,
  statusAfterEdit,
  type InvoiceChange,
  type InvoiceSnapshot,
  type SourceLineDelta,
} from './invoiceRevisions';
import { DocumentDeliveriesService, type DeliveryDocument } from './documentDeliveries.service';
import { Invoice, type BroughtForwardSource } from '../entities/invoice.entity';
import type { InvoiceLine, InvoiceLineAccountSnapshot } from '../entities/invoiceLine.entity';
import type { FeeCategory } from '../entities/feeItem.entity';
import type {
  CarriedInvoiceDTO,
  DeleteInvoicesResultDTO,
  FeeItemDTO,
  InvoiceDTO,
  InvoiceRevisionDTO,
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
  /**
   * Open invoices of this same student and term whose unpaid balance this one
   * takes over, closing them — a follow-up bill, on top of the earlier-term
   * arrears every bill already absorbs. Never set by the bulk generator:
   * same-term invoices are only ever carried when somebody asks.
   */
  carryInvoiceIds?: string[];
  createdByUserId: string | null;
}

/** A page of invoices is worth this many students' worth of carry-forward work. */
const MONEY_SCALE = 100;

type InvoiceFieldUpdate = Parameters<InvoiceRepository['updateFields']>[1];
type LineSync = ReturnType<typeof planLineSync>;

/** What the person asked to change on one invoice. */
interface EditRequest {
  dueDate?: string;
  note?: string;
  lines?: UpdateInvoiceInput['lines'];
  discounts?: UpdateInvoiceInput['discounts'];
  /**
   * An earlier invoice this one took over was edited, so the balance brought
   * forward from it moves by this much. Never set by a person, only by the edit
   * of the invoice it came from.
   */
  broughtForwardShifts?: { invoiceId: string; deltaKobo: number }[];
}

/**
 * One invoice's edit, fully worked out and checked but not yet written — see
 * `InvoicesService.planEdit`.
 */
interface EditPlan {
  existing: InvoiceDTO;
  fields: InvoiceFieldUpdate;
  newLines: IssueLine[] | null;
  lineSync: LineSync | null;
  /**
   * Charges that stay but now cost less than what had been itemised to them, so
   * that itemisation is brought back under the new total.
   */
  cappedLines: { id: string; totalKobo: number }[];
  before: InvoiceSnapshot;
  after: InvoiceSnapshot;
  changes: InvoiceChange[];
  /** What each of the invoice's own charges moved by, in kobo. */
  lineDeltas: SourceLineDelta[];
  /** What the invoice's own billing moved by, in kobo — the sum of `lineDeltas`. */
  totalDeltaKobo: number;
}

interface EditedInvoice {
  dto: InvoiceDTO;
  plan: EditPlan;
}

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
      carriedFrom: await this.carriedFromFor(context.schoolId, invoice),
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
   * What a balance brought forward was made of, fee item by fee item, so the
   * printed invoice can say more than a single lump figure.
   *
   * The amount that moved is the one recorded when it was carried — that is
   * what the total counts. Where this invoice carried it as real lines (a
   * follow-up for the same term) the items are those lines, so whatever has
   * been paid against them since shows; where it was carried as a lump — an
   * earlier term's arrears — they are read off the closed invoice as they
   * stand. Money paid on that invoice without naming a fee item lowers its
   * balance but no item's, so the two can differ; `unassigned` is exactly that
   * difference, which keeps the breakdown adding up to the amount carried.
   */
  private async carriedFromFor(schoolId: string, invoice: InvoiceDTO): Promise<CarriedInvoiceDTO[]> {
    if (invoice.broughtForward <= 0) return [];
    const sources = await this.invoices.findBroughtForwardSources(schoolId, invoice.id);
    if (sources.length === 0) return [];

    const carriedLines = groupBy(
      invoice.lines.filter((line) => line.carriedFromInvoiceId),
      (line) => line.carriedFromInvoiceId as string,
    );

    // A fee item ticked as paid on a receipt counts as settled here: this
    // document says what is still owed, and the receipt says a tick means the
    // whole charge was covered.
    const lumpIds = sources
      .filter((source) => !carriedLines.has(source.invoiceId))
      .map((source) => source.invoiceId);
    const lumpLines = groupBy(
      lumpIds.length > 0
        ? await this.invoices.findLinesForInvoices(schoolId, lumpIds, { countTicks: true })
        : [],
      (line) => line.invoiceId,
    );

    return sources.map((source) => {
      const real = carriedLines.get(source.invoiceId);
      if (real) {
        const carriedKobo = real.reduce((sum, line) => sum + Math.round(line.lineTotal * MONEY_SCALE), 0);
        return {
          invoiceId: source.invoiceId,
          invoiceNo: source.invoiceNo,
          amount: source.amount,
          items: real
            .filter((line) => Math.round(line.balance * MONEY_SCALE) > 0)
            .map((line) => ({
              description: line.description,
              amount: line.lineTotal,
              paid: line.amountPaid,
              balance: line.balance,
            })),
          unassigned: (Math.round(source.amount * MONEY_SCALE) - carriedKobo) / MONEY_SCALE,
        };
      }

      const items = (lumpLines.get(source.invoiceId) ?? [])
        .filter((line) => Math.round(line.balance * MONEY_SCALE) > 0)
        .map((line) => ({
          description: line.description,
          amount: line.amount,
          paid:
            (Math.round(line.amount * MONEY_SCALE) - Math.round(line.balance * MONEY_SCALE)) /
            MONEY_SCALE,
          balance: line.balance,
        }));
      const itemsKobo = items.reduce((sum, item) => sum + Math.round(item.balance * MONEY_SCALE), 0);

      return {
        invoiceId: source.invoiceId,
        invoiceNo: source.invoiceNo,
        amount: source.amount,
        items,
        unassigned: (Math.round(source.amount * MONEY_SCALE) - itemsKobo) / MONEY_SCALE,
      };
    });
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
      appliedDiscounts: invoice.appliedDiscounts,
      carriedFrom: invoice.carriedFrom,
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
      appliedDiscounts: invoice.appliedDiscounts,
      carriedFrom: invoice.carriedFrom,
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
      input.discounts,
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
        carryInvoiceIds: input.carryInvoiceIds,
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
        carriedInvoices: input.carryInvoiceIds.length,
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

    // A follow-up bill that asked to take over same-term invoices. Each was
    // named on a screen that may since have gone stale — paid off, cancelled or
    // carried elsewhere — so a short result is refused rather than quietly
    // billing for less than the person saw.
    const carriedLinesByStudent = new Map<string, CarriedLineDraft[]>();
    for (const params of batch) {
      const wanted = params.carryInvoiceIds ?? [];
      if (wanted.length === 0) continue;

      const taken = await this.invoices.lockOpenInvoicesInTerm(
        manager,
        params.schoolId,
        params.studentId,
        params.termId,
        wanted,
      );
      if (taken.length !== wanted.length) {
        throw AppError.conflict(
          'An earlier invoice for this term has changed since this page loaded — it may have been paid off or cancelled. Reload and try again.',
        );
      }
      if (
        params.lines.length === 0 &&
        !taken.some((row) => Math.round(row.balance * MONEY_SCALE) > 0)
      ) {
        throw AppError.conflict('Nothing is left to pay on those invoices, so there is nothing to bill.');
      }
      carriedByStudent.set(params.studentId, [
        ...(carriedByStudent.get(params.studentId) ?? []),
        ...taken,
      ]);

      // What is still owing goes across as the fee items it is owing on, so a
      // payment on this bill can say which one it was for. The lump figure
      // stays the source of truth for the total; these are its breakdown.
      const owing = await this.invoices.findLinesToCarry(
        manager,
        params.schoolId,
        taken.map((row) => row.id),
      );
      carriedLinesByStudent.set(
        params.studentId,
        taken.flatMap((source) =>
          itemiseCarried(
            source,
            owing.filter((line) => line.invoiceId === source.id),
          ),
        ),
      );
    }

    const computed = batch.map((params) =>
      computeInvoice(
        params,
        carriedByStudent.get(params.studentId) ?? [],
        carriedLinesByStudent.get(params.studentId) ?? [],
      ),
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
   * The student and term are fixed at issuance — everything else can be
   * corrected, and every correction is kept as a version (`InvoiceRevision`).
   *
   * A mistake used to mean cancelling the bill and raising a new one. That is
   * the thing this replaces: the invoice keeps its number, and its history says
   * what it was, what it became, who changed it and why.
   *
   * Once money has landed the charges can still be changed freely — added,
   * removed, repriced — because a payment is money received, not a statement
   * about which charges exist. What changes is where it sits:
   *   - a charge that is removed, or brought below what was itemised to it,
   *     lets go of that itemisation (`writeEdit`); the payment itself stays on
   *     the invoice and counts towards whatever is left;
   *   - a total that ends up below what was paid leaves the invoice settled
   *     with the excess as a credit on the account, as any overpayment does.
   * Every such change is in the history, with the amount that had been paid.
   *
   * **Brought-forward charges.** A follow-up invoice does not own the charges
   * it carries — they are the earlier invoice's own, and only the balance still
   * owing moves across. So correcting one is correcting the earlier invoice, and
   * this invoice follows it. `carried` does that from the screen the person is
   * already on: each entry replaces one earlier invoice's charges, and the
   * balance brought forward — and the carried copies of those charges, where
   * there are any — are moved by exactly what changed. Editing a carried-forward
   * invoice directly does the same thing the other way round.
   *
   * It is all one transaction: the invoices, the carried copies and every version
   * are written together or not at all.
   */
  async updateInvoice(
    context: RequestContext,
    id: string,
    input: UpdateInvoiceInput,
  ): Promise<InvoiceDTO> {
    const existing = await this.invoices.findOneDTO(context.schoolId, id);
    if (!existing) throw AppError.notFound('Invoice');

    // A balance carried onto a later invoice reads CANCELLED but was not
    // withdrawn — it is still real billing, and the one place its charges can be
    // corrected from is here.
    const carriedForward =
      existing.status === 'CANCELLED' && existing.carriedForwardToInvoiceId !== null;
    if (existing.status === 'CANCELLED' && !carriedForward) {
      throw AppError.conflict('A cancelled invoice cannot be edited.');
    }
    if (carriedForward && input.carried && input.carried.length > 0) {
      throw AppError.validation(
        'Correct the charges brought forward on the invoice that took them over, not on this one.',
      );
    }

    const reason = input.reason?.trim() ? input.reason.trim() : null;

    // The earlier invoices whose charges are being corrected from this screen.
    const sources: EditedInvoice[] = [];
    for (const entry of input.carried ?? []) {
      const source = await this.invoices.findOneDTO(context.schoolId, entry.invoiceId);
      if (
        !source ||
        source.carriedForwardToInvoiceId !== existing.id ||
        source.studentId !== existing.studentId
      ) {
        throw AppError.validation('One of those earlier invoices is not one this invoice took over.');
      }
      sources.push({
        dto: source,
        plan: await this.planEdit(
          context,
          source,
          { lines: entry.lines, discounts: entry.discounts },
          { keepStatus: true },
        ),
      });
    }

    const shifts = sources
      .filter((source) => source.plan.totalDeltaKobo !== 0)
      .map((source) => ({ invoiceId: source.dto.id, deltaKobo: source.plan.totalDeltaKobo }));

    const ownPlan = await this.planEdit(
      context,
      existing,
      {
        dueDate: input.dueDate,
        note: input.note,
        lines: input.lines,
        discounts: input.discounts,
        broughtForwardShifts: shifts,
      },
      { keepStatus: carriedForward },
    );

    // Edited directly, a carried-forward invoice's charges are the earlier
    // invoice's own, and the one that took them over has to follow.
    let follower: EditedInvoice | null = null;
    if (carriedForward && ownPlan.totalDeltaKobo !== 0) {
      const successor = await this.invoices.findOneDTO(
        context.schoolId,
        existing.carriedForwardToInvoiceId as string,
      );
      if (!successor) throw AppError.internal();
      if (successor.status === 'CANCELLED') {
        throw AppError.conflict(
          `This invoice's balance was carried to ${successor.invoiceNo}, which was itself carried forward, so its charges cannot be changed from here. Correct them on the most recent invoice instead.`,
        );
      }
      follower = {
        dto: successor,
        plan: await this.planEdit(
          context,
          successor,
          { broughtForwardShifts: [{ invoiceId: existing.id, deltaKobo: ownPlan.totalDeltaKobo }] },
          { keepStatus: false },
        ),
      };
    }

    // `upstream` are the invoices whose own charges changed; `downstream` is the
    // one that carries them. For an ordinary edit that is `existing` itself.
    const upstream: EditedInvoice[] = carriedForward ? [{ dto: existing, plan: ownPlan }] : sources;
    const downstream: EditedInvoice | null = carriedForward
      ? follower
      : { dto: existing, plan: ownPlan };

    const writes = [...upstream, ...(downstream ? [downstream] : [])].filter(
      (entry) => entry.plan.changes.length > 0,
    );

    // Saving without changing anything is not a new version.
    if (writes.length === 0) return this.requireDTO(context.schoolId, id);

    if (writes.some((entry) => changesBilling(entry.plan.changes)) && !reason) {
      throw AppError.validation(
        'Say why the charges are being changed. The reason is kept with the invoice history.',
      );
    }

    // What the earlier invoices' line changes look like on the invoice that
    // carries them, so its own history says which item moved and where from.
    const carriedLineChanges: InvoiceChange[] = upstream.flatMap((entry) =>
      entry.plan.changes
        .filter(
          (change) =>
            change.kind === 'LINE_ADDED' ||
            change.kind === 'LINE_REMOVED' ||
            change.kind === 'LINE_CHANGED',
        )
        .map((change) => ({
          ...change,
          label: `${change.label ?? ''} (from ${entry.dto.invoiceNo})`,
        })),
    );

    await AppDataSource.transaction(async (manager) => {
      // The invoice that carries first, then what it took over: one fixed order,
      // so two edits touching the same pair can only queue, never deadlock.
      if (downstream) await this.invoices.lockForEdit(manager, downstream.dto.id);
      for (const entry of [...upstream].sort((a, b) => a.dto.id.localeCompare(b.dto.id))) {
        await this.invoices.lockForEdit(manager, entry.dto.id);
      }

      for (const entry of upstream) {
        if (entry.plan.changes.length === 0) continue;
        await this.writeEdit(
          manager,
          context,
          entry.plan,
          // Edited from the invoice that carries it, the reason says so.
          !carriedForward && reason && downstream
            ? `${reason} (edited from ${downstream.dto.invoiceNo})`
            : reason,
          [],
        );
      }

      if (downstream) {
        await this.syncCarriedCopies(manager, context, downstream.dto, upstream);
        if (downstream.plan.changes.length > 0) {
          await this.writeEdit(manager, context, downstream.plan, reason, carriedLineChanges);
        }
      }
    });

    for (const entry of writes) {
      await this.audit.record(context, {
        action: 'invoice.updated',
        entityType: 'Invoice',
        entityId: entry.dto.id,
        entityLabel: `${entry.dto.invoiceNo} · ${entry.dto.studentName}`,
        before: {
          total: entry.dto.total,
          dueDate: entry.dto.dueDate,
          note: entry.dto.note,
        },
        after: {
          total: entry.plan.after.total,
          dueDate: entry.plan.after.dueDate,
          note: entry.plan.after.note,
          reason,
          changes: entry.plan.changes.length,
        },
      });
    }

    return this.requireDTO(context.schoolId, id);
  }

  /**
   * Works out what an edit would do to one invoice — the new charges priced, the
   * totals, the status, the version it would write. Writes nothing.
   *
   * `broughtForwardShifts` is how an earlier invoice's edit reaches this one: the
   * balance it brought forward from that invoice moves by that much, and so does
   * the total, with no change to this invoice's own charges.
   */
  private async planEdit(
    context: RequestContext,
    existing: InvoiceDTO,
    request: EditRequest,
    options: { keepStatus: boolean },
  ): Promise<EditPlan> {
    const amountPaidKobo = Math.round(existing.amountPaid * MONEY_SCALE);

    const fields: InvoiceFieldUpdate = {};
    if (request.dueDate !== undefined) fields.dueDate = request.dueDate;
    if (request.note !== undefined) fields.note = request.note ? request.note : null;

    const ownLines = existing.lines.filter((line) => !line.carriedFromInvoiceId);

    // An earlier invoice moved, so what was brought forward from it moves too.
    // It cannot go below nothing: an earlier invoice edited down past what it was
    // paid is overpaid, and that credit stays on the account rather than being
    // netted off this invoice's own charges.
    const shifts = request.broughtForwardShifts ?? [];
    const shiftKobo = shifts.reduce((sum, shift) => sum + shift.deltaKobo, 0);
    const startingBroughtForwardKobo = Math.round(existing.broughtForward * MONEY_SCALE);
    let broughtForwardKobo = startingBroughtForwardKobo;
    if (shiftKobo !== 0) {
      broughtForwardKobo = Math.max(0, broughtForwardKobo + shiftKobo);
      const recorded = await this.invoices.findBroughtForwardSources(
        context.schoolId,
        existing.id,
      );
      fields.broughtForward = fromKobo(broughtForwardKobo);
      fields.broughtForwardFrom = recorded.map((source) => {
        const moved = shifts
          .filter((shift) => shift.invoiceId === source.invoiceId)
          .reduce((sum, shift) => sum + shift.deltaKobo, 0);
        const next = Math.max(0, Math.round(source.amount * MONEY_SCALE) + moved);
        return { ...source, amount: next / MONEY_SCALE };
      });
    }

    let newLines: IssueLine[] | null = null;
    let lineSync: LineSync | null = null;
    let lineDeltas: SourceLineDelta[] = [];
    let cappedLines: { id: string; totalKobo: number }[] = [];
    // The shift actually applied, which is less than asked for when it ran into zero.
    let totalKobo =
      Math.round(existing.total * MONEY_SCALE) + (broughtForwardKobo - startingBroughtForwardKobo);

    if (request.lines) {
      const items = await this.feeItems.fetchForSchool(context.schoolId);
      const byId = new Map(items.map((item) => [item.id, item]));
      const structureAmounts = await this.structureAmountsFor(
        context.schoolId,
        existing.studentId,
        existing.termId,
      );

      // The prices already on the invoice, by fee item. A charge the person did
      // not touch keeps its own — re-pricing it from today's fee list would
      // change what a family was billed because of an unrelated correction.
      const savedUnitAmounts = new Map(
        existing.lines
          .filter((line) => !line.carriedFromInvoiceId)
          .map((line) => [line.feeItemId, line.unitAmount] as const),
      );

      const priced: IssueLine[] = request.lines.map((line) => {
        const item = byId.get(line.feeItemId);
        if (!item) {
          throw AppError.validation('One of those charges is not a fee item of this school.');
        }

        const unitAmount =
          (line.keepSavedPrice ? savedUnitAmounts.get(line.feeItemId) : undefined) ??
          this.resolveUnitAmount(item, line.priceOptionId, structureAmounts);
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
        // The invoice's own record of a previously-applied discount has no
        // memory of which lines it was scoped to, only what it waived in
        // total — an edit that does not resend `discounts` reopens each one
        // applying to every line it can reach, same as `feeItemIds: []`.
        request.discounts ??
          existing.appliedDiscounts.map((entry) => ({ discountId: entry.discountId, feeItemIds: [] })),
        request.discounts !== undefined,
      );
      const { lineDiscounts, applied } = applyDiscounts(priced, discounts);
      newLines = priced.map((line, index) => ({ ...line, discountAmount: lineDiscounts[index] }));

      let subtotalKobo = 0;
      let discountKobo = 0;
      for (const line of newLines) {
        subtotalKobo += Math.round(line.unitAmount * line.quantity * MONEY_SCALE);
        discountKobo += Math.round(line.discountAmount * MONEY_SCALE);
      }

      totalKobo = subtotalKobo - discountKobo + broughtForwardKobo;

      lineSync = planLineSync(ownLines, newLines);

      // A charge may be removed, or brought down, whatever has been paid towards
      // it. The money is not lost — it stays against the invoice — but what had
      // been itemised to a charge that is going, or that no longer costs that
      // much, has to be let go of, which `writeEdit` does.
      cappedLines = lineSync.keep.flatMap((kept) => {
        const line = ownLines.find((candidate) => candidate.id === kept.id);
        const nextTotalKobo = lineTotalKobo(newLines![kept.index]);
        return line && nextTotalKobo < Math.round(line.amountPaid * MONEY_SCALE)
          ? [{ id: kept.id, totalKobo: nextTotalKobo }]
          : [];
      });

      // What each of the invoice's own charges moved by — what an invoice that
      // carried them has to follow.
      lineDeltas = [
        ...lineSync.keep.map((kept) => {
          const line = ownLines.find((candidate) => candidate.id === kept.id);
          return {
            feeItemId: newLines![kept.index].feeItemId,
            deltaKobo:
              lineTotalKobo(newLines![kept.index]) -
              Math.round((line?.lineTotal ?? 0) * MONEY_SCALE),
          };
        }),
        ...lineSync.insert.map((index) => ({
          feeItemId: newLines![index].feeItemId,
          deltaKobo: lineTotalKobo(newLines![index]),
        })),
        ...lineSync.remove.map((removedId) => {
          const line = ownLines.find((candidate) => candidate.id === removedId);
          return {
            feeItemId: line?.feeItemId ?? '',
            deltaKobo: -Math.round((line?.lineTotal ?? 0) * MONEY_SCALE),
          };
        }),
      ];

      fields.subtotal = fromKobo(subtotalKobo);
      fields.discountTotal = fromKobo(discountKobo);
      fields.appliedDiscounts = applied;
    }

    if (request.lines || shiftKobo !== 0) {
      // A total that falls below what has been paid is allowed: the family
      // overpaid, and the invoice settles with the excess left as a credit on
      // their account — the same state an overpayment has always been.
      fields.total = fromKobo(totalKobo);
      // An invoice that was carried forward stays closed whatever its total does.
      if (!options.keepStatus) fields.status = statusAfterEdit(totalKobo, amountPaidKobo);
    }

    // What the invoice said, and what it will say. Built here rather than read
    // back afterwards so the version is written in the same transaction as the
    // edit — it cannot exist for a change that did not happen.
    const before = snapshotOf(existing);
    const after: InvoiceSnapshot = {
      dueDate: request.dueDate ?? before.dueDate,
      note: request.note !== undefined ? (request.note ? request.note : null) : before.note,
      lines: newLines
        ? newLines.map((line) => ({
            feeItemId: line.feeItemId,
            description: line.description,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
            discountAmount: line.discountAmount,
            lineTotal: lineTotalKobo(line) / MONEY_SCALE,
            isOptional: line.isOptional,
          }))
        : before.lines,
      subtotal: fields.subtotal !== undefined ? Number(fields.subtotal) : before.subtotal,
      discountTotal:
        fields.discountTotal !== undefined ? Number(fields.discountTotal) : before.discountTotal,
      appliedDiscounts: fields.appliedDiscounts
        ? fields.appliedDiscounts.map((entry) => ({ name: entry.name, amount: entry.amount }))
        : before.appliedDiscounts,
      broughtForward:
        fields.broughtForward !== undefined ? Number(fields.broughtForward) : before.broughtForward,
      total: fields.total !== undefined ? Number(fields.total) : before.total,
    };

    // The history should say when a charge that money had been paid towards was
    // taken off or brought down, since that is the change a bursar is asked about.
    const paidOnLine = new Map(ownLines.map((line) => [line.description, line.amountPaid]));
    const changes = diffSnapshots(before, after).map((change) => {
      const paid = change.label ? (paidOnLine.get(change.label) ?? 0) : 0;
      if (paid <= 0) return change;

      if (change.kind === 'LINE_REMOVED') {
        return { ...change, detail: `${formatNairaWhole(paid)} had been paid towards it` };
      }
      if (change.kind === 'LINE_CHANGED' && typeof change.to === 'number' && change.to < paid) {
        return {
          ...change,
          detail: [change.detail, `now below the ${formatNairaWhole(paid)} paid towards it`]
            .filter(Boolean)
            .join(' · '),
        };
      }
      return change;
    });

    return {
      existing,
      fields,
      newLines,
      lineSync,
      cappedLines,
      before,
      after,
      changes,
      lineDeltas,
      // What the invoice's own billing moved by. A shift in what was brought
      // forward is not billing and never passes further along.
      totalDeltaKobo: lineDeltas.reduce((sum, delta) => sum + delta.deltaKobo, 0),
    };
  }

  /**
   * Writes one planned edit: its version, its charges, its figures. Called inside
   * the edit's transaction with the invoice already locked.
   *
   * `extraChanges` are changes that belong in this invoice's history but are not
   * a difference in its own snapshot — an earlier invoice's charge that moved.
   */
  private async writeEdit(
    manager: EntityManager,
    context: RequestContext,
    plan: EditPlan,
    reason: string | null,
    extraChanges: InvoiceChange[],
  ): Promise<void> {
    const { existing, newLines, lineSync } = plan;
    const id = existing.id;

    let revisionNo = await this.invoices.latestRevisionNo(manager, id);
    if (revisionNo === 0) {
      await this.invoices.insertOriginalRevision(manager, {
        schoolId: context.schoolId,
        invoiceId: id,
        snapshot: plan.before,
        amountPaid: existing.amountPaid,
      });
      revisionNo = 1;
    }
    revisionNo += 1;

    await this.invoices.insertRevision(manager, {
      schoolId: context.schoolId,
      invoiceId: id,
      revisionNo,
      snapshot: plan.after,
      changes: [...extraChanges, ...plan.changes],
      reason,
      amountPaid: existing.amountPaid,
      createdByUserId: context.user.id,
      createdByName: context.user.displayName,
    });

    if (newLines && lineSync) {
      const rowFor = (line: IssueLine, index: number) => ({
        description: line.description,
        category: line.category,
        quantity: line.quantity,
        unitAmount: line.unitAmount.toFixed(2),
        discountAmount: line.discountAmount.toFixed(2),
        lineTotal: fromKobo(lineTotalKobo(line)),
        isOptional: line.isOptional,
        sortOrder: index,
        accounts: line.accounts,
      });

      // What had been itemised to a charge that is going, or that now costs less
      // than was itemised to it, is let go of first — the database refuses to
      // delete a charge that payments still name. The payments themselves stay.
      await this.invoices.releaseLinePayments(manager, context.schoolId, lineSync.remove);
      for (const capped of plan.cappedLines) {
        await this.invoices.capLinePayments(manager, context.schoolId, capped.id, capped.totalKobo);
      }

      await this.invoices.deleteLinesById(manager, lineSync.remove);
      for (const kept of lineSync.keep) {
        await this.invoices.updateLine(manager, kept.id, rowFor(newLines[kept.index], kept.index));
      }
      await this.invoices.createLines(
        lineSync.insert.map((index) => ({
          schoolId: context.schoolId,
          invoiceId: id,
          feeItemId: newLines[index].feeItemId,
          ...rowFor(newLines[index], index),
        })),
        manager,
      );
    }

    await this.invoices.updateFields(id, plan.fields, manager);
  }

  /**
   * Moves the carried copies of an earlier invoice's charges by what those
   * charges moved by, on the invoice that carries them.
   *
   * Only follow-ups raised for the same term hold real carried lines; an earlier
   * term's arrears is a lump with nothing to move, and the loop finds no copies
   * for it. A carried charge may go to nothing or below what was put towards it
   * here; what had been itemised to it is let go of, and the payment stays on
   * the invoice.
   */
  private async syncCarriedCopies(
    manager: EntityManager,
    context: RequestContext,
    carrier: InvoiceDTO,
    upstream: EditedInvoice[],
  ): Promise<void> {
    for (const { dto, plan } of upstream) {
      if (plan.lineDeltas.length === 0) continue;

      const copies = await this.invoices.findCarriedCopies(
        manager,
        context.schoolId,
        carrier.id,
        dto.id,
      );
      const sync = planCarriedSync(
        copies.map((copy) => ({
          id: copy.id,
          feeItemId: copy.feeItemId,
          totalKobo: Math.round(copy.total * MONEY_SCALE),
          paidKobo: Math.round(copy.paid * MONEY_SCALE),
        })),
        plan.lineDeltas,
      );

      for (const update of sync.update) {
        if (update.belowPaid) {
          await this.invoices.capLinePayments(
            manager,
            context.schoolId,
            update.id,
            update.totalKobo,
          );
        }
        await this.invoices.updateLine(manager, update.id, {
          unitAmount: fromKobo(update.totalKobo),
          lineTotal: fromKobo(update.totalKobo),
        });
      }
      await this.invoices.releaseLinePayments(manager, context.schoolId, sync.remove);
      await this.invoices.deleteLinesById(manager, sync.remove);

      if (sync.insert.length > 0) {
        let sortOrder =
          (await this.invoices.maxCarriedSortOrder(manager, carrier.id)) ?? CARRIED_SORT_OFFSET - 1;
        await this.invoices.createLines(
          sync.insert.flatMap((entry) => {
            const line = plan.newLines?.find((candidate) => candidate.feeItemId === entry.feeItemId);
            if (!line) return [];
            sortOrder += 1;
            return [
              {
                schoolId: context.schoolId,
                invoiceId: carrier.id,
                feeItemId: line.feeItemId,
                description: line.description,
                category: line.category,
                quantity: 1,
                unitAmount: fromKobo(entry.totalKobo),
                discountAmount: '0.00',
                lineTotal: fromKobo(entry.totalKobo),
                isOptional: line.isOptional,
                sortOrder,
                accounts: line.accounts,
                carriedFromInvoiceId: dto.id,
              },
            ];
          }),
          manager,
        );
      }
    }
  }

  /* -- Versions -------------------------------------------------------------- */

  /**
   * Every version this invoice has had, newest first.
   *
   * Empty for an invoice nobody has edited — which is not "no history" but
   * "still the original", and the screen says so. A parent is not offered this:
   * the reasons are the office's own notes, so the route asks for
   * `invoice.manage` or `audit.read`, and this still goes through the same
   * student-visibility check as the invoice itself.
   */
  async fetchInvoiceRevisions(
    context: RequestContext,
    id: string,
  ): Promise<InvoiceRevisionDTO[]> {
    const invoice = await this.invoices.findOneDTO(context.schoolId, id);
    if (!invoice) throw AppError.notFound('Invoice');
    if (!(await this.access.canSeeStudent(context, invoice.studentId))) {
      throw AppError.notFound('Invoice');
    }
    return this.invoices.fetchRevisions(context.schoolId, id);
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
   * A discount ticked by hand can also name which of this bill's own lines it
   * comes off (`feeItemIds`) — combined with the discount's own configured
   * scope by `resolveDiscountScope`, so a bill can narrow a discount's reach
   * but never widen it past what the discount was defined for. A granted
   * discount always keeps its full reach; it is not something raising one
   * bill gets to redefine.
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
    chosen: { discountId: string; feeItemIds: string[] }[] = [],
    strict = true,
  ): Promise<ApplicableDiscount[]> {
    const byStudent = await this.grants.fetchApplicable(schoolId, [studentId], sessionId, termId);
    const granted = byStudent.get(studentId) ?? [];

    const extra = chosen.filter(
      (entry) => !granted.some((discount) => discount.discountId === entry.discountId),
    );
    if (extra.length === 0) return granted;

    const definitions = await this.discountDefinitions.fetchForSchool(schoolId);
    const picked: ApplicableDiscount[] = [];
    const seen = new Set<string>();
    for (const entry of extra) {
      if (seen.has(entry.discountId)) continue;
      seen.add(entry.discountId);
      const definition = definitions.find((row) => row.id === entry.discountId && row.isActive);
      if (!definition) {
        if (strict) throw AppError.validation('One of those discounts is not available.');
        continue;
      }
      picked.push({
        discountId: definition.id,
        name: definition.name,
        type: definition.type,
        mode: definition.mode,
        value: definition.value,
        appliesToFeeItemIds: resolveDiscountScope(definition.appliesToFeeItemIds, entry.feeItemIds),
      });
    }
    return [...granted, ...picked];
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
  carriedLines: CarriedLineDraft[] = [],
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
    })).concat(
      // Not billing: these are inside `broughtForward`, and `subtotal` above was
      // worked out from the invoice's own lines alone.
      carriedLines.map((line, index) => ({
        schoolId: params.schoolId,
        feeItemId: line.feeItemId,
        description: line.description,
        category: line.category,
        quantity: 1,
        unitAmount: line.total.toFixed(2),
        discountAmount: '0.00',
        lineTotal: line.total.toFixed(2),
        isOptional: line.isOptional,
        // After every charge of its own, however the bill is edited later.
        sortOrder: CARRIED_SORT_OFFSET + index,
        accounts: line.accounts,
        carriedFromInvoiceId: line.sourceInvoiceId,
      })),
    ),
  };
}

/** Carried lines sort after the invoice's own charges, whatever their number. */
const CARRIED_SORT_OFFSET = 1000;

/** An earlier invoice's outstanding charge, as it goes onto a follow-up. */
export interface CarriedLineDraft {
  sourceInvoiceId: string;
  feeItemId: string;
  description: string;
  category: FeeCategory;
  isOptional: boolean;
  accounts: CarryableLine['accounts'];
  /** What is being carried for this fee item. */
  total: number;
}

/**
 * The fee items still owing on one invoice being carried, at the amount that is
 * actually moving across.
 *
 * Normally each item goes at what is left on it. But money paid on the invoice
 * without naming a fee item lowers its balance while leaving every item's
 * alone, so the items can add up to more than the balance being carried. That
 * excess is taken off from the first item down — the same order a payment
 * settles an invoice's charges when nobody says otherwise — so the lines always
 * add up to no more than what was carried, and no item is ever asked for more
 * than is really owed.
 *
 * Where the items add up to less (the invoice was itself carrying a balance no
 * item accounts for), what is left stays as part of the lump.
 */
export function itemiseCarried(
  source: CarryForwardCandidate,
  lines: CarryableLine[],
): CarriedLineDraft[] {
  const owing = lines.filter((line) => Math.round(line.balance * MONEY_SCALE) > 0);
  const owingKobo = owing.reduce((sum, line) => sum + Math.round(line.balance * MONEY_SCALE), 0);
  let excess = owingKobo - Math.max(0, Math.round(source.balance * MONEY_SCALE));

  const drafts: CarriedLineDraft[] = [];
  for (const line of owing) {
    let kobo = Math.round(line.balance * MONEY_SCALE);
    if (excess > 0) {
      const taken = Math.min(kobo, excess);
      kobo -= taken;
      excess -= taken;
    }
    if (kobo <= 0) continue;
    drafts.push({
      sourceInvoiceId: source.id,
      feeItemId: line.feeItemId,
      description: line.description,
      category: line.category,
      isOptional: line.isOptional,
      accounts: line.accounts,
      total: kobo / MONEY_SCALE,
    });
  }
  return drafts;
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

/** What one charge comes to once its own discount is off, in kobo. */
function lineTotalKobo(line: IssueLine): number {
  return (
    Math.round(line.unitAmount * line.quantity * MONEY_SCALE) -
    Math.round(line.discountAmount * MONEY_SCALE)
  );
}

/** `₦150,000`, for the sentence in a refusal — kobo only when there are some. */
function formatNairaWhole(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
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
