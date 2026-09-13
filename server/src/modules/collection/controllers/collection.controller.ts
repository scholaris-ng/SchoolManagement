import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { CollectionService } from '../services/collection.service';
import type {
  CreatePickupPersonInput,
  FetchCollectionEventsQuery,
  ReleaseChildInput,
  UpdatePickupPersonInput,
} from '../validators/collection.schema';

const service = () => CollectionService.Instance;

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

export class CollectionController {
  static studentPickup = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    res.status(200).json(ApiResponse.ok(await service().fetchForStudent(contextOf(req), studentId)));
  });

  static addPerson = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    const created = await service().addPerson(
      contextOf(req),
      studentId,
      req.validated!.body as CreatePickupPersonInput,
    );
    res.status(201).json(ApiResponse.ok(created, 'Pickup person added'));
  });

  static updatePerson = handle(async (req, res) => {
    const { studentId, id } = req.validated!.params as { studentId: string; id: string };
    const updated = await service().updatePerson(
      contextOf(req),
      studentId,
      id,
      req.validated!.body as UpdatePickupPersonInput,
    );
    res.status(200).json(ApiResponse.ok(updated, 'Pickup person updated'));
  });

  static events = handle(async (req, res) => {
    const page = await service().fetchEvents(contextOf(req), req.validated!.query as FetchCollectionEventsQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static release = handle(async (req, res) => {
    const created = await service().releaseChild(contextOf(req), req.validated!.body as ReleaseChildInput);
    res.status(201).json(ApiResponse.ok(created, 'Collection recorded'));
  });
}
