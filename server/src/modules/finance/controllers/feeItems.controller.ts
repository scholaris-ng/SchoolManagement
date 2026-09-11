import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { FeeItemsService } from '../services/feeItems.service';
import type {
  CreateFeeItemInput,
  FetchFeeItemsQuery,
  UpdateFeeItemInput,
} from '../validators/feeItems.schema';

const service = () => FeeItemsService.Instance;

export class FeeItemsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = req.validated!.query as FetchFeeItemsQuery;
      res
        .status(200)
        .json(ApiResponse.paginated(await service().fetchAll(contextOf(req), page, pageSize)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreateFeeItemInput;
      res.status(201).json(ApiResponse.created(await service().create(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdateFeeItemInput;
      res.status(200).json(ApiResponse.ok(await service().update(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }
}
