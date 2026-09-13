import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AttendanceService } from '../services/attendance.service';
import type {
  FetchRegisterQuery,
  FetchStudentAttendanceQuery,
  SaveRegisterInput,
} from '../validators/attendance.schema';

const service = () => AttendanceService.Instance;

export class AttendanceController {
  static async fetchRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const register = await service().fetchRegister(
        contextOf(req),
        req.validated!.query as FetchRegisterQuery,
      );
      res.status(200).json(ApiResponse.ok(register));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 200 rather than 201: a register is one document per class per day, and
   * saving it again corrects the marks instead of creating a second one.
   */
  static async saveRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service().saveRegister(
        contextOf(req),
        req.validated!.body as SaveRegisterInput,
      );
      res.status(200).json(ApiResponse.ok(result, 'Register saved'));
    } catch (error) {
      next(error);
    }
  }

  static async fetchForStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.validated!.params as { studentId: string };
      const history = await service().fetchStudentHistory(
        contextOf(req),
        studentId,
        req.validated!.query as FetchStudentAttendanceQuery,
      );
      res.status(200).json(ApiResponse.ok(history));
    } catch (error) {
      next(error);
    }
  }
}
