import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { FeeStructuresService } from '../services/feeStructures.service';
import type {
  CreateFeeStructureInput,
  FetchFeeStructuresQuery,
  GenerateInvoicesInput,
  UpdateFeeStructureInput,
} from '../validators/feeStructures.schema';

const service = () => FeeStructuresService.Instance;

export class FeeStructuresController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchAll(
        contextOf(req),
        req.validated!.query as FetchFeeStructuresQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreateFeeStructureInput;
      res.status(201).json(ApiResponse.created(await service().create(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdateFeeStructureInput;
      res.status(200).json(ApiResponse.ok(await service().update(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  /** Bills the whole cohort. Safe to run twice — the second run skips everybody. */
  static async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as GenerateInvoicesInput;
      const result = await service().generateInvoices(contextOf(req), id, body);
      res
        .status(201)
        .json(
          ApiResponse.created(
            result,
            `${result.created} invoice${result.created === 1 ? '' : 's'} created`,
          ),
        );
    } catch (error) {
      next(error);
    }
  }
}
