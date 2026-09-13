import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { CurriculumService } from '../services/curriculum.service';
import type {
  CreateCurriculumInput,
  CreateObjectiveInput,
  CreateTopicInput,
  FetchCoverageQuery,
  FetchCurriculaQuery,
  MarkCoverageInput,
  UpdateCurriculumInput,
  UpdateObjectiveInput,
  UpdateTopicInput,
} from '../validators/curriculum.schema';

const service = () => CurriculumService.Instance;

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/** Every handler here is the same try/catch around one service call. */
const handle =
  (run: (req: Request, res: Response) => Promise<void>): Handler =>
  async (req, res, next) => {
    try {
      await run(req, res);
    } catch (error) {
      next(error);
    }
  };

const params = <T>(req: Request) => req.validated!.params as T;
const body = <T>(req: Request) => req.validated!.body as T;

export class CurriculumController {
  static fetchAll = handle(async (req, res) => {
    const list = await service().fetchCurricula(
      contextOf(req),
      req.validated!.query as FetchCurriculaQuery,
    );
    res.status(200).json(ApiResponse.ok(list));
  });

  static create = handle(async (req, res) => {
    const created = await service().createCurriculum(contextOf(req), body<CreateCurriculumInput>(req));
    res.status(201).json(ApiResponse.ok(created, 'Curriculum created'));
  });

  static update = handle(async (req, res) => {
    const { id } = params<{ id: string }>(req);
    const updated = await service().updateCurriculum(contextOf(req), id, body<UpdateCurriculumInput>(req));
    res.status(200).json(ApiResponse.ok(updated, 'Curriculum updated'));
  });

  static remove = handle(async (req, res) => {
    const { id } = params<{ id: string }>(req);
    await service().removeCurriculum(contextOf(req), id);
    res.status(204).send();
  });

  /* -- Topics ---------------------------------------------------------------- */

  static topics = handle(async (req, res) => {
    const { curriculumId } = params<{ curriculumId: string }>(req);
    res.status(200).json(ApiResponse.ok(await service().fetchTopics(contextOf(req), curriculumId)));
  });

  static createTopic = handle(async (req, res) => {
    const { curriculumId } = params<{ curriculumId: string }>(req);
    const created = await service().createTopic(contextOf(req), curriculumId, body<CreateTopicInput>(req));
    res.status(201).json(ApiResponse.ok(created, 'Topic added'));
  });

  static updateTopic = handle(async (req, res) => {
    const { curriculumId, topicId } = params<{ curriculumId: string; topicId: string }>(req);
    const updated = await service().updateTopic(
      contextOf(req),
      curriculumId,
      topicId,
      body<UpdateTopicInput>(req),
    );
    res.status(200).json(ApiResponse.ok(updated, 'Topic updated'));
  });

  static removeTopic = handle(async (req, res) => {
    const { curriculumId, topicId } = params<{ curriculumId: string; topicId: string }>(req);
    await service().removeTopic(contextOf(req), curriculumId, topicId);
    res.status(204).send();
  });

  /* -- Objectives ------------------------------------------------------------ */

  static createObjective = handle(async (req, res) => {
    const { curriculumId, topicId } = params<{ curriculumId: string; topicId: string }>(req);
    const created = await service().createObjective(
      contextOf(req),
      curriculumId,
      topicId,
      body<CreateObjectiveInput>(req),
    );
    res.status(201).json(ApiResponse.ok(created, 'Objective added'));
  });

  static updateObjective = handle(async (req, res) => {
    const { curriculumId, topicId, objectiveId } = params<{
      curriculumId: string;
      topicId: string;
      objectiveId: string;
    }>(req);
    const updated = await service().updateObjective(
      contextOf(req),
      curriculumId,
      topicId,
      objectiveId,
      body<UpdateObjectiveInput>(req),
    );
    res.status(200).json(ApiResponse.ok(updated, 'Objective updated'));
  });

  static removeObjective = handle(async (req, res) => {
    const { curriculumId, topicId, objectiveId } = params<{
      curriculumId: string;
      topicId: string;
      objectiveId: string;
    }>(req);
    await service().removeObjective(contextOf(req), curriculumId, topicId, objectiveId);
    res.status(204).send();
  });

  /* -- Coverage -------------------------------------------------------------- */

  static coverage = handle(async (req, res) => {
    const report = await service().fetchCoverage(
      contextOf(req),
      req.validated!.query as FetchCoverageQuery,
    );
    res.status(200).json(ApiResponse.ok(report));
  });

  static markCoverage = handle(async (req, res) => {
    const { curriculumId } = params<{ curriculumId: string }>(req);
    const result = await service().markCoverage(contextOf(req), curriculumId, body<MarkCoverageInput>(req));
    res.status(200).json(ApiResponse.ok(result, 'Coverage updated'));
  });
}
