import { Router } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { isFirebaseConfigured } from '../../../infrastructure/firebase/firebaseAdmin';

/**
 * Liveness and readiness (DEPLOYMENT.md step 11).
 *
 * Mounted at `/api/health`, outside the versioned prefix, so a platform health
 * check never has to track an API version.
 */
const router = Router();

/** Is the process up? Nothing is checked beyond that, on purpose — a slow */
/** database must not make the platform restart a healthy container. */
router.get('/live', (_req, res) => {
  res.status(200).json(ApiResponse.ok({ status: 'ok' }));
});

/** Should this instance receive traffic? */
router.get('/ready', async (_req, res) => {
  const database = await checkDatabase();
  const firebase = isFirebaseConfigured() ? 'ok' : 'not-configured';
  const ready = database === 'ok';

  res
    .status(ready ? 200 : 503)
    .json(
      ready
        ? ApiResponse.ok({ status: 'ok', database, firebase })
        : ApiResponse.error('INTERNAL_ERROR', 'The API is not ready to serve traffic.'),
    );
});

async function checkDatabase(): Promise<string> {
  if (!AppDataSource.isInitialized) return 'not-initialised';
  try {
    await AppDataSource.query('SELECT 1');
    return 'ok';
  } catch {
    return 'unreachable';
  }
}

export default router;
