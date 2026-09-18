import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { CustomBillsService } from '../services/customBills.service';
import type {
  CreateCustomBillInput,
  FetchCustomBillsQuery,
  UpdateCustomBillInput,
} from '../validators/customBills.schema';

const service = () => CustomBillsService.Instance;

export class CustomBillsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchCustomBillsQuery;
      res.status(200).json(ApiResponse.paginated(await service().fetchAll(contextOf(req), query)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchOne(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreateCustomBillInput;
      res.status(201).json(ApiResponse.created(await service().create(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdateCustomBillInput;
      res.status(200).json(ApiResponse.ok(await service().update(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  static async shareWhatsApp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().shareOnWhatsApp(contextOf(req), id)));
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
}
