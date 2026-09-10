import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AnalyticsService } from '../services/analytics.service';

const service = () => AnalyticsService.Instance;

export class AnalyticsController {
  static async fetchResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { termId } = req.validated!.query as { termId?: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchResultAnalytics(contextOf(req), termId)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchStaffPerformance(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async fetchRetention(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as { page: number; pageSize: number };
      res
        .status(200)
        .json(ApiResponse.paginated(await service().fetchRetentionRisk(contextOf(req), query)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchAttendanceSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { classId } = req.validated!.query as { classId?: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchAttendanceSummary(contextOf(req), { classId })));
    } catch (error) {
      next(error);
    }
  }

  static async fetchAttendanceTrend(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filter = req.validated!.query as { classId?: string; days: number };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchAttendanceTrend(contextOf(req), filter)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchFinanceOverview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchFinanceOverview(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async fetchAdmissionFunnel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.validated!.query as { sessionId?: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchAdmissionFunnel(contextOf(req), sessionId)));
    } catch (error) {
      next(error);
    }
  }
}
