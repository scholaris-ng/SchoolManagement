import { http, delay } from 'msw';
import {
  db,
  resolveContext,
  scoped,
} from '../context';
import { errors, latency, ok } from '../http-helpers';

const base = '/api/v1';

/** Staff records for the ids a class's form-teacher field was set to, dropping any that don't resolve. */

/** Session, school settings, academic structure and roles. */

/** Audit. */
export const audithandlersHandlers = [

  http.get(`${base}/audit`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('audit.read')) return errors.forbidden();

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const severity = url.searchParams.get('severity');
    const search = (url.searchParams.get('search') ?? '').toLowerCase();

    const rows = scoped(db.auditLog, context.schoolId).filter(
      (entry) =>
        (!action || entry.action === action) &&
        (!severity || entry.severity === severity) &&
        (!search ||
          entry.actorName.toLowerCase().includes(search) ||
          entry.action.toLowerCase().includes(search) ||
          (entry.entityLabel ?? '').toLowerCase().includes(search)),
    );

    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
    const start = (page - 1) * pageSize;

    return ok({
      items: rows.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        hasNext: start + pageSize < rows.length,
        hasPrevious: page > 1,
      },
    });
  }),
];
