import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse } from '../response/apiResponse';
import { paginatedResult } from '../pagination/paginate';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../config/constants';

/**
 * Answering for a module whose tables do not exist yet.
 *
 * The client was written against the whole API before the server had built it,
 * so a screen for an unbuilt module asks for its list and gets a 404 — which
 * renders as a failed page rather than as the empty module it actually is. The
 * handlers here answer those reads with nothing, in the shape the client's type
 * already declares, so the screen draws its own empty state.
 *
 * Three rules keep this from becoming a lie:
 *
 * 1. Reads only. Nothing that writes is ever stubbed. A fake success on a
 *    payment or an import would report work that never happened.
 * 2. Lists only. A request for one record by id must still 404, because that
 *    record genuinely is not there.
 * 3. Every route using these is deleted the moment its module lands. The empty
 *    answer is scaffolding, not a fallback to keep.
 */

/**
 * Page numbers are validated properly because they shape the response envelope.
 * Filters are accepted as bounded strings without being checked against a
 * catalogue: there is nothing to filter yet, and inventing an enum here would
 * mean guessing the one the real module will define. Each module replaces this
 * with a strict schema when its tables arrive — `staff` and `curriculum` both
 * show what that looks like.
 */
export const placeholderListSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    })
    .catchall(z.string().trim().max(200)),
});

/** For a client type of `Paginated<T>`. */
export function emptyPage(req: Request, res: Response, next: NextFunction): void {
  try {
    const { page, pageSize } = req.validated!.query as { page: number; pageSize: number };
    res.status(200).json(ApiResponse.paginated(paginatedResult([], page, pageSize, 0)));
  } catch (error) {
    next(error);
  }
}

/** For a client type of `T[]` — a bare array, with no page around it. */
export function emptyArray(_req: Request, res: Response): void {
  res.status(200).json(ApiResponse.ok([]));
}
