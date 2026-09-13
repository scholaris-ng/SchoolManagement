import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { TimetableService } from '../services/timetable.service';
import type { SaveEntryInput } from '../validators/timetable.schema';

const service = () => TimetableService.Instance;

export class TimetableController {
  static async fetchCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as {
        classId?: string;
        teacherId?: string;
        subjectId?: string;
      };
      res.status(200).json(ApiResponse.ok(await service().fetchCurrent(contextOf(req), query)));
    } catch (error) {
      next(error);
    }
  }

  /** 200 for a move and 201 for a placement — the body says which it was. */
  static async saveEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { timetableId } = req.validated!.params as { timetableId: string };
      const input = req.validated!.body as SaveEntryInput;
      const entry = await service().saveEntry(contextOf(req), timetableId, input);
      res
        .status(input.entryId ? 200 : 201)
        .json(ApiResponse.ok(entry, input.entryId ? 'Lesson moved' : 'Lesson placed'));
    } catch (error) {
      next(error);
    }
  }

  static async removeEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { timetableId, entryId } = req.validated!.params as {
        timetableId: string;
        entryId: string;
      };
      await service().removeEntry(contextOf(req), timetableId, entryId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async clearEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { timetableId } = req.validated!.params as { timetableId: string };
      const result = await service().clearEntries(contextOf(req), timetableId);
      res.status(200).json(ApiResponse.ok(result, 'Timetable cleared'));
    } catch (error) {
      next(error);
    }
  }
}
