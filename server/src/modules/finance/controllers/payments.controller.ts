import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { PaymentsService } from '../services/payments.service';
import type {
  CreatePaymentAccountInput,
  FetchPaymentsQuery,
  MarkReceiptItemsInput,
  SetReceiptItemAmountsInput,
  RavenWebhookBody,
  ReconcilePaymentInput,
  RecordPaymentInput,
  ReversePaymentInput,
  SendReceiptEmailInput,
  ShareReceiptWhatsAppInput,
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

  /** Cash, transfer, POS or cheque taken at the desk. Never an online credit. */
  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as RecordPaymentInput;
      const payment = await service().recordManualPayment(contextOf(req), body);
      res.status(201).json(ApiResponse.created(payment, `Payment ${payment.reference} recorded`));
    } catch (error) {
      next(error);
    }
  }

  static async reconcile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const { note } = req.validated!.body as ReconcilePaymentInput;
      res
        .status(200)
        .json(ApiResponse.ok(await service().reconcilePayment(contextOf(req), id, note || undefined)));
    } catch (error) {
      next(error);
    }
  }

  /** Undoes a desk payment that was recorded wrongly. The correction is a new payment. */
  static async reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const { reason } = req.validated!.body as ReversePaymentInput;
      const payment = await service().reversePayment(contextOf(req), id, reason);
      res.status(200).json(ApiResponse.ok(payment, `Payment ${payment.reference} reversed`));
    } catch (error) {
      next(error);
    }
  }

  static async receipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      res.status(200).json(ApiResponse.ok(await service().fetchReceipt(contextOf(req), paymentId)));
    } catch (error) {
      next(error);
    }
  }

  static async markReceiptItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const { invoiceId, lineIds } = req.validated!.body as MarkReceiptItemsInput;
      const receipt = await service().markReceiptItems(contextOf(req), paymentId, invoiceId, lineIds);
      res.status(200).json(ApiResponse.ok(receipt, 'Fee items updated'));
    } catch (error) {
      next(error);
    }
  }

  static async setReceiptItemAmounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const { invoiceId, lines } = req.validated!.body as SetReceiptItemAmountsInput;
      const receipt = await service().setReceiptItemAmounts(contextOf(req), paymentId, invoiceId, lines);
      res.status(200).json(ApiResponse.ok(receipt, 'Fee item amounts updated'));
    } catch (error) {
      next(error);
    }
  }

  static async sendReceiptEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const body = req.validated!.body as SendReceiptEmailInput;
      res.status(200).json(ApiResponse.ok(await service().emailReceipt(contextOf(req), paymentId, body)));
    } catch (error) {
      next(error);
    }
  }

  static async shareReceiptWhatsApp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const body = req.validated!.body as ShareReceiptWhatsAppInput;
      res
        .status(200)
        .json(ApiResponse.ok(await service().shareReceiptOnWhatsApp(contextOf(req), paymentId, body)));
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
