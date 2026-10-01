import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { PlatformSupportSettingsService } from '../services/platformSupportSettings.service';
import type { UpdateSupportSettingsInput } from '../validators/platform.schema';

const service = () => PlatformSupportSettingsService.Instance;

export class PlatformSupportSettingsController {
  /** Any signed-in user — the support widget needs this to build its wa.me link. */
  static async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().get()));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.subscriptionAdmin) throw AppError.unauthenticated();
      const { whatsappNumber } = req.validated!.body as UpdateSupportSettingsInput;
      const result = await service().update(whatsappNumber, req.subscriptionAdmin.email);
      res.status(200).json(ApiResponse.ok(result, 'WhatsApp number updated'));
    } catch (error) {
      next(error);
    }
  }
}
