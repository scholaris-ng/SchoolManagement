import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { GuardiansService } from '../services/guardians.service';
import type {
  CreateGuardianInput,
  FetchGuardiansQuery,
  LinkGuardianInput,
  UpdateGuardianInput,
} from '../validators/guardians.schema';

const service = () => GuardiansService.Instance;

function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class GuardiansController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchGuardians(
        contextOf(req),
        req.validated!.query as FetchGuardiansQuery,
      );
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchGuardian(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async fetchChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchChildren(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guardian = await service().createGuardian(
        contextOf(req),
        req.validated!.body as CreateGuardianInput,
      );
      res.status(201).json(ApiResponse.created(guardian, 'Guardian added'));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const guardian = await service().updateGuardian(
        contextOf(req),
        id,
        req.validated!.body as UpdateGuardianInput,
        readIfMatch(req),
      );
      res.status(200).json(ApiResponse.ok(guardian, 'Guardian updated'));
    } catch (error) {
      next(error);
    }
  }

  static async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { guardianId } = req.validated!.params as { guardianId: string };
      const result = await service().invite(contextOf(req), guardianId);
      res.status(200).json(ApiResponse.ok(result, 'Invitation sent'));
    } catch (error) {
      next(error);
    }
  }

  // ─── Linked from a student ────────────────────────────────────────────────

  static async fetchForStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchStudentGuardians(contextOf(req), studentId)));
    } catch (error) {
      next(error);
    }
  }

  static async link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      const link = await service().linkGuardian(
        contextOf(req),
        studentId,
        req.validated!.body as LinkGuardianInput,
      );
      res.status(201).json(ApiResponse.created(link, 'Guardian linked'));
    } catch (error) {
      next(error);
    }
  }

  static async unlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, linkId } = req.validated!.params as {
        studentId: string;
        linkId: string;
      };
      await service().unlinkGuardian(contextOf(req), studentId, linkId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
