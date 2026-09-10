import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AcademicsResourcesService } from '../services/academicsResources.service';
import type {
  CreateHouseInput,
  CreatePeriodInput,
  CreateRoomInput,
  CreateSubjectInput,
  FetchSubjectsQuery,
  UpdateHouseInput,
  UpdatePeriodInput,
  UpdateRoomInput,
  UpdateSubjectInput,
} from '../validators/academics.schema';

const service = () => AcademicsResourcesService.Instance;

export class AcademicsResourcesController {
  static async subjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.validated!.query as FetchSubjectsQuery;
      res.status(200).json(ApiResponse.ok(await service().fetchSubjects(contextOf(req), query)));
    } catch (error) {
      next(error);
    }
  }

  static async createSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subject = await service().createSubject(
        contextOf(req),
        req.validated!.body as CreateSubjectInput,
      );
      res.status(201).json(ApiResponse.created(subject, 'Subject added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const subject = await service().updateSubject(
        contextOf(req),
        id,
        req.validated!.body as UpdateSubjectInput,
      );
      res.status(200).json(ApiResponse.ok(subject, 'Subject updated'));
    } catch (error) {
      next(error);
    }
  }

  static async removeSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await service().removeSubject(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async rooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchRooms(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await service().createRoom(
        contextOf(req),
        req.validated!.body as CreateRoomInput,
      );
      res.status(201).json(ApiResponse.created(room, 'Room added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const room = await service().updateRoom(
        contextOf(req),
        id,
        req.validated!.body as UpdateRoomInput,
      );
      res.status(200).json(ApiResponse.ok(room, 'Room updated'));
    } catch (error) {
      next(error);
    }
  }

  static async houses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchHouses(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async createHouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const house = await service().createHouse(
        contextOf(req),
        req.validated!.body as CreateHouseInput,
      );
      res.status(201).json(ApiResponse.created(house, 'House added'));
    } catch (error) {
      next(error);
    }
  }

  static async updateHouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const house = await service().updateHouse(
        contextOf(req),
        id,
        req.validated!.body as UpdateHouseInput,
      );
      res.status(200).json(ApiResponse.ok(house, 'House updated'));
    } catch (error) {
      next(error);
    }
  }

  static async periods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(ApiResponse.ok(await service().fetchPeriods(contextOf(req))));
    } catch (error) {
      next(error);
    }
  }

  static async createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = await service().createPeriod(
        contextOf(req),
        req.validated!.body as CreatePeriodInput,
      );
      res.status(201).json(ApiResponse.created(period, 'Period added'));
    } catch (error) {
      next(error);
    }
  }

  static async updatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const period = await service().updatePeriod(
        contextOf(req),
        id,
        req.validated!.body as UpdatePeriodInput,
      );
      res.status(200).json(ApiResponse.ok(period, 'Period updated'));
    } catch (error) {
      next(error);
    }
  }

  static async removePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      await service().removePeriod(contextOf(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
