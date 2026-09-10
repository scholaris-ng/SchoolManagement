import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { NotificationsService } from '../services/notifications.service';
import type {
  FetchNotificationsQuery,
  RegisterPushTokenInput,
  UpdatePreferenceInput,
} from '../validators/notifications.schema';

const service = () => NotificationsService.Instance;

export class NotificationsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchAll(
        contextOf(req),
        req.validated!.query as FetchNotificationsQuery,
      );
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }

  static async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchUnreadCounts(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().markRead(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service().markAllRead(contextOf(req));
      res.status(200).json(ApiResponse.ok(result, 'All notifications marked as read'));
    } catch (error) {
      next(error);
    }
  }

  static async fetchPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchPreferences(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async updatePreference(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = await service().updatePreference(
        contextOf(req),
        req.validated!.body as UpdatePreferenceInput,
      );
      res.status(200).json(ApiResponse.ok(preferences, 'Notification preferences updated'));
    } catch (error) {
      next(error);
    }
  }

  static async registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service().registerPushToken(
        contextOf(req),
        req.validated!.body as RegisterPushTokenInput,
      );
      res.status(201).json(ApiResponse.created(result));
    } catch (error) {
      next(error);
    }
  }
}
