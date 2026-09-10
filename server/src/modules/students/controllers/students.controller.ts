import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { StudentsService } from '../services/students.service';
import type {
  ChangeStatusInput,
  CreateStudentInput,
  FetchStudentsQuery,
  SearchStudentsQuery,
  UpdateStudentInput,
} from '../validators/students.schema';

const service = () => StudentsService.Instance;

/** The version the client loaded, sent as `If-Match` (spec section 34). */
function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class StudentsController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchStudents(
        contextOf(req),
        req.validated!.query as FetchStudentsQuery,
      );
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }

  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().search(
        contextOf(req),
        req.validated!.query as SearchStudentsQuery,
      );
      res.status(200).json(ApiResponse.ok(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchStudent(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await service().createStudent(
        contextOf(req),
        req.validated!.body as CreateStudentInput,
      );
      res.status(201).json(ApiResponse.created(student, 'Student added'));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const student = await service().updateStudent(
        contextOf(req),
        id,
        req.validated!.body as UpdateStudentInput,
        readIfMatch(req),
      );
      res.status(200).json(ApiResponse.ok(student, 'Student updated'));
    } catch (error) {
      next(error);
    }
  }

  static async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const student = await service().changeStatus(
        contextOf(req),
        id,
        req.validated!.body as ChangeStatusInput,
      );
      res.status(200).json(ApiResponse.ok(student, 'Student status updated'));
    } catch (error) {
      next(error);
    }
  }
}
