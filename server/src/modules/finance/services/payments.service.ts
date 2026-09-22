import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { amountInWords } from '../../../shared/utils/numberToWords';
import { buildReceiptPdfAttachment, sendReceiptEmail } from '../../../shared/utils/mailer';
import { chooseRecipient } from '../../../shared/utils/whatsapp';
import { resolveTimezone } from '../../../shared/utils/timezone';
import {
  WhatsAppShareService,
  type WhatsAppShare,
} from '../../../shared/services/whatsappShare.service';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { WebsiteService } from '../../school/services/website.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { InvoiceRepository, type InvoiceBrief } from '../repositories/invoice.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { RavenClient, type RavenCollection } from './raven.client';
import { Payment, type PaymentMethod } from '../entities/payment.entity';
import { PaymentAccount } from '../entities/paymentAccount.entity';
import type { PaymentAccountDTO, PaymentDTO, ReceiptDTO } from '../dto/finance.dto';
import type {
  CreatePaymentAccountInput,
  FetchPaymentsQuery,
  RavenWebhookBody,
  RecordPaymentInput,
} from '../validators/payments.schema';

/** Money is compared in kobo; a float comparison rejects an exact payment. */
const MONEY_SCALE = 100;

/** What a webhook call resolved to — returned to Raven as the body, and logged. */
export interface WebhookOutcome {
  handled: boolean;
  reason: string;
  paymentId?: string;
}

/**
 * A receipt is a proof of payment, not the raw ledger. A genuine overpayment can
 * leave the school with a negative student balance in the ledger, but customers
 * should not be told the receipt itself leaves them in the red.
 */
export function clampReceiptBalance(balance: number): number {
  if (!Number.isFinite(balance)) return 0;
  return Math.max(0, balance);
}

/**
 * Why a payment cannot be reversed, or `null` if it can.
 *
 * Three things are off limits. A payment that is not `SUCCESSFUL` has nothing
 * to undo. A Raven credit is money the bank really moved, and only the bank can
 * move it back — marking it reversed here would make the ledger say the family
 * owes what they have paid. And a payment somebody has already reconciled has
 * been signed off against the bank statement; quietly reversing it afterwards
 * would leave that sign-off vouching for money the ledger no longer counts.
 */
export function reversalRefusal(
  payment: Pick<Payment, 'status' | 'provider' | 'isReconciled'>,
): string | null {
  if (payment.status === 'REVERSED') return 'That payment has already been reversed.';
  if (payment.status !== 'SUCCESSFUL') return 'Only a successful payment can be reversed.';
  if (payment.provider !== 'MANUAL') {
    return 'This credit arrived through the bank, so it cannot be undone here.';
  }
  if (payment.isReconciled) {
    return 'This payment has already been reconciled against the bank statement, so it cannot be reversed.';
  }
  return null;
}

/**
 * Money arriving through Raven (spec section 27).
 *
 * Two halves. The office asks for a collection account — a bank account number
 * tied to one student and one amount — and hands it to the family, who pay by
 * ordinary bank transfer from whichever app they already use. Raven then
 * notifies this server, and the notification is treated as a *prompt*, not as
 * proof: the credit is fetched back from Raven's own API by its `session_id`
 * before a payment row is written. A notification can be forged, replayed or
 * delivered twice; a record read from Raven with our secret key cannot.
 */
export class PaymentsService {
  static Instance = new PaymentsService();

  private constructor(
    private readonly payments = PaymentRepository.Instance,
    private readonly invoices = InvoiceRepository.Instance,
    private readonly ledger = LedgerRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly websites = WebsiteService.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly raven = RavenClient.Instance,
    private readonly audit = AuditService.Instance,
    private readonly notifications = NotificationsService.Instance,
    private readonly sharing = WhatsAppShareService.Instance,
  ) {}

  /* -- Reads ----------------------------------------------------------------- */

  async fetchPayments(context: RequestContext, query: FetchPaymentsQuery): Promise<Paginated<PaymentDTO>> {
    // A parent sees their own children's receipts and nobody else's.
    const visibleIds = await this.access.visibleStudentIds(context);
    // Only a date bound needs the zone, so an unfiltered list pays for no extra read.
    const timezone =
      query.dateFrom || query.dateTo ? await this.schoolTimezone(context.schoolId) : undefined;
    return this.payments.fetchPaginated(context.schoolId, {
      ...query,
      reconciled: query.reconciled === undefined ? undefined : query.reconciled === 'true',
      timezone,
      visibleIds,
    });
  }

  private async schoolTimezone(schoolId: string): Promise<string> {
    const school = await this.schools.findById(schoolId);
    return resolveTimezone(school?.settings?.timezone);
  }

  async fetchAccountsForStudent(context: RequestContext, studentId: string): Promise<PaymentAccountDTO[]> {
    return this.payments.fetchAccountsForStudent(context.schoolId, studentId);
  }

