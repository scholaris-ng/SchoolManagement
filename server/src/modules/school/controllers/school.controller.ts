import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { SchoolService } from '../services/school.service';
import { WebsiteService } from '../services/website.service';
import type { UpdateSchoolInput, UpdateWebsiteInput } from '../validators/school.schema';

export class SchoolController {
  static async current(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const school = await SchoolService.Instance.getCurrent(contextOf(req));
      res.status(200).json(ApiResponse.ok(school));
    } catch (error) {
      next(error);
    }
  }

  static async updateCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const school = await SchoolService.Instance.updateCurrent(
        contextOf(req),
        req.validated!.body as UpdateSchoolInput,
        readIfMatch(req),
      );
      res.status(200).json(ApiResponse.ok(school, 'School settings saved'));
    } catch (error) {
      next(error);
    }
  }

  static async website(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await WebsiteService.Instance.getForSchool(contextOf(req).schoolId);
      res.status(200).json(ApiResponse.ok(content));
    } catch (error) {
      next(error);
    }
  }

  static async updateWebsite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await WebsiteService.Instance.update(
        contextOf(req),
        req.validated!.body as UpdateWebsiteInput,
      );
      res.status(200).json(ApiResponse.ok(content, 'Website updated'));
    } catch (error) {
      next(error);
    }
  }

  /** Unauthenticated — the public prospectus page. */
  static async publicSchool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.validated!.params as { slug: string };
      const content = await WebsiteService.Instance.getPublicBySlug(slug);
      res.status(200).json(ApiResponse.ok(content));
    } catch (error) {
      next(error);
    }
  }
}

/**
 * The version the client loaded, sent as `If-Match`. Absent means "I did not
 * check" and the update proceeds; malformed is ignored the same way rather than
 * failing a save on a header the user never saw.
 */
function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
