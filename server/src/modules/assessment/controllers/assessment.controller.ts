import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { AssessmentService } from '../services/assessment.service';
import type {
  CreateCommentTemplateInput,
  CreateGradingSchemeInput,
  FetchScoreSheetsQuery,
  SaveReportCardCommentsInput,
  SaveScoresInput,
  TransitionScoreSheetInput,
  UpdateGradingSchemeInput,
} from '../validators/assessment.schema';

const service = () => AssessmentService.Instance;

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

export class AssessmentController {
  static gradingSchemes = handle(async (req, res) => {
    res.status(200).json(ApiResponse.ok(await service().fetchGradingSchemes(contextOf(req))));
  });

  static createGradingScheme = handle(async (req, res) => {
    const created = await service().createGradingScheme(contextOf(req), req.validated!.body as CreateGradingSchemeInput);
    res.status(201).json(ApiResponse.ok(created, 'Grading scheme created'));
  });

  static updateGradingScheme = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateGradingScheme(contextOf(req), id, req.validated!.body as UpdateGradingSchemeInput);
    res.status(200).json(ApiResponse.ok(updated, 'Grading scheme saved'));
  });

  static scoreSheets = handle(async (req, res) => {
    const page = await service().fetchScoreSheets(contextOf(req), req.validated!.query as FetchScoreSheetsQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static scoreSheet = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    res.status(200).json(ApiResponse.ok(await service().fetchScoreSheet(contextOf(req), id)));
  });

  static saveScores = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const sheet = await service().saveScores(contextOf(req), id, req.validated!.body as SaveScoresInput, readIfMatch(req));
    res.status(200).json(ApiResponse.ok(sheet, 'Scores saved'));
  });

  static transition = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const sheet = await service().transitionScoreSheet(contextOf(req), id, req.validated!.body as TransitionScoreSheetInput);
    res.status(200).json(ApiResponse.ok(sheet, `Sheet ${sheet.status.toLowerCase()}`));
  });

  static reportCard = handle(async (req, res) => {
    const { studentId, termId } = req.validated!.params as { studentId: string; termId: string };
    res.status(200).json(ApiResponse.ok(await service().fetchReportCard(contextOf(req), studentId, termId)));
  });

  /** The portal's results tab: this term unless another is named. */
  static studentResults = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    const { termId } = req.validated!.query as { termId?: string };
    res.status(200).json(ApiResponse.ok(await service().fetchReportCard(contextOf(req), studentId, termId)));
  });

  static saveReportCardComments = handle(async (req, res) => {
    const { studentId, termId } = req.validated!.params as { studentId: string; termId: string };
    const card = await service().saveReportCardComments(
      contextOf(req),
      studentId,
      termId,
      req.validated!.body as SaveReportCardCommentsInput,
    );
    res.status(200).json(ApiResponse.ok(card, 'Comments saved'));
  });

  static broadsheet = handle(async (req, res) => {
    const { classId, termId } = req.validated!.query as { classId: string; termId: string };
    res.status(200).json(ApiResponse.ok(await service().fetchBroadsheet(contextOf(req), classId, termId)));
  });

  static commentTemplates = handle(async (req, res) => {
    res.status(200).json(ApiResponse.ok(await service().fetchCommentTemplates(contextOf(req))));
  });

  static createCommentTemplate = handle(async (req, res) => {
    const created = await service().createCommentTemplate(contextOf(req), req.validated!.body as CreateCommentTemplateInput);
    res.status(201).json(ApiResponse.ok(created, 'Template saved'));
  });

  static transcript = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    res.status(200).json(ApiResponse.ok(await service().fetchTranscript(contextOf(req), studentId)));
  });

  static issueTranscript = handle(async (req, res) => {
    const { studentId } = req.validated!.params as { studentId: string };
    res.status(200).json(ApiResponse.ok(await service().issueTranscript(contextOf(req), studentId), 'Transcript issued'));
  });

  /** Public — no session, no tenant; the code is the only key. */
  static verify = handle(async (req, res) => {
    const { code } = req.validated!.params as { code: string };
    res.status(200).json(ApiResponse.ok(await service().verify(code.toUpperCase())));
  });
}
