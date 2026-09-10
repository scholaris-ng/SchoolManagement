import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AcademicsStructureService } from '../services/academicsStructure.service';
import { AcademicsClassService } from '../services/academicsClass.service';
import type {
  CreateClassInput,
  CreateLevelInput,
  CreateSessionInput,
  CreateTermInput,
  FetchClassesQuery,
  UpdateClassInput,
  UpdateLevelInput,
  UpdateSessionInput,
  UpdateTermInput,
} from '../validators/academics.schema';

const structure = () => AcademicsStructureService.Instance;
const classes = () => AcademicsClassService.Instance;

/**
 * Reference data for the year's shape.
 *
 * These lists are returned whole rather than paginated: a school has a handful
 * of sessions, a dozen levels and a few dozen classes, and every one of them
 * feeds a picker that needs the complete set. The paginated envelope is used
 * where collections genuinely grow without bound (spec section 35).
 */
export class AcademicsStructureController {
  static async sessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await structure().fetchSessions(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await structure().createSession(
        contextOf(req),
        req.validated!.body as CreateSessionInput,
      );
      res.status(201).json(ApiResponse.created(session, 'Academic session created'));
    } catch (error) {
      next(error);
    }
  }

  static async updateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const session = await structure().updateSession(
        contextOf(req),
        id,
        req.validated!.body as UpdateSessionInput,
      );
      res.status(200).json(ApiResponse.ok(session, 'Academic session updated'));
    } catch (error) {
      next(error);
    }
  }

  static async removeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await structure().removeSession(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async terms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.validated!.query as { sessionId?: string };
      res
        .status(200)
        .json(ApiResponse.ok(await structure().fetchTerms(contextOf(req), sessionId)));
    } catch (error) {
      next(error);
    }
  }

  static async createTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const term = await structure().createTerm(
        contextOf(req),
        req.validated!.body as CreateTermInput,
      );
      res.status(201).json(ApiResponse.created(term, 'Term added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const term = await structure().updateTerm(
        contextOf(req),
        id,
        req.validated!.body as UpdateTermInput,
      );
      res.status(200).json(ApiResponse.ok(term, 'Term updated'));
    } catch (error) {
      next(error);
    }
  }

  static async setCurrentTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const term = await structure().setCurrentTerm(contextOf(req), id);
      res.status(200).json(ApiResponse.ok(term, 'Current term updated'));
    } catch (error) {
      next(error);
    }
  }

  static async levels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await structure().fetchLevels(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async createLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const level = await structure().createLevel(
        contextOf(req),
        req.validated!.body as CreateLevelInput,
      );
      res.status(201).json(ApiResponse.created(level, 'Level added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const level = await structure().updateLevel(
        contextOf(req),
        id,
        req.validated!.body as UpdateLevelInput,
      );
      res.status(200).json(ApiResponse.ok(level, 'Level updated'));
    } catch (error) {
      next(error);
    }
  }

  static async removeLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await structure().removeLevel(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async classes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchClassesQuery;
      res
        .status(200)
        .json(ApiResponse.ok(await classes().fetchClasses(contextOf(req), query)));
    } catch (error) {
      next(error);
    }
  }

  static async schoolClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await classes().fetchClass(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async createClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await classes().createClass(
        contextOf(req),
        req.validated!.body as CreateClassInput,
      );
      res.status(201).json(ApiResponse.created(created, 'Class added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const updated = await classes().updateClass(
        contextOf(req),
        id,
        req.validated!.body as UpdateClassInput,
      );
      res.status(200).json(ApiResponse.ok(updated, 'Class updated'));
    } catch (error) {
      next(error);
    }
  }

  static async removeClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await classes().removeClass(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
