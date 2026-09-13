import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { uploadObject, signedDownloadUrl } from '../../../infrastructure/firebase/firebaseStorage';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentReceiptRepository, type PaymentReceiptRow } from '../repositories/paymentReceipt.repository';
import { PaymentsService } from './payments.service';
import type { PaymentReceiptDTO } from '../dto/finance.dto';
import type {
  FetchPaymentReceiptsQuery,
  SubmitPaymentReceiptInput,
} from '../validators/paymentReceipts.schema';

/** What the multipart middleware hands the controller. */
export interface ReceiptFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * A family's own evidence of a payment made outside the system, and the
 * office's judgement on it (spec section 27).
 *
 * The only thing this service ever writes to the ledger is the *result* of an
 * approval — via `PaymentsService.recordApprovedReceipt` — never the claim
 * itself. A pending or rejected receipt is not a payment and must never be
 * mistaken for one, which is also why it is a separate table rather than a
 * new `Payment.status`: a status value here could accidentally be read by
 * code that sums payments and did not know to exclude it.
 */
export class PaymentReceiptsService {
  static Instance = new PaymentReceiptsService();

  private constructor(
    private readonly receipts = PaymentReceiptRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly invoices = InvoiceRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly payments = PaymentsService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly notifications = NotificationsService.Instance,
  ) {}

  /* -- The family's side ------------------------------------------------------ */

  async submitReceipt(
    context: RequestContext,
    input: SubmitPaymentReceiptInput,
    file: ReceiptFile,
  ): Promise<PaymentReceiptDTO> {
    if (!(await this.access.canSeeStudent(context, input.studentId))) {
      throw AppError.notFound('Student');
    }
    const student = await this.students.findOneDTO(context.schoolId, input.studentId);
    if (!student) throw AppError.notFound('Student');

    const invoiceId = input.invoiceId ? input.invoiceId : null;
    if (invoiceId) {
      const [invoice] = await this.invoices.findManyBrief(context.schoolId, [invoiceId]);
      if (!invoice) throw AppError.notFound('Invoice');
      if (invoice.studentId !== student.id) {
        throw AppError.validation('That invoice belongs to a different student.');
      }
      if (invoice.status === 'CANCELLED' || invoice.status === 'PAID') {
        throw AppError.validation('That invoice is already settled or cancelled.');
      }
    }

    const paidAt = new Date(input.paidAt);
    if (Number.isNaN(paidAt.getTime())) throw AppError.validation('That payment date is not valid.');

    const extension = EXTENSION_BY_MIME[file.mimetype] ?? 'bin';
    const storagePath = `schools/${context.schoolId}/payment-receipts/${student.id}/${randomUUID()}.${extension}`;
    await uploadObject(storagePath, file.buffer, file.mimetype);

    const created = await this.receipts.create({
      schoolId: context.schoolId,
      studentId: student.id,
      invoiceId,
      amount: input.amount.toFixed(2),
      method: input.method,
      paidAt,
      reference: input.reference ? input.reference : null,
      note: input.note ? input.note : null,
      storagePath,
      mimeType: file.mimetype,
      sizeBytes: String(file.size),
      status: 'PENDING',
      submittedByUserId: context.user.id,
      submittedByName: context.user.displayName,
    });

    await this.audit.record(context, {
      action: 'payment.receipt.submitted',
      entityType: 'PaymentReceipt',
      entityId: created.id,
      entityLabel: `${student.fullName} · ${input.amount}`,
      after: { amount: input.amount, method: input.method, invoiceId },
    });

    void this.notifications.notifySchoolAdmins(context.schoolId, {
      category: 'FEE',
      title: 'Payment receipt submitted',
      body: `${context.user.displayName} submitted a receipt for ₦${input.amount.toLocaleString('en-NG')} for ${student.fullName}.`,
      actionUrl: '/finance/payment-receipts',
      severity: 'INFO',
      entityType: 'PaymentReceipt',
      entityId: created.id,
    });

    const row = await this.receipts.findOneRow(context.schoolId, created.id);
    if (!row) throw AppError.internal();
    return toDTO(row);
  }

  async fetchReceiptsForStudent(
    context: RequestContext,
    studentId: string,
  ): Promise<PaymentReceiptDTO[]> {
    if (!(await this.access.canSeeStudent(context, studentId))) {
      throw AppError.notFound('Student');
    }
    const page = await this.receipts.fetchPaginated(context.schoolId, {
      page: 1,
      pageSize: 100,
      studentId,
    });
    return Promise.all(page.items.map(toDTO));
  }

