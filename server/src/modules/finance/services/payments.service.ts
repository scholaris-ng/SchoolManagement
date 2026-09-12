import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { RavenClient, type RavenCollection } from './raven.client';
import { Payment } from '../entities/payment.entity';
import { PaymentAccount } from '../entities/paymentAccount.entity';
import type { PaymentAccountDTO, PaymentDTO } from '../dto/finance.dto';
import type {
  CreatePaymentAccountInput,
  FetchPaymentsQuery,
  RavenWebhookBody,
} from '../validators/payments.schema';

/** What a webhook call resolved to — returned to Raven as the body, and logged. */
export interface WebhookOutcome {
  handled: boolean;
  reason: string;
  paymentId?: string;
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
    private readonly students = StudentRepository.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly raven = RavenClient.Instance,
    private readonly audit = AuditService.Instance,
    private readonly notifications = NotificationsService.Instance,
  ) {}

  /* -- Reads ----------------------------------------------------------------- */

  async fetchPayments(context: RequestContext, query: FetchPaymentsQuery): Promise<Paginated<PaymentDTO>> {
    return this.payments.fetchPaginated(context.schoolId, query);
  }

  async fetchAccountsForStudent(context: RequestContext, studentId: string): Promise<PaymentAccountDTO[]> {
    return this.payments.fetchAccountsForStudent(context.schoolId, studentId);
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
      provider: 'RAVEN',
      accountNumber: generated.account_number,
      accountName: generated.account_name,
      bankName: generated.bank,
      amount: input.amount.toFixed(2),
      isPermanent: Boolean(generated.isPermanent),
      status: 'ACTIVE',
      note: input.note ? input.note : null,
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
   * The insert and the account's status change together, and a duplicate that
   * slipped past the earlier check — two deliveries a millisecond apart — is
   * caught by the unique index and resolved to the row that won.
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

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      ((error as { code?: string }).code === '23505' ||
        (error as { driverError?: { code?: string } }).driverError?.code === '23505'),
  );
}
