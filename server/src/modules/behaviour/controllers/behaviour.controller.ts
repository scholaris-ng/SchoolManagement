import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { BehaviourService } from '../services/behaviour.service';
import type {
  AwardHousePointsInput,
  CreateTraitInput,
  FetchHousePointsQuery,
  FetchObservationsQuery,
  RecordObservationInput,
  UpdateTraitInput,
} from '../validators/behaviour.schema';

const service = () => BehaviourService.Instance;

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const handle =
  (run: (req: Request, res: Response) => Promise<void>): Handler =>
  async (req, res, next) => {
    try {
      await run(req, res);
    } catch (error) {
      next(error);
    }
  };

export class BehaviourController {
  static scales = handle(async (req, res) => {
    res.status(200).json(ApiResponse.ok(await service().fetchScales(contextOf(req))));
  });

  static traits = handle(async (req, res) => {
    res.status(200).json(ApiResponse.ok(await service().fetchTraits(contextOf(req))));
  });

  static createTrait = handle(async (req, res) => {
    const created = await service().createTrait(contextOf(req), req.validated!.body as CreateTraitInput);
    res.status(201).json(ApiResponse.ok(created, 'Trait added'));
  });

  static updateTrait = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateTrait(contextOf(req), id, req.validated!.body as UpdateTraitInput);
    res.status(200).json(ApiResponse.ok(updated, 'Trait updated'));
  });

  static observations = handle(async (req, res) => {
    const page = await service().fetchObservations(
      contextOf(req),
      req.validated!.query as FetchObservationsQuery,
    );
    res.status(200).json(ApiResponse.paginated(page));
  });

  static recordObservation = handle(async (req, res) => {
    const created = await service().recordObservation(
      contextOf(req),
      req.validated!.body as RecordObservationInput,
    );
    res.status(201).json(ApiResponse.ok(created, 'Observation recorded'));
  });

  static studentRatings = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    const { termId } = req.validated!.query as { termId?: string };
    res
      .status(200)
      .json(ApiResponse.ok(await service().fetchStudentTermRatings(contextOf(req), studentId, termId)));
  });

  static housePoints = handle(async (req, res) => {
    const page = await service().fetchHousePoints(
      contextOf(req),
      req.validated!.query as FetchHousePointsQuery,
    );
    res.status(200).json(ApiResponse.paginated(page));
  });

  static awardHousePoints = handle(async (req, res) => {
    const created = await service().awardHousePoints(
      contextOf(req),
      req.validated!.body as AwardHousePointsInput,
    );
    res.status(201).json(ApiResponse.ok(created, 'Points recorded'));
  });

  static leaderboard = handle(async (req, res) => {
    const { termId } = req.validated!.query as { termId?: string };
    res.status(200).json(ApiResponse.ok(await service().fetchLeaderboard(contextOf(req), termId)));
  });
}
