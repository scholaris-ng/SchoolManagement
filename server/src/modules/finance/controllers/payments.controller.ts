import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { PaymentsService } from '../services/payments.service';
import type {
  CreatePaymentAccountInput,
  FetchPaymentsQuery,
  RavenWebhookBody,
} from '../validators/payments.schema';

const service = () => PaymentsService.Instance;

export class PaymentsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchPayments(
        contextOf(req),
        req.validated!.query as FetchPaymentsQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await service().createCollectionAccount(
        contextOf(req),
        req.validated!.body as CreatePaymentAccountInput,
      );
      res.status(201).json(ApiResponse.created(account, 'Payment account ready'));
    } catch (error) {
      next(error);
    }
  }

  static async accountsForStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchAccountsForStudent(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  /* -- Unauthenticated ------------------------------------------------------ */

  /**
   * Raven calling us. Answers 200 whether or not the event turned into a
   * payment — see `handleRavenWebhook` for why "ignored" is a success here —
   * and a plain body Raven's dashboard shows next to the delivery.
   */
  static async ravenWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const outcome = await service().handleRavenWebhook(req.validated!.body as RavenWebhookBody, {
        ipAddress: req.ip ?? null,
        requestId: req.requestId ?? 'webhook',
      });
      res.status(200).json(ApiResponse.ok(outcome, outcome.reason));
    } catch (error) {
      next(error);
    }
  }
}
