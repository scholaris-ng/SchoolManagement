import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { MessagingService } from '../services/messaging.service';
import { BirthdayGreetingsService } from '../services/birthdayGreetings.service';
import type { FetchSmsLogQuery, SendTestSmsInput } from '../validators/messaging.schema';

const service = () => MessagingService.Instance;

export class MessagingController {
  static async fetchSmsLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchLog(contextOf(req), req.validated!.query as FetchSmsLogQuery);
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }

  static async smsStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().status(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async sendTestSms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const message = await service().sendTest(contextOf(req), req.validated!.body as SendTestSmsInput);
      res.status(200).json(ApiResponse.ok(message, 'Test message sent'));
    } catch (error) {
      next(error);
    }
  }

  static async runBirthdayGreetings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await BirthdayGreetingsService.Instance.runNow(contextOf(req));
      const note =
        summary.skippedReason === 'SMS_NOT_CONFIGURED'
          ? 'Text messaging is not available right now, so nothing was sent'
          : summary.skippedReason === 'NO_CREDIT'
            ? `${summary.celebrants} pupil(s) have a birthday today but the school has no SMS credit left`
            : summary.celebrants === 0
              ? 'No pupil has a birthday today'
              : `${summary.sent} sent, ${summary.alreadySent} already sent, ${summary.failed + summary.noRecipient + summary.noCredit} not sent`;
      res.status(200).json(ApiResponse.ok(summary, note));
    } catch (error) {
      next(error);
    }
  }
}
