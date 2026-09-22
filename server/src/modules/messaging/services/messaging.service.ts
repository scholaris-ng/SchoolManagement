import { AppError } from '../../../shared/errors/AppError';
import { env } from '../../../config/env';
import { describeSmsProvider } from '../../../shared/sms/router';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AuditService } from '../../audit/services/audit.service';
import type { SmsMessageDTO, SmsStatusDTO } from '../dto/messaging.dto';
import { SmsMessageRepository } from '../repositories/smsMessage.repository';
import type { FetchSmsLogQuery, SendTestSmsInput } from '../validators/messaging.schema';
import { SERVICE_UNAVAILABLE_MESSAGE, SmsService } from './sms.service';

/**
 * The HTTP-facing side of outbound messaging: the delivery log, the
 * provider's status, and a test send. The senders themselves —
 * `BirthdayGreetingsService` and whatever follows — are separate classes so
 * each kind of message owns its own recipient and wording rules.
 */
export class MessagingService {
  static Instance = new MessagingService();

  private constructor(
    private readonly sms = SmsService.Instance,
    private readonly messages = SmsMessageRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchLog(context: RequestContext, query: FetchSmsLogQuery): Promise<Paginated<SmsMessageDTO>> {
    return this.messages.fetchPaginated(context.schoolId, query);
  }

  /**
   * Whether texts can be sent, as whom, and the school's own credit — for the
   * settings screen. Nothing about *why* not, and nothing about the platform's
   * gateway account: those are the platform administrator's, on their own screen.
   */
  async status(context: RequestContext): Promise<SmsStatusDTO> {
    const provider = describeSmsProvider();
    const credits = await this.sms.creditsFor(context.schoolId);
    return {
      configured: provider.configured,
      provider: provider.provider,
      senderId: provider.senderId,
      credits,
      unitPriceNgn: env.sms.unitPriceNgn,
      topUpContact: env.subscription.contactEmail,
    };
  }

  async sendTest(context: RequestContext, input: SendTestSmsInput): Promise<SmsMessageDTO | null> {
    if (!this.sms.isConfigured()) {
      throw AppError.badRequest(SERVICE_UNAVAILABLE_MESSAGE);
    }

    const outcome = await this.sms.send({
      schoolId: context.schoolId,
      purpose: 'TEST',
      to: input.to,
      body: input.message,
      recipientName: context.user.displayName,
      triggeredByUserId: context.user.id,
    });

    // A test carries no dedupe key, so it can never come back as a duplicate.
    const messageId = outcome.status === 'DUPLICATE' ? null : outcome.messageId;

    await this.audit.record(context, {
      action: 'sms.test_sent',
      entityType: 'SmsMessage',
      entityId: messageId ?? '',
      entityLabel: input.to,
      after: { outcome },
    });

    if (outcome.status === 'FAILED') throw AppError.badRequest(`The message was not sent: ${outcome.reason}`);
    return messageId ? this.messages.findOneDTO(context.schoolId, messageId) : null;
  }
}
