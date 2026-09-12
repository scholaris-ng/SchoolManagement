import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AdmissionsService } from '../services/admissions.service';
import type {
  ConvertAdmissionInput,
  CreateAdmissionInput,
  FetchAdmissionsQuery,
  PublicApplicationInput,
  TransitionAdmissionInput,
} from '../validators/admissions.schema';

const service = () => AdmissionsService.Instance;

export class AdmissionsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchApplications(
        contextOf(req),
        req.validated!.query as FetchAdmissionsQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchApplication(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await service().createApplication(
        contextOf(req),
        req.validated!.body as CreateAdmissionInput,
      );
      res.status(201).json(ApiResponse.created(application, 'Application created'));
    } catch (error) {
      next(error);
    }
  }

  static async transition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const application = await service().transition(
        contextOf(req),
        id,
        req.validated!.body as TransitionAdmissionInput,
      );
      res.status(200).json(ApiResponse.ok(application, 'Application updated'));
    } catch (error) {
      next(error);
    }
  }

  static async convert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const result = await service().convert(
        contextOf(req),
        id,
        req.validated!.body as ConvertAdmissionInput,
      );
      res.status(201).json(ApiResponse.created(result, 'Applicant enrolled'));
    } catch (error) {
      next(error);
    }
  }

  /* -- Unauthenticated ------------------------------------------------------ */

  /** What the school's public application form offers as choices. */
  static async publicOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.validated!.params as { slug: string };
      res.status(200).json(ApiResponse.ok(await service().publicOptions(slug)));
    } catch (error) {
      next(error);
    }
  }

  static async publicSubmit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.validated!.params as { slug: string };
      const receipt = await service().submitPublicApplication(
        slug,
        req.validated!.body as PublicApplicationInput,
        {
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          requestId: req.requestId ?? 'public',
        },
      );
      res
        .status(201)
        .json(ApiResponse.created(receipt, 'Application received'));
    } catch (error) {
      next(error);
    }
  }
}
