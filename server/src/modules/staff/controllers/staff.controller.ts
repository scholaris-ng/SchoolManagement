import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { StaffService } from '../services/staff.service';
import type { FetchStaffQuery } from '../validators/staff.schema';

const service = () => StaffService.Instance;

export class StaffController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchStaffQuery;
      res
        .status(200)
        .json(ApiResponse.paginated(await service().fetchAll(contextOf(req), query)));
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
}
