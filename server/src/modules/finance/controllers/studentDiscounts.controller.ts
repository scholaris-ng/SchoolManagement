import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { StudentDiscountsService } from '../services/studentDiscounts.service';
import type { GrantStudentDiscountInput } from '../validators/studentDiscounts.schema';

const service = () => StudentDiscountsService.Instance;

export class StudentDiscountsController {
  static async fetchForStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchForStudent(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async grant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as GrantStudentDiscountInput;
      res.status(201).json(ApiResponse.created(await service().grant(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  static async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, grantId } = req.validated!.params as { id: string; grantId: string };
      await service().revoke(contextOf(req), id, grantId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
