import { resolveSmsProvider } from '../../../shared/sms/router';
import { SmsProviderError } from '../../../shared/sms/types';
import { toInternationalDigits } from '../../../shared/utils/phone';
import type { SmsPurpose } from '../entities/smsMessage.entity';
import { SmsCreditRepository } from '../repositories/smsCredit.repository';
import { SmsMessageRepository } from '../repositories/smsMessage.repository';
import { smsPageCount } from './smsTemplate';

/** What a caller inside the server hands over when it wants someone texted. */
export interface SendSmsRequest {
  schoolId: string;
  purpose: SmsPurpose;
  /** As found on the record — any format `toInternationalDigits()` accepts. */
  to: string | null | undefined;
  body: string;
  /** Who the number belongs to, for the log. */
  recipientName?: string | null;
  studentId?: string | null;
  guardianId?: string | null;
  /**
   * Set this for anything a job might try twice — `student-birthday:<id>:<date>`
   * — and the second attempt is a no-op. Leave it unset only for a genuine
   * one-off, such as a test message.
   */
  dedupeKey?: string | null;
  triggeredByUserId?: string | null;
}

/**
 * Why a send failed, for callers that react differently: a run stops at
 * `NO_CREDIT` and tells the school, but carries on past a `BAD_NUMBER`.
 */
export type SendSmsFailure = 'NO_PROVIDER' | 'BAD_NUMBER' | 'NO_CREDIT' | 'PROVIDER';

export type SendSmsOutcome =
  | { status: 'SENT'; messageId: string; creditsLeft: number }
  | { status: 'DUPLICATE' }
  | { status: 'FAILED'; messageId: string | null; reason: string; failure: SendSmsFailure };

export const NO_CREDIT_MESSAGE = 'The school has no SMS credit left';

/**
 * What a school is told when the fault is the platform's — no provider set
 * up, a rejected API key, an unapproved sender ID, the gateway account out of
 * credit. None of that is theirs to fix, and naming it would only worry them;
 * the detail goes to the server log and the message's stored provider reply.
 */
export const SERVICE_UNAVAILABLE_MESSAGE = 'Text messaging is not available right now. The platform has been notified.';

/**
 * Sends one text message and writes down what happened.
 *
 * Never throws for a business reason: a missing number, an unconfigured
 * provider, an empty credit balance or a refusal from the gateway all come
 * back as a `FAILED` outcome with the log row already updated, so a caller
 * sending to a whole class can carry on and report at the end. Only a
 * programming error escapes.
 *
 * Credit is taken per SMS page, before the gateway is asked, and given back
 * if the gateway refuses — so the balance only ever pays for messages that
 * were accepted. A number that cannot be dialled costs nothing.
 *
 * Purpose-specific senders (`BirthdayGreetingsService`, and whatever follows)
 * build the text and pick the recipient; this is the one place that talks to
 * the provider, so the log is complete whoever sent the message.
 */
export class SmsService {
  static Instance = new SmsService();

  private constructor(
    private readonly messages = SmsMessageRepository.Instance,
    private readonly credits = SmsCreditRepository.Instance,
  ) {}

  /** Whether `send()` can do anything at all right now. */
  isConfigured(): boolean {
    return resolveSmsProvider() !== null;
  }

  /** The school's prepaid balance, in message pages. */
  async creditsFor(schoolId: string): Promise<number> {
    return this.credits.balance(schoolId);
  }

  async send(request: SendSmsRequest): Promise<SendSmsOutcome> {
    const provider = resolveSmsProvider();
    const phone = toInternationalDigits(request.to);

    const messageId = await this.messages.claim({
      schoolId: request.schoolId,
      purpose: request.purpose,
      // Keep whatever was on the record when it could not be normalised, so
      // the log shows what needs correcting.
      recipientPhone: phone ?? (request.to?.trim() || '').slice(0, 40),
      recipientName: request.recipientName ?? null,
      studentId: request.studentId ?? null,
      guardianId: request.guardianId ?? null,
      body: request.body,
      dedupeKey: request.dedupeKey ?? null,
      triggeredByUserId: request.triggeredByUserId ?? null,
    });
    if (!messageId) return { status: 'DUPLICATE' };

    const fail = async (failure: SendSmsFailure, reason: string, raw: unknown = null) => {
      await this.messages.markFailed(messageId, provider?.name ?? null, reason, raw);
      return { status: 'FAILED' as const, messageId, reason, failure };
    };

    if (!provider) {
      console.error(`[sms] ${request.purpose} for school ${request.schoolId} not sent: no SMS provider is configured (KUDISMS_API_KEY / KUDISMS_SENDER_ID).`);
      return fail('NO_PROVIDER', SERVICE_UNAVAILABLE_MESSAGE, { error: 'No SMS provider is configured on the server' });
    }
    if (!phone) {
      return fail(
        'BAD_NUMBER',
        request.to?.trim() ? `"${request.to.trim()}" is not a complete phone number` : 'No phone number on file',
      );
    }

    const pages = smsPageCount(request.body);
    const afterDebit = await this.credits.debit(request.schoolId, pages, messageId);
    if (afterDebit === null) return fail('NO_CREDIT', NO_CREDIT_MESSAGE);

    try {
      const result = await provider.send({ to: phone, text: request.body });
      await this.messages.markSent(messageId, provider.name, result.providerMessageId, result.raw);
      return { status: 'SENT', messageId, creditsLeft: afterDebit };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const aboutMessage = error instanceof SmsProviderError && error.aboutMessage;
      const raw = error instanceof SmsProviderError && error.raw !== null ? error.raw : { error: detail };
      console.error(`[sms] ${request.purpose} to ${phone} failed: ${detail}`);
      // The page was never used, so it is not paid for.
      await this.credits.refund(request.schoolId, pages, messageId, `Gateway refused: ${detail}`.slice(0, 500));
      return fail('PROVIDER', aboutMessage ? detail : SERVICE_UNAVAILABLE_MESSAGE, raw);
    }
  }

  /**
   * Which of these dedupe keys already went out. Lets a job report "already
   * greeted today" without attempting each insert only to have it refused.
   */
  async messagesAlreadySent(dedupeKeys: string[]): Promise<Set<string>> {
    return this.messages.sentKeys(dedupeKeys);
  }

  /** Remaining credit at the provider, or the reason it could not be read. */
  async balance(): Promise<{ balance: number | null; error: string | null }> {
    const provider = resolveSmsProvider();
    if (!provider) return { balance: null, error: 'No SMS provider is configured on the server' };
    try {
      return { balance: await provider.balance(), error: null };
    } catch (error) {
      return { balance: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
