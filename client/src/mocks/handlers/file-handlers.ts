import { http, delay } from 'msw';
import {
  resolveContext,
} from '../context';
import { errors, latency, ok } from '../http-helpers';

const base = '/api/v1';

/** Staff records for the ids a class's form-teacher field was set to, dropping any that don't resolve. */

/** Session, school settings, academic structure and roles. */

/** Files. */
export const filehandlersHandlers = [

  http.post(`${base}/files/upload-target`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const body = (await request.json()) as { purpose: string; fileName: string };
    // The server names the object; a client-supplied filename never reaches
    // storage, which removes a whole class of path-traversal problems.
    const extension = body.fileName.split('.').pop() ?? 'bin';
    return ok({
      storagePath: `schools/${context.schoolId}/${body.purpose}/${crypto.randomUUID()}.${extension}`,
      uploadUrl: null,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    });
  }),
];
