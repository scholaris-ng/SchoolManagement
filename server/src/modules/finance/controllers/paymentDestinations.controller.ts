import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { PaymentDestinationsService } from '../services/paymentDestinations.service';
import type {
  CreatePaymentDestinationInput,
  MergePaymentDestinationsInput,
  UpdatePaymentDestinationInput,
} from '../validators/paymentDestinations.schema';

const service = () => PaymentDestinationsService.Instance;

export class PaymentDestinationsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchAll(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async fetchDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchDuplicates(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreatePaymentDestinationInput;
      res.status(201).json(ApiResponse.created(await service().create(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdatePaymentDestinationInput;
      res.status(200).json(ApiResponse.ok(await service().update(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await service().remove(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async merge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as MergePaymentDestinationsInput;
      await service().merge(contextOf(req), body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
