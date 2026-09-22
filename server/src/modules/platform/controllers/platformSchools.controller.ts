import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { PlatformSchoolsService } from '../services/platformSchools.service';
import type { ActivateSchoolInput, TopUpSmsCreditsInput } from '../validators/platform.schema';

const service = () => PlatformSchoolsService.Instance;

/** The administrator `subscriptionAdminMiddleware` admitted, or a clear failure if a route skipped it. */
function adminOf(req: Request) {
  if (!req.subscriptionAdmin) throw AppError.unauthenticated();
  return req.subscriptionAdmin;
}

export class PlatformSchoolsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      adminOf(req);
      res.status(200).json(ApiResponse.ok(await service().list()));
    } catch (error) {
      next(error);
    }
  }

  static async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = adminOf(req);
      const { id } = req.validated!.params as { id: string };
      const { months } = req.validated!.body as ActivateSchoolInput;
      const school = await service().activate(
        {
          email: admin.email,
          requestId: req.requestId,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent')?.slice(0, 400) ?? null,
        },
        id,
        months,
      );
      res.status(200).json(ApiResponse.ok(school));
    } catch (error) {
      next(error);
    }
  }

  static async smsStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      adminOf(req);
      res.status(200).json(ApiResponse.ok(await service().smsStatus()));
    } catch (error) {
      next(error);
    }
  }

  static async smsCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      adminOf(req);
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().smsCredits(id)));
    } catch (error) {
      next(error);
    }
  }

  static async topUpSmsCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = adminOf(req);
      const { id } = req.validated!.params as { id: string };
      const { amountNgn, note } = req.validated!.body as TopUpSmsCreditsInput;
      const credits = await service().topUpSmsCredits(
        {
          userId: admin.userId,
          email: admin.email,
          requestId: req.requestId,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent')?.slice(0, 400) ?? null,
        },
        id,
        amountNgn,
        note?.trim() || null,
      );
      res.status(200).json(ApiResponse.ok(credits, `${credits.unitsAdded.toLocaleString()} SMS added`));
    } catch (error) {
      next(error);
    }
  }
}
