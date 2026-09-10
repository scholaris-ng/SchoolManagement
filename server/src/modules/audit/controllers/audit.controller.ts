import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AuditService } from '../services/audit.service';
import type { FetchAuditQuery } from '../validators/audit.schema';

export class AuditController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchAuditQuery;
      const page = await AuditService.Instance.fetch(contextOf(req), query);
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }
}
