import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { ReceiptDeliveriesService } from '../services/receiptDeliveries.service';
import type {
  LogReceiptDeliveryInput,
  RecordReceiptDeliveryInput,
} from '../validators/receiptDeliveries.schema';

const service = () => ReceiptDeliveriesService.Instance;

export class ReceiptDeliveriesController {
  static async fetchForPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const deliveries = await service().fetchForPayment(contextOf(req), paymentId);
      res.status(200).json(ApiResponse.ok(deliveries));
    } catch (error) {
      next(error);
    }
  }

  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const body = req.validated!.body as RecordReceiptDeliveryInput;
      const delivery = await service().record(contextOf(req), paymentId, body);
      res.status(201).json(ApiResponse.created(delivery, 'Delivery recorded'));
    } catch (error) {
      next(error);
    }
  }

  static async logPrint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.validated!.params as { paymentId: string };
      const body = req.validated!.body as LogReceiptDeliveryInput;
      const delivery = await service().logPrint(contextOf(req), paymentId, body);
      res.status(201).json(ApiResponse.created(delivery, 'Print recorded'));
    } catch (error) {
      next(error);
    }
  }

  static async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deliveryId } = req.validated!.params as { deliveryId: string };
      const delivery = await service().confirm(contextOf(req), deliveryId);
      res.status(200).json(ApiResponse.ok(delivery, 'Marked as delivered'));
    } catch (error) {
      next(error);
    }
  }
}