  async emailReceipt(
    context: RequestContext,
    paymentId: string,
    input: { guardianId: string; includeCharges: boolean },
  ): Promise<{ sent: boolean; email: string }> {
    const receipt = await this.fetchReceipt(context, paymentId);
    assertReceiptIssuable(receipt);
    if (!receipt.studentId) {
      throw AppError.validation('This payment is not linked to a student record.');
    }

    const link = await this.guardians.findLinkByPair(context.schoolId, receipt.studentId, input.guardianId);
    if (!link) {
      throw AppError.validation('That guardian is not linked to this student.');
    }

    const guardian = await this.guardians.findByIdScoped(context.schoolId, input.guardianId);
    if (!guardian || !guardian.email) {
      throw AppError.validation('Add an email address for this guardian first.');
    }

    const [school, website] = await Promise.all([
      this.schools.findById(context.schoolId),
      this.websites.getForSchool(context.schoolId),
    ]);
    if (!school) throw AppError.internal();

    // The same contact details `InvoicesService.fetchInvoice` gives an
    // invoice — the school's published website contact where it has one, its
    // own record otherwise — so a family reads one address on both. The
    // school's own email still routes the send (see `SendArgs.schoolEmail`).
    await sendReceiptEmail({
      to: guardian.email,
      firstName: guardian.firstName,
      schoolName: receipt.schoolName,
      schoolLogoUrl: receipt.schoolLogoUrl,
      schoolAddress: website.address || receipt.schoolAddress,
      schoolPhone: website.contactPhone || school.phone,
      schoolEmail: school.email,
      studentName: receipt.studentName,
      admissionNo: receipt.admissionNo,
      className: receipt.className,
      receiptNo: receipt.receiptNo,
      paymentId: receipt.paymentId,
      amount: receipt.amount,
      amountInWords: receipt.amountInWords,
      method: receipt.method,
      paidAt: receipt.paidAt,
      receivedByName: receipt.receivedByName,
      allocations: receipt.allocations,
      balanceAfter: receipt.balanceAfter,
      verificationCode: receipt.verificationCode,
      contactEmail: website.contactEmail || school.email,
      includeCharges: input.includeCharges,
    });

    await this.audit.record(context, {
      action: 'receipt.emailed',
      entityType: 'Payment',
      entityId: receipt.paymentId,
      entityLabel: `${receipt.receiptNo} · ${receipt.studentName}`,
      after: { guardianId: input.guardianId, email: guardian.email },
    });

    return { sent: true, email: guardian.email };
  }

  /**
   * Stores this receipt's PDF and hands back a WhatsApp message carrying its
   * link, addressed to whoever pays the student's fees.
   *
   * A payment with no student on it is still shareable — the message then goes
   * to "Parent/Guardian" and the sender picks the chat in WhatsApp themselves.
   * Otherwise see `InvoicesService.shareInvoiceOnWhatsApp` for who it goes to.
   * Nothing is sent from here.
   */
  async shareReceiptOnWhatsApp(
    context: RequestContext,
    paymentId: string,
    input: { includeCharges: boolean },
  ): Promise<WhatsAppShare> {
    const receipt = await this.fetchReceipt(context, paymentId);
    assertReceiptIssuable(receipt);

    const [school, website, guardians] = await Promise.all([
      this.schools.findById(context.schoolId),
      this.websites.getForSchool(context.schoolId),
      receipt.studentId
        ? this.guardians.findContactsForStudent(context.schoolId, receipt.studentId)
        : null,
    ]);
    if (!school) throw AppError.internal();

    // No student means no guardian to look for, which is not something to warn
    // about — unlike a student whose guardians simply have no number.
    const recipient = guardians
      ? chooseRecipient(guardians)
      : { guardian: null, greeting: 'Parent/Guardian', phone: null, notice: null };

    // The same contact details `emailReceipt` gives the emailed copy.
    const contactEmail = website.contactEmail || school.email;

    const pdf = await buildReceiptPdfAttachment({
      schoolName: receipt.schoolName,
      schoolLogoUrl: receipt.schoolLogoUrl,
      schoolAddress: website.address || receipt.schoolAddress,
      schoolPhone: website.contactPhone || school.phone,
      schoolEmail: contactEmail,
      studentName: receipt.studentName,
      admissionNo: receipt.admissionNo,
      className: receipt.className,
      receiptNo: receipt.receiptNo,
      paymentId: receipt.paymentId,
      amount: receipt.amount,
      amountInWords: receipt.amountInWords,
      method: receipt.method,
      paidAt: receipt.paidAt,
      receivedByName: receipt.receivedByName,
      allocations: receipt.allocations,
      balanceAfter: receipt.balanceAfter,
      verificationCode: receipt.verificationCode,
      includeCharges: input.includeCharges,
    });

    const share = await this.sharing.shareDocument({
      kind: 'receipt',
      pdf,
      name: receipt.receiptNo,
      greeting: recipient.greeting,
      subject: `your payment receipt for ${receipt.studentName}`,
      phone: recipient.phone,
      notice: recipient.notice,
      confidential: true,
      schoolName: receipt.schoolName,
      contactEmail,
    });

    await this.audit.record(context, {
      action: 'receipt.whatsappShared',
      entityType: 'Payment',
      entityId: receipt.paymentId,
      entityLabel: `${receipt.receiptNo} · ${receipt.studentName}`,
      after: { guardianId: recipient.guardian?.id ?? null },
    });

    return share;
  }

