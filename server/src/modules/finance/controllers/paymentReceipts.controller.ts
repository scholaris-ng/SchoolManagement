import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { PaymentReceiptsService } from '../services/paymentReceipts.service';
import type {
  ApprovePaymentReceiptInput,
  FetchPaymentReceiptsQuery,
  RejectPaymentReceiptInput,
  SubmitPaymentReceiptInput,
} from '../validators/paymentReceipts.schema';

const service = () => PaymentReceiptsService.Instance;

export class PaymentReceiptsController {
  static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.validation('Attach a photo or PDF of the payment slip.');
      const receipt = await service().submitReceipt(
        contextOf(req),
        req.validated!.body as SubmitPaymentReceiptInput,
        req.file,
      );
      res.status(201).json(ApiResponse.created(receipt, 'Payment receipt submitted for review'));
    } catch (error) {
      next(error);
    }
  }

  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchReceipts(
        contextOf(req),
        req.validated!.query as FetchPaymentReceiptsQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchForStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchReceiptsForStudent(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const { note } = req.validated!.body as ApprovePaymentReceiptInput;
      const receipt = await service().approveReceipt(contextOf(req), id, note || undefined);
      res.status(200).json(ApiResponse.ok(receipt, 'Payment receipt approved'));
    } catch (error) {
      next(error);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const { note } = req.validated!.body as RejectPaymentReceiptInput;
      const receipt = await service().rejectReceipt(contextOf(req), id, note);
      res.status(200).json(ApiResponse.ok(receipt, 'Payment receipt declined'));
    } catch (error) {
      next(error);
    }
  }
}
