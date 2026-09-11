import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { StaffService } from '../services/staff.service';
import type { CreateStaffInput, FetchStaffQuery, UpdateStaffInput } from '../validators/staff.schema';

const service = () => StaffService.Instance;

/** The version the client loaded, sent as `If-Match` (spec section 34). */
function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { member, temporaryPassword } = await service().createStaff(
        contextOf(req),
        req.validated!.body as CreateStaffInput,
      );
      // Returned once, alongside the record it belongs to — nothing on the
      // server keeps it, and no later read of this staff member carries it.
      res
        .status(201)
        .json(ApiResponse.created({ ...member, temporaryPassword }, 'Staff member added'));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const member = await service().updateStaff(
        contextOf(req),
        id,
        req.validated!.body as UpdateStaffInput,
        readIfMatch(req),
      );
      res.status(200).json(ApiResponse.ok(member, 'Staff record updated'));
    } catch (error) {
      next(error);
    }
  }
}