  /**
   * The printable receipt.
   *
   * `balanceAfter` is recomputed from the ledger as at the moment the money
   * landed, not stored on the payment: a receipt reprinted next term must
   * still show what the family owed *then*, and a stored figure would have
   * been overwritten by everything that happened since.
   */
  async fetchReceipt(context: RequestContext, paymentId: string): Promise<ReceiptDTO> {
    const payment = await this.payments.findOneDTO(context.schoolId, paymentId);
    if (!payment) throw AppError.notFound('Receipt');
    if (payment.studentId && !(await this.access.canSeeStudent(context, payment.studentId))) {
      throw AppError.notFound('Receipt');
    }

    const entity = await this.payments.findEntity(context.schoolId, paymentId);
    if (!entity) throw AppError.notFound('Receipt');

    const school = await this.schools.findById(context.schoolId);
    if (!school) throw AppError.notFound('School');

    const student = payment.studentId
      ? await this.students.findOneDTO(context.schoolId, payment.studentId)
      : null;

    const invoiceIds = payment.allocations.map((row) => row.invoiceId);
    const briefs = await this.invoices.findManyBrief(context.schoolId, invoiceIds);
    const termOf = new Map(briefs.map((brief) => [brief.id, brief]));

    const lineRows = await this.invoices.findLinesForInvoices(context.schoolId, invoiceIds);
    const linesByInvoice = new Map<string, typeof lineRows>();
    for (const row of lineRows) {
      const existing = linesByInvoice.get(row.invoiceId);
      if (existing) existing.push(row);
      else linesByInvoice.set(row.invoiceId, [row]);
    }

    // Money that arrived without being assigned to a bill still gets a
    // receipt: the family paid it, and "on account" is what it is for.
    const balanceAfter = payment.studentId
      ? await this.ledger.balanceAsOf(
          context.schoolId,
          payment.studentId,
          entity.paidAt,
          entity.id,
        )
      : 0;

    return {
      id: entity.id,
      receiptNo: payment.reference,
      paymentId: entity.id,
      studentId: payment.studentId ?? student?.id ?? '',
      schoolName: school.name,
      schoolLogoUrl: school.branding?.logoUrl ?? null,
      schoolAddress: [school.addressLine1, school.addressLine2, school.city, school.state]
        .filter(Boolean)
        .join(', '),
      studentName: student?.fullName ?? payment.studentName,
      admissionNo: student?.admissionNo ?? payment.admissionNo,
      className: student?.currentClassName ?? null,
      amount: payment.amount,
      amountInWords: amountInWords(payment.amount, entity.currency),
      method: payment.method,
      paidAt: entity.paidAt.toISOString(),
      // A Raven credit was keyed in by nobody, and saying so is more use to a
      // parent querying it than an empty line would be.
      receivedByName: payment.recordedByName ?? 'Raven (bank transfer)',
      allocations: payment.allocations.map((allocation) => {
        const brief = termOf.get(allocation.invoiceId);
        const paidLineIds = new Set(allocation.paidLineIds);
        return {
          invoiceId: allocation.invoiceId,
          invoiceNo: allocation.invoiceNo,
          description: brief ? `${brief.termName} · ${brief.sessionName} fees` : 'School fees',
          amount: allocation.amount,
          invoiceTotal: brief?.total ?? allocation.amount,
          lines: (linesByInvoice.get(allocation.invoiceId) ?? []).map((line) => ({
            id: line.id,
            description: line.description,
            isOptional: line.isOptional,
            amount: line.amount,
            paid: paidLineIds.has(line.id),
          })),
        };
      }),
      balanceAfter: clampReceiptBalance(balanceAfter),
      verificationCode: entity.verificationCode,
      status: entity.status,
      reversalReason: entity.reversalReason,
    };
  }

  /**
   * Marks which of one invoice's charges this payment is recorded as having
   * paid for — a bursar's annotation on the receipt, not a re-allocation. The
   * amount this payment put towards the invoice, and the invoice's own
   * balance, are untouched: `payment_allocations.amount` still says what
   * settled the bill, and this only says which named items the office is
   * telling the family (or itself, later) that money was for.
   *
   * `lineIds` replaces whatever was marked before, so unchecking every box on
   * the screen and saving genuinely clears the mark rather than being a no-op.
   */
  async markReceiptItems(
    context: RequestContext,
    paymentId: string,
    invoiceId: string,
    lineIds: string[],
  ): Promise<ReceiptDTO> {
    const payment = await this.payments.findEntity(context.schoolId, paymentId);
    if (!payment) throw AppError.notFound('Payment');

    const lines = await this.invoices.findLinesForInvoices(context.schoolId, [invoiceId]);
    if (lines.length === 0) throw AppError.notFound('Invoice');

    const validIds = new Set(lines.map((line) => line.id));
    const unique = Array.from(new Set(lineIds));
    const unknown = unique.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      throw AppError.validation('One of those fee items is not on this invoice.');
    }

