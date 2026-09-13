import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { SchemeService } from '../services/scheme.service';
import type {
  CreateLessonNoteInput,
  FetchLessonNotesQuery,
  FetchSchemesQuery,
  GenerateSchemeInput,
  UpdateLessonNoteInput,
  UpdateSchemeInput,
} from '../validators/curriculum.schema';

const service = () => SchemeService.Instance;

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

/** The optimistic-lock version the client echoes back, when it sends one. */
function readIfMatch(req: Request): number | undefined {
  const raw = req.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class SchemeController {
  static schemes = handle(async (req, res) => {
    const page = await service().fetchSchemes(contextOf(req), req.validated!.query as FetchSchemesQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static scheme = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    res.status(200).json(ApiResponse.ok(await service().fetchScheme(contextOf(req), id)));
  });

  static generate = handle(async (req, res) => {
    const created = await service().generateScheme(contextOf(req), req.validated!.body as GenerateSchemeInput);
    res.status(201).json(ApiResponse.ok(created, 'Scheme generated'));
  });

  static updateScheme = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateScheme(
      contextOf(req),
      id,
      req.validated!.body as UpdateSchemeInput,
      readIfMatch(req),
    );
    res.status(200).json(ApiResponse.ok(updated, 'Scheme saved'));
  });

  static notes = handle(async (req, res) => {
    const page = await service().fetchLessonNotes(contextOf(req), req.validated!.query as FetchLessonNotesQuery);
    res.status(200).json(ApiResponse.paginated(page));
  });

  static note = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    res.status(200).json(ApiResponse.ok(await service().fetchLessonNote(contextOf(req), id)));
  });

  static createNote = handle(async (req, res) => {
    const created = await service().createLessonNote(contextOf(req), req.validated!.body as CreateLessonNoteInput);
    res.status(201).json(ApiResponse.ok(created, 'Lesson note saved'));
  });

  static updateNote = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    const updated = await service().updateLessonNote(
      contextOf(req),
      id,
      req.validated!.body as UpdateLessonNoteInput,
      readIfMatch(req),
    );
    res.status(200).json(ApiResponse.ok(updated, 'Lesson note saved'));
  });

  static removeNote = handle(async (req, res) => {
    const { id } = req.validated!.params as { id: string };
    await service().removeLessonNote(contextOf(req), id);
    res.status(204).send();
  });

  static bulkDeleteNotes = handle(async (req, res) => {
    const { ids } = req.validated!.body as { ids: string[] };
    res.status(200).json(ApiResponse.ok(await service().bulkDeleteLessonNotes(contextOf(req), ids)));
  });
}
