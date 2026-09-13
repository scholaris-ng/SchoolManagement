import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { CbtService } from '../services/cbt.service';
import type {
  CreateAssessmentInput,
  CreateQuestionInput,
  FetchAssessmentsQuery,
  FetchQuestionsQuery,
  FlushAnswersInput,
  SubmitAttemptInput,
  UpdateAssessmentInput,
  UpdateQuestionInput,
} from '../validators/cbt.schema';

const service = () => CbtService.Instance;

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

function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CbtController {
  static questions = handle(async (req, res) => {
    const page = await service().fetchQuestions(contextOf(req), req.validated!.query as FetchQuestionsQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static createQuestion = handle(async (req, res) => {
    const created = await service().createQuestion(contextOf(req), req.validated!.body as CreateQuestionInput);
    res.status(201).json(ApiResponse.ok(created, 'Question added'));
  });

  static updateQuestion = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateQuestion(contextOf(req), id, req.validated!.body as UpdateQuestionInput);
    res.status(200).json(ApiResponse.ok(updated, 'Question updated'));
  });

  static removeQuestion = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    await service().removeQuestion(contextOf(req), id);
    res.status(204).send();
  });

  static assessments = handle(async (req, res) => {
    const page = await service().fetchAssessments(contextOf(req), req.validated!.query as FetchAssessmentsQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static assessment = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    res.status(200).json(ApiResponse.ok(await service().fetchAssessment(contextOf(req), id)));
  });

  static createAssessment = handle(async (req, res) => {
    const created = await service().createAssessment(contextOf(req), req.validated!.body as CreateAssessmentInput);
    res.status(201).json(ApiResponse.ok(created, 'Paper created'));
  });

  static updateAssessment = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateAssessment(
      contextOf(req),
      id,
      req.validated!.body as UpdateAssessmentInput,
      readIfMatch(req),
    );
    res.status(200).json(ApiResponse.ok(updated, 'Paper saved'));
  });

  static startAttempt = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    res.status(201).json(ApiResponse.ok(await service().startAttempt(contextOf(req), id), 'Attempt started'));
  });

  static flushAnswers = handle(async (req, res) => {
    const { attemptId } = req.validated!.params as { attemptId: string };
    const result = await service().flushAnswers(contextOf(req), attemptId, req.validated!.body as FlushAnswersInput);
    res.status(200).json(ApiResponse.ok(result));
  });

  static submitAttempt = handle(async (req, res) => {
    const { attemptId } = req.validated!.params as { attemptId: string };
    const result = await service().submitAttempt(contextOf(req), attemptId, req.validated!.body as SubmitAttemptInput);
    res.status(200).json(ApiResponse.ok(result, 'Paper submitted'));
  });
}
