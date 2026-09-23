import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { DocumentDeliveriesService } from '../services/documentDeliveries.service';
import type {
  ConfirmAllDeliveriesQuery,
  DeliveryDocumentParams,
  FetchDeliveriesQuery,
  LogPrintDeliveryInput,
  RecordDeliveryInput,
} from '../validators/documentDeliveries.schema';

const service = () => DocumentDeliveriesService.Instance;

export class DocumentDeliveriesController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchDeliveriesQuery;
      const page = await service().fetchDeliveries(contextOf(req), query);
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchForDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentType, documentId } = req.validated!.params as DeliveryDocumentParams;
      const deliveries = await service().fetchForDocument(contextOf(req), documentType, documentId);
      res.status(200).json(ApiResponse.ok(deliveries));
    } catch (error) {
      next(error);
    }
  }

  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentType, documentId } = req.validated!.params as DeliveryDocumentParams;
      const body = req.validated!.body as RecordDeliveryInput;
      const delivery = await service().record(contextOf(req), documentType, documentId, body);
      res.status(201).json(ApiResponse.created(delivery, 'Delivery recorded'));
    } catch (error) {
      next(error);
    }
  }

  static async logPrint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentType, documentId } = req.validated!.params as DeliveryDocumentParams;
      const body = req.validated!.body as LogPrintDeliveryInput;
      const delivery = await service().logPrint(contextOf(req), documentType, documentId, body);
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

  static async confirmAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as ConfirmAllDeliveriesQuery;
      const result = await service().confirmAll(contextOf(req), query);
      res.status(200).json(ApiResponse.ok(result, 'Marked as delivered'));
    } catch (error) {
      next(error);
    }
  }
}
