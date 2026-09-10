import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { StudentRelationsService } from '../services/studentRelations.service';
import type { AddDocumentInput } from '../validators/studentRelations.schema';
import type { PromoteStudentsInput } from '../validators/students.schema';

const service = () => StudentRelationsService.Instance;

export class StudentRelationsController {
  static async enrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchEnrollments(contextOf(req), studentId)));
    } catch (error) {
      next(error);
    }
  }

  static async documents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      res
        .status(200)
        .json(ApiResponse.ok(await service().fetchDocuments(contextOf(req), studentId)));
    } catch (error) {
      next(error);
    }
  }

  static async addDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      const document = await service().addDocument(
        contextOf(req),
        studentId,
        req.validated!.body as AddDocumentInput,
      );
      res.status(201).json(ApiResponse.created(document, 'Document added'));
    } catch (error) {
      next(error);
    }
  }

  static async removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, documentId } = req.validated!.params as {
        studentId: string;
        documentId: string;
      };
      await service().removeDocument(contextOf(req), studentId, documentId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async promote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service().promote(
        contextOf(req),
        req.validated!.body as PromoteStudentsInput,
      );
      res
        .status(200)
        .json(
          ApiResponse.ok(
            result,
            `${result.promoted} promoted, ${result.repeated} repeating, ${result.graduated} graduated`,
          ),
        );
    } catch (error) {
      next(error);
    }
  }
}
