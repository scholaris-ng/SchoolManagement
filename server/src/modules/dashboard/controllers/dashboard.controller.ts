import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { DashboardService } from '../services/dashboard.service';

const service = () => DashboardService.Instance;

export class DashboardController {
  static async fetchAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchAdmin(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }
}
