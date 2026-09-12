import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { DiscountsService } from '../services/discounts.service';
import type { CreateDiscountInput, UpdateDiscountInput } from '../validators/discounts.schema';

const service = () => DiscountsService.Instance;

export class DiscountsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchAll(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreateDiscountInput;
      res.status(201).json(ApiResponse.created(await service().create(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdateDiscountInput;
      res.status(200).json(ApiResponse.ok(await service().update(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }
}