    const applied = await this.payments.setAllocationPaidLines(
      context.schoolId,
      paymentId,
      invoiceId,
      unique,
    );
    if (!applied) {
      throw AppError.validation('This payment was not applied to that invoice.');
    }

    await this.audit.record(context, {
      action: 'receipt.itemsMarked',
      entityType: 'Payment',
      entityId: paymentId,
      entityLabel: payment.reference,
      after: { invoiceId, lineIds: unique },
    });

    return this.fetchReceipt(context, paymentId);
  }

  /* -- Money taken at the desk ------------------------------------------------ */

  /**
   * Cash, a transfer the office saw on the statement, a POS stub, a cheque.
   *
   * The validation is the substance here. An allocation must point at an
   * invoice belonging to *this* student — otherwise one family's cash quietly
   * settles another's bill — at one that is still open, and at no more than
   * that bill's remaining balance. The allocations together must not exceed
   * the payment. Every one of those is checked against rows locked for the
   * transaction, because a balance read a moment earlier is a balance that
   * another till may already have spent.
   *
   * Online credits never come through here: they are written by the webhook
   * after Raven's own API has confirmed them (spec section 27).
   */
  async recordManualPayment(
    context: RequestContext,
    input: RecordPaymentInput,
  ): Promise<PaymentDTO> {
    const student = await this.students.findOneDTO(context.schoolId, input.studentId);
    if (!student) throw AppError.notFound('Student');

    const amountKobo = Math.round(input.amount * MONEY_SCALE);
    const allocatedKobo = input.allocations.reduce(
      (sum, row) => sum + Math.round(row.amount * MONEY_SCALE),
      0,
    );
    if (allocatedKobo > amountKobo) {
      throw AppError.validation(
        'Those allocations add up to more than the payment. Reduce them or record a larger amount.',
      );
    }

    const paidAt = new Date(input.paidAt);
    if (Number.isNaN(paidAt.getTime())) throw AppError.validation('That payment date is not valid.');

    const payment = await AppDataSource.transaction(async (manager) => {
      const invoices = await this.invoices.lockForAllocation(
        manager,
        context.schoolId,
        input.allocations.map((row) => row.invoiceId),
      );
      this.assertAllocatable(input, invoices, student.id);

      const created = await this.payments.create(
        {
          schoolId: context.schoolId,
          studentId: student.id,
          paymentAccountId: null,
          reference: paymentReference(),
          provider: 'MANUAL',
          // Ours alone. Raven's uniqueness constraint is on this column, and a
          // hand-keyed teller number belongs in `externalReference`.
          providerReference: null,
          externalReference: input.reference ? input.reference : null,
          verificationCode: verificationCode(),
          method: input.method,
          amount: input.amount.toFixed(2),
          fee: '0.00',
          currency: 'NGN',
          status: 'SUCCESSFUL',
          paidAt,
          payerName: null,
          isReconciled: false,
          note: input.note ? input.note : null,
          recordedByUserId: context.user.id,
          providerPayload: null,
        },
        manager,
      );

      await this.applyAllocations(
        manager,
        context.schoolId,
        created.id,
        input.allocations,
        context.user.id,
      );
      return created;
    });

    await this.audit.record(context, {
      action: 'payment.recorded',
      entityType: 'Payment',
      entityId: payment.id,
      entityLabel: `${payment.reference} · ${student.fullName}`,
      after: {
        amount: input.amount,
        method: input.method,
        allocations: input.allocations.length,
      },
    });

    const dto = await this.payments.findOneDTO(context.schoolId, payment.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * Signing off that a credit matches the bank.
   *
   * A conflict rather than a silent success on a second attempt: two people
   * both believing they were the one who checked it is exactly the confusion
   * reconciliation exists to prevent. The update itself is conditional on the
   * row still being unreconciled, so the race is settled by the database.
   */
  async reconcilePayment(
    context: RequestContext,
    id: string,
    note: string | undefined,
  ): Promise<PaymentDTO> {
    const existing = await this.payments.findEntity(context.schoolId, id);
    if (!existing) throw AppError.notFound('Payment');
    // Nothing to check against the bank: the ledger no longer counts this money.
    if (existing.status !== 'SUCCESSFUL') {
      throw AppError.conflict('Only a successful payment can be reconciled.');
    }

    const applied = await this.payments.markReconciled(
      context.schoolId,
      id,
      context.user.id,
      note ? note : null,
    );
    if (!applied) throw AppError.conflict('That payment has already been reconciled.');

    await this.audit.record(context, {
      action: 'payment.reconciled',
      entityType: 'Payment',
      entityId: id,
      entityLabel: existing.reference,
      after: { amount: existing.amount, note: note ?? null },
    });

    const dto = await this.payments.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * Undoes a desk payment that was recorded wrongly — the amount mistyped, the
   * wrong student, a slip entered twice. To correct one, reverse it and record
   * the right payment afresh.
   *
   * A reversal, not an edit and not a delete. An edit would rewrite a receipt
   * the family may already hold — printed, emailed or sent on WhatsApp — so the
   * paper would say one thing and the ledger another. A delete would take the
   * evidence with it; `Payment` says a reversed row is marked, not removed, so
   * the ledger keeps adding up to what actually happened. The row and its
   * allocations survive, and every figure derived from payments already counts
   * only `SUCCESSFUL` ones, so flipping the status is what makes the ledger,
   * the debtors list and each invoice's balance correct themselves.
   *
   * The invoices it had settled are locked first, the way recording a payment
   * locks them, so a reversal and a fresh payment against the same bill queue
   * instead of racing. Their status is then re-derived — a `PAID` bill goes
   * back to `PART_PAID` or `ISSUED`.
   *
   * One case is refused rather than handled: an invoice this payment settled
   * that has since been carried forward into a later one. That later invoice's
   * brought-forward figure was struck net of this money, so reversing it would
   * leave the new bill understating what is owed. Cancelling the later invoice
   * reopens the old one, and the reversal can go ahead after that.
   */
  async reversePayment(context: RequestContext, id: string, reason: string): Promise<PaymentDTO> {
    const existing = await this.payments.findEntity(context.schoolId, id);
    if (!existing) throw AppError.notFound('Payment');

    const refusal = reversalRefusal(existing);
    if (refusal) throw AppError.conflict(refusal);

    await AppDataSource.transaction(async (manager) => {
      const settled = await this.payments.allocatedInvoices(manager, context.schoolId, id);
      await this.invoices.lockForAllocation(
        manager,
        context.schoolId,
        settled.map((row) => row.invoiceId),
      );

      const carried = settled.find((row) => row.carriedForward);
      if (carried) {
        throw AppError.conflict(
          `This payment settled invoice ${carried.invoiceNo}, whose balance has since been carried forward into a later invoice. Cancel that later invoice first, then reverse this payment.`,
        );
      }

      const applied = await this.payments.markReversed(
        manager,
        context.schoolId,
        id,
        context.user.id,
        reason,
      );
      if (!applied) {
        // Somebody reversed or reconciled it between the check above and now.
        throw AppError.conflict('That payment can no longer be reversed. Refresh and check its status.');
      }

      for (const row of settled) {
        await this.invoices.recalculateStatus(manager, row.invoiceId);
      }
    });

    const dto = await this.payments.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.internal();

    await this.audit.record(context, {
      action: 'payment.reversed',
      entityType: 'Payment',
      entityId: id,
      entityLabel: `${dto.reference} · ${dto.studentName}`,
      before: { status: 'SUCCESSFUL', amount: dto.amount, method: dto.method },
      after: { status: 'REVERSED', reason },
      severity: 'WARNING',
    });

    return dto;
  }

  /**
   * Writes the allocation rows and re-derives each invoice's status from them.
   *
   * Shared by the desk and by Raven's auto-allocation so a bill reaches
   * `PART_PAID` the same way however the money arrived.
   */
  private async applyAllocations(
    manager: EntityManager,
    schoolId: string,
    paymentId: string,
    allocations: { invoiceId: string; amount: number }[],
    userId: string | null,
  ): Promise<void> {
    if (allocations.length === 0) return;

    await this.payments.createAllocations(
      allocations.map((row) => ({
        schoolId,
        paymentId,
        invoiceId: row.invoiceId,
        amount: row.amount.toFixed(2),
        createdByUserId: userId,
      })),
      manager,
    );

    for (const row of allocations) {
      await this.invoices.recalculateStatus(manager, row.invoiceId);
    }
  }

  /** Every reason an allocation is refused, checked against locked rows. */
  private assertAllocatable(
    input: RecordPaymentInput,
    invoices: InvoiceBrief[],
    studentId: string,
  ): void {
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    for (const allocation of input.allocations) {
      const invoice = byId.get(allocation.invoiceId);
      if (!invoice) throw AppError.validation('One of those invoices does not exist.');
      if (invoice.studentId !== studentId) {
        throw AppError.validation(
          `Invoice ${invoice.invoiceNo} belongs to a different student.`,
        );
      }
      if (invoice.status === 'CANCELLED') {
        throw AppError.validation(`Invoice ${invoice.invoiceNo} has been cancelled.`);
      }
      if (invoice.status === 'PAID') {
        throw AppError.validation(`Invoice ${invoice.invoiceNo} is already paid in full.`);
      }

      const outstanding = Math.round((invoice.total - invoice.paid) * MONEY_SCALE);
      if (Math.round(allocation.amount * MONEY_SCALE) > outstanding) {
        throw AppError.validation(
          `That is more than is outstanding on invoice ${invoice.invoiceNo}.`,
        );
      }
    }
  }

  /**
   * Turns an approved payment-receipt claim into a real payment.
   *
   * Called only by `PaymentReceiptsService` once a member of staff has
   * checked the family's slip against the bank statement — this method
   * trusts the amount, date and invoice it is given exactly the way
   * `recordManualPayment` trusts the desk, because by this point a human
   * already did the checking `recordManualPayment` itself would defer to.
   */
  async recordApprovedReceipt(
    context: RequestContext,
    input: {
      studentId: string;
      invoiceId: string | null;
      amount: number;
      method: PaymentMethod;
      paidAt: Date;
      reference: string | null;
      note: string | null;
    },
  ): Promise<PaymentDTO> {
    return AppDataSource.transaction(async (manager) => {
      let invoice: InvoiceBrief | null = null;
      if (input.invoiceId) {
        const [locked] = await this.invoices.lockForAllocation(manager, context.schoolId, [
          input.invoiceId,
        ]);
        if (!locked) throw AppError.notFound('Invoice');
        if (locked.studentId !== input.studentId) {
          throw AppError.validation('That invoice belongs to a different student.');
        }
        invoice = locked;
      }

      const created = await this.payments.create(
        {
          schoolId: context.schoolId,
          studentId: input.studentId,
          paymentAccountId: null,
          reference: paymentReference(),
          provider: 'MANUAL',
          providerReference: null,
          externalReference: input.reference,
          verificationCode: verificationCode(),
          method: input.method,
          amount: input.amount.toFixed(2),
          fee: '0.00',
          currency: 'NGN',
          status: 'SUCCESSFUL',
          paidAt: input.paidAt,
          payerName: null,
          isReconciled: false,
          note: input.note,
          recordedByUserId: context.user.id,
          providerPayload: null,
        },
        manager,
      );

      // Capped at what is actually outstanding, the same as a Raven credit
      // landing on a tied account: an over-payment stays unallocated rather
      // than being forced onto a bill that did not ask for it.
      if (invoice && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID') {
        const outstandingKobo = Math.round((invoice.total - invoice.paid) * MONEY_SCALE);
        const applyKobo = Math.min(Math.round(input.amount * MONEY_SCALE), outstandingKobo);
        if (applyKobo > 0) {
          await this.applyAllocations(
            manager,
            context.schoolId,
            created.id,
            [{ invoiceId: invoice.id, amount: applyKobo / MONEY_SCALE }],
            context.user.id,
          );
        }
      }

      const dto = await this.payments.findOneDTO(context.schoolId, created.id);
      if (!dto) throw AppError.internal();
      return dto;
    });
  }

  /* -- Asking Raven for an account number ------------------------------------ */

  /**
   * One account per bill, issued to the *payer*, attributed to the student.
   *
   * Raven's partner will only open an account in the name of someone whose
   * BVN it can verify, and a child has no BVN — so the customer Raven sees is
   * the primary guardian, and the link back to the child is this row, not the
   * account name. The BVN itself goes to Raven and nowhere else: not the
   * database, not the audit log, not the provider payload we keep.
   *
   * Tying the account to an invoice is what turns "a transfer arrived" into "a
   * bill was paid": the credit allocates itself when it lands, and nobody has
   * to match it up by hand the next morning.
   */
  async createCollectionAccount(
    context: RequestContext,
    input: CreatePaymentAccountInput,
  ): Promise<PaymentAccountDTO> {
    if (!this.raven.configured) {
      throw AppError.internal('Online payments are not set up on this server yet (RAVEN_SECRET_KEY).');
    }

    const student = await this.students.findOneDTO(context.schoolId, input.studentId);
    if (!student) throw AppError.notFound('Student');

    let invoice: InvoiceBrief | null = null;
    if (input.invoiceId) {
      const [found] = await this.invoices.findManyBrief(context.schoolId, [input.invoiceId]);
      if (!found) throw AppError.notFound('Invoice');
      if (found.studentId !== student.id) {
        throw AppError.validation('That invoice belongs to a different student.');
      }
      if (found.status === 'CANCELLED' || found.status === 'PAID') {
        throw AppError.validation('That invoice is already settled or cancelled.');
      }
      invoice = found;
    }

    // `linksForStudent` orders the primary contact first.
    const [guardian] = await this.guardians.linksForStudent(context.schoolId, student.id);
    if (!guardian) {
      throw AppError.validation(
        'This student has no guardian on record. The payment account is issued in the guardian’s name, so add one first.',
      );
    }
    const [payerFirst, ...payerRest] = guardian.guardianName.trim().split(/\s+/);
    if (!guardian.guardianEmail || !guardian.guardianPhone || !payerFirst) {
      throw AppError.validation(
        'Raven needs the guardian’s full name, email address and phone number. Complete their record first.',
      );
    }

    const generated = await this.raven.generateCollectionAccount({
      firstName: payerFirst,
      lastName: payerRest.join(' ') || payerFirst,
      phone: guardian.guardianPhone,
      email: guardian.guardianEmail,
      amount: input.amount,
      bvn: input.bvn,
    });

    // Belt and braces: Raven has not echoed the BVN back so far, and if it
    // ever does, it still must not be persisted.
    const { customer, ...rest } = generated as unknown as Record<string, unknown> & {
      customer?: Record<string, unknown>;
    };
    const { bvn: _bvn, ...safeCustomer } = customer ?? {};

    const account = await this.payments.createAccount({
      schoolId: context.schoolId,
      studentId: student.id,
      invoiceId: invoice?.id ?? null,
      provider: 'RAVEN',
      accountNumber: generated.account_number,
      accountName: generated.account_name,
      bankName: generated.bank,
      amount: input.amount.toFixed(2),
      isPermanent: Boolean(generated.isPermanent),
      status: 'ACTIVE',
      // The invoice number is the most useful thing a family can be told this
      // account is for, so it is the default when the office says nothing.
      note: input.note ? input.note : invoice ? `Invoice ${invoice.invoiceNo}` : null,
      createdByUserId: context.user.id,
      providerPayload: { ...rest, customer: safeCustomer },
    });

    await this.audit.record(context, {
      action: 'payment.account.created',
      entityType: 'PaymentAccount',
      entityId: account.id,
      entityLabel: `${generated.account_number} · ${student.fullName}`,
      after: { amount: input.amount, bank: generated.bank, provider: 'RAVEN' },
    });

    const dto = await this.payments.findAccountDTO(context.schoolId, account.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /* -- Raven telling us money arrived ---------------------------------------- */

  /**
   * The only unauthenticated write into the ledger, and so the most careful.
   *
   * Order matters: the shared secret is checked before anything is parsed,
   * the credit is re-read from Raven before anything is trusted, the account
   * number is matched before anything is attributed, and the provider's own
   * id for the credit is what makes a second delivery a no-op. Every
   * "not handled" below answers 200 on purpose — Raven re-sends on failure,
   * and re-sending a notification we have already decided to ignore would
   * only fill a log. A genuine failure to *reach* Raven still throws, so that
   * one does get retried.
   */
  async handleRavenWebhook(
    body: RavenWebhookBody,
    origin: { ipAddress: string | null; requestId: string },
  ): Promise<WebhookOutcome> {
    this.assertWebhookSecret(body.secret);

    const sessionId = findSessionId(body);
    if (!sessionId) {
      return { handled: false, reason: `No session_id on a ${body.type ?? 'typeless'} event` };
    }

    const existing = await this.payments.findByProviderReference('RAVEN', sessionId);
    if (existing) {
      return { handled: true, reason: 'Already recorded', paymentId: existing.id };
    }

    const collection = await this.raven.fetchCollectionBySessionId(sessionId);
    if (!collection) {
      return { handled: false, reason: `Raven has no collection for session ${sessionId}` };
    }

    const account = await this.payments.findAccountByNumber('RAVEN', collection.account_number);
    if (!account) {
      // Money landed on a number this server never issued — a test credit from
      // the Raven dashboard, or an account made outside Scholaris. It cannot be
      // attributed to a school, so it is reported rather than invented.
      console.warn(
        `[${origin.requestId}] Raven credit ${sessionId} to unknown account ${collection.account_number}`,
      );
      return { handled: false, reason: `No student is linked to account ${collection.account_number}` };
    }

    const payment = await this.recordCollection(account, collection, body);

    await this.audit.recordSystem(account.schoolId, {
      actorName: payment.payerName ?? 'Raven',
      actorRole: 'Payment provider',
      action: 'payment.received',
      entityType: 'Payment',
      entityId: payment.id,
      entityLabel: payment.reference,
      after: {
        amount: payment.amount,
        accountNumber: collection.account_number,
        sessionId,
        studentId: account.studentId,
      },
      ipAddress: origin.ipAddress,
      requestId: origin.requestId,
      severity: 'INFO',
    });

    const student = await this.students.findOneDTO(account.schoolId, account.studentId);
    void this.notifications.notifySchoolAdmins(account.schoolId, {
      category: 'FEE',
      title: 'Fee payment received',
      body: `₦${Number(payment.amount).toLocaleString('en-NG')} arrived for ${
        student?.fullName ?? 'a student'
      } (${payment.reference}).`,
      actionUrl: `/finance/payments`,
      severity: 'SUCCESS',
      entityType: 'Payment',
      entityId: payment.id,
    });

    return { handled: true, reason: 'Recorded', paymentId: payment.id };
  }

  /**
   * The insert, the allocation and the account's status change together, and a
   * duplicate that slipped past the earlier check — two deliveries a
   * millisecond apart — is caught by the unique index and resolved to the row
   * that won.
   *
   * Where the account was raised for a particular invoice, the credit settles
   * that invoice up to whatever is still outstanding on it. `min(amount,
   * balance)` rather than the whole amount: a family that transfers more than
   * the bill has overpaid, and the remainder stays on account for the office
   * to place, not pushed onto a bill that did not ask for it.
   */
  private async recordCollection(
    account: PaymentAccount,
    collection: RavenCollection,
    body: RavenWebhookBody,
  ): Promise<Payment> {
    const { secret: _secret, ...notification } = body;
    const paidAt = collection.created_at ? new Date(collection.created_at) : new Date();

    try {
      return await AppDataSource.transaction(async (manager) => {
        const payment = await this.payments.create(
          {
            schoolId: account.schoolId,
            studentId: account.studentId,
            paymentAccountId: account.id,
            reference: paymentReference(),
            provider: 'RAVEN',
            providerReference: collection.session_id,
            externalReference: null,
            verificationCode: verificationCode(),
            method: 'ONLINE',
            amount: Number(collection.amount).toFixed(2),
            fee: Number(collection.fee ?? 0).toFixed(2),
            currency: collection.currency ?? 'NGN',
            status: 'SUCCESSFUL',
            paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
            payerName: payerNameFrom(collection.source),
            isReconciled: false,
            note: null,
            recordedByUserId: null,
            providerPayload: { notification, collection } as Record<string, unknown>,
          },
          manager,
        );

        if (account.invoiceId) {
          const [invoice] = await this.invoices.lockForAllocation(manager, account.schoolId, [
            account.invoiceId,
          ]);
          const outstandingKobo = invoice
            ? Math.round((invoice.total - invoice.paid) * MONEY_SCALE)
            : 0;
          const applyKobo = Math.min(
            Math.round(Number(collection.amount) * MONEY_SCALE),
            outstandingKobo,
          );
          if (invoice && invoice.status !== 'CANCELLED' && applyKobo > 0) {
            await this.applyAllocations(
              manager,
              account.schoolId,
              payment.id,
              [{ invoiceId: invoice.id, amount: applyKobo / MONEY_SCALE }],
              null,
            );
          }
        }

        // A non-permanent Raven account exists for one amount; once that much
        // has landed it has done its job, and the office should not read it
        // as still waiting.
        if (!account.isPermanent && Number(collection.amount) >= Number(account.amount)) {
          await this.payments.updateAccount(account.id, { status: 'PAID' }, manager);
        }

        return payment;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.payments.findByProviderReference('RAVEN', collection.session_id);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private assertWebhookSecret(provided: string): void {
    const expected = env.raven.webhookSecret;
    if (!expected) {
      throw AppError.internal('Raven webhooks are not configured on this server (RAVEN_WEBHOOK_SECRET).');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // Length-equal first: `timingSafeEqual` throws on mismatched lengths, and
    // the throw itself would be a timing signal.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw AppError.unauthenticated('Webhook secret does not match.');
    }
  }
}

/**
 * A reversed payment's receipt can still be *read* — the family holds a copy —
 * but handing out a fresh one, by email or WhatsApp, would be vouching for
 * money the school no longer counts.
 */
function assertReceiptIssuable(receipt: Pick<ReceiptDTO, 'status'>): void {
  if (receipt.status !== 'SUCCESSFUL') {
    throw AppError.conflict('This payment was reversed, so its receipt can no longer be sent.');
  }
}

/** Raven has put the id at the top level and under `data`; take whichever is there. */
function findSessionId(body: RavenWebhookBody): string | null {
  const direct = body.session_id;
  if (typeof direct === 'string' && direct) return direct;
  const nested = body.data?.session_id ?? (body.data?.data as Record<string, unknown> | undefined)?.session_id;
  return typeof nested === 'string' && nested ? nested : null;
}

/**
 * Raven records the sender as a JSON string. Whichever of the usual keys it
 * used, the person's name is the useful part; the rest stays in the payload.
 */
function payerNameFrom(source: string | null | undefined): string | null {
  if (!source) return null;
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    const name =
      parsed.account_name ?? parsed.sender_name ?? parsed.name ?? parsed.originator_name ?? null;
    return typeof name === 'string' && name.trim() ? name.trim().slice(0, 160) : null;
  } catch {
    return typeof source === 'string' ? source.slice(0, 160) : null;
  }
}

/** `PAY-20260912-3F9A2C` — datable at a glance, and short enough to read out. */
function paymentReference(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PAY-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * The code printed on a receipt for checking it later.
 *
 * Ten hex characters from a cryptographic source, not a counter: the whole
 * point is that a code cannot be guessed from one somebody was handed. Unique
 * globally, and the index says so — a collision at this width is vanishingly
 * unlikely, and the insert would fail loudly rather than mislabel a receipt.
 */
function verificationCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      ((error as { code?: string }).code === '23505' ||
        (error as { driverError?: { code?: string } }).driverError?.code === '23505'),
  );
}
