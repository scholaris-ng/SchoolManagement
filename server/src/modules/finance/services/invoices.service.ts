import type { EntityManager } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { Invoice, type BroughtForwardSource } from '../entities/invoice.entity';
import type { FeeCategory } from '../entities/feeItem.entity';
import type {
  InvoiceDTO,
  StudentFinanceSummaryDTO,
  StudentLedgerResultDTO,
} from '../dto/finance.dto';
import type {
  CreateInvoiceInput,
  FetchDebtorsQuery,
  FetchInvoicesQuery,
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
  /** Where this charge is paid into, snapshotted from the fee item. */
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
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
    private readonly terms = TermRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
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
    return invoice;
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

    const lines: IssueLine[] = input.lines.map((line) => {
      const item = byId.get(line.feeItemId);
      if (!item) throw AppError.validation('One of those charges is not a fee item of this school.');

      const gross = Math.round(item.amount * line.quantity * MONEY_SCALE);
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
        unitAmount: item.amount,
        discountAmount: line.discountAmount,
        isOptional: item.isOptional,
        bankName: item.bankName,
        accountNumber: item.accountNumber,
        accountName: item.accountName,
      };
    });

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
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `invoice:student:${params.studentId}`,
    ]);

    let subtotalKobo = 0;
    let discountKobo = 0;
    for (const line of params.lines) {
      subtotalKobo += Math.round(line.unitAmount * line.quantity * MONEY_SCALE);
      discountKobo += Math.round(line.discountAmount * MONEY_SCALE);
    }

    const carried = await this.invoices.lockOpenEarlierInvoices(
      manager,
      params.schoolId,
      params.studentId,
      { sessionStartDate: params.sessionStartDate, termSequence: params.termSequence },
    );
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

    const invoice = await this.invoices.create(
      {
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
      manager,
    );

    await this.invoices.createLines(
      params.lines.map((line, index) => ({
        schoolId: params.schoolId,
        invoiceId: invoice.id,
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
        bankName: line.bankName,
        accountNumber: line.accountNumber,
        accountName: line.accountName,
      })),
      manager,
    );

    await this.invoices.closeCarriedForward(
      manager,
      absorbed.map((row) => row.id),
      { invoiceId: invoice.id, invoiceNo },
      params.createdByUserId,
    );

    return invoice;
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

  private async requireDTO(schoolId: string, id: string): Promise<InvoiceDTO> {
    const dto = await this.invoices.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
