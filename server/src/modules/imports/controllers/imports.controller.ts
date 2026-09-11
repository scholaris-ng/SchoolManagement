import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { ImportsService } from '../services/imports.service';
import type {
  CommitImportInput,
  FetchImportJobsQuery,
  ValidateImportInput,
} from '../validators/imports.schema';

const service = () => ImportsService.Instance;

export class ImportsController {
  /** The dry run. Nothing but the job record is written. */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as ValidateImportInput;
      res.status(200).json(ApiResponse.ok(await service().validate(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  /** Accepted, not finished — 202, and the client follows the job from here. */
  static async commit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CommitImportInput;
      res.status(202).json(ApiResponse.ok(await service().commit(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchJob(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = req.validated!.query as FetchImportJobsQuery;
      res
        .status(200)
        .json(ApiResponse.paginated(await service().fetchJobs(contextOf(req), page, pageSize)));
    } catch (error) {
      next(error);
    }
  }
}