  /* -- The office's side -------------------------------------------------------- */

  async fetchReceipts(
    context: RequestContext,
    query: FetchPaymentReceiptsQuery,
  ): Promise<Paginated<PaymentReceiptDTO>> {
    const page = await this.receipts.fetchPaginated(context.schoolId, query);
    const items = await Promise.all(page.items.map(toDTO));
    return { ...page, items };
  }

  /**
   * Approving turns the claim into a real, ledgered payment — the one and
   * only door between "a family says they paid" and "the school's books say
   * so" (spec section 27).
   */
  async approveReceipt(
    context: RequestContext,
    id: string,
    note: string | undefined,
  ): Promise<PaymentReceiptDTO> {
    const entity = await this.receipts.findEntity(context.schoolId, id);
    if (!entity) throw AppError.notFound('Payment receipt');
    if (entity.status !== 'PENDING') {
      throw AppError.conflict('This receipt has already been reviewed.');
    }

    const payment = await this.payments.recordApprovedReceipt(context, {
      studentId: entity.studentId,
      invoiceId: entity.invoiceId,
      amount: Number(entity.amount),
      method: entity.method,
      paidAt: entity.paidAt,
      reference: entity.reference,
      note: note ? note : `Approved from a receipt ${entity.submittedByName} submitted.`,
    });

    const applied = await this.receipts.markReviewed(
      context.schoolId,
      id,
      'APPROVED',
      { userId: context.user.id, name: context.user.displayName },
      note ? note : null,
      payment.id,
    );
    if (!applied) throw AppError.conflict('This receipt has already been reviewed.');

    await this.audit.record(context, {
      action: 'payment.receipt.approved',
      entityType: 'PaymentReceipt',
      entityId: id,
      entityLabel: `${entity.submittedByName} · ${entity.amount}`,
      after: { paymentId: payment.id },
    });

    if (entity.submittedByUserId) {
      void this.notifications.notifyUser(context.schoolId, entity.submittedByUserId, {
        category: 'FEE',
        title: 'Payment receipt approved',
        body: `Your payment of ₦${Number(entity.amount).toLocaleString('en-NG')} has been confirmed and recorded.`,
        actionUrl: '/family/finance',
        severity: 'SUCCESS',
        entityType: 'Payment',
        entityId: payment.id,
      });
    }

    const row = await this.receipts.findOneRow(context.schoolId, id);
    if (!row) throw AppError.internal();
    return toDTO(row);
  }

  async rejectReceipt(context: RequestContext, id: string, note: string): Promise<PaymentReceiptDTO> {
    const entity = await this.receipts.findEntity(context.schoolId, id);
    if (!entity) throw AppError.notFound('Payment receipt');
    if (entity.status !== 'PENDING') {
      throw AppError.conflict('This receipt has already been reviewed.');
    }

    const applied = await this.receipts.markReviewed(
      context.schoolId,
      id,
      'REJECTED',
      { userId: context.user.id, name: context.user.displayName },
      note,
      null,
    );
    if (!applied) throw AppError.conflict('This receipt has already been reviewed.');

    await this.audit.record(context, {
      action: 'payment.receipt.rejected',
      entityType: 'PaymentReceipt',
      entityId: id,
      entityLabel: `${entity.submittedByName} · ${entity.amount}`,
      after: { reason: note },
    });

    if (entity.submittedByUserId) {
      void this.notifications.notifyUser(context.schoolId, entity.submittedByUserId, {
        category: 'FEE',
        title: 'Payment receipt declined',
        body: `Your payment receipt for ₦${Number(entity.amount).toLocaleString('en-NG')} was not accepted: ${note}`,
        actionUrl: '/family/finance',
        severity: 'WARNING',
        entityType: 'PaymentReceipt',
        entityId: id,
      });
    }

    const row = await this.receipts.findOneRow(context.schoolId, id);
    if (!row) throw AppError.internal();
    return toDTO(row);
  }
}

async function toDTO(row: PaymentReceiptRow): Promise<PaymentReceiptDTO> {
  const { storagePath, ...rest } = row;
  return { ...rest, fileUrl: await signedDownloadUrl(storagePath) };
}
