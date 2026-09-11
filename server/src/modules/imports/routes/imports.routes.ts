import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { ImportsController } from '../controllers/imports.controller';
import {
  commitImportSchema,
  fetchImportJobsSchema,
  importIdParamSchema,
  validateImportSchema,
} from '../validators/imports.schema';

/**
 * Bulk import (spec section 9).
 *
 * Two steps on purpose. `validate` reads the file and answers with everything
 * that would happen — the problems, the duplicates, the rows as they would be
 * saved — and writes nothing but the record of having looked. `commit` then
 * applies it, re-checking as it goes, so nothing is decided on a picture of
 * the database that has since moved on.
 *
 * `commit` answers 202 and keeps working after the response: a large file used
 * to outlast the browser's thirty-second patience and report itself as a
 * network failure while the rows were landing. Progress is followed through
 * `GET /imports/:id`.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get(
  '/imports',
  authorise('import.run'),
  validate(fetchImportJobsSchema),
  ImportsController.fetchJobs,
);

router.get(
  '/imports/:id',
  authorise('import.run'),
  validate(importIdParamSchema),
  ImportsController.fetchJob,
);

router.post(
  '/imports/validate',
  authorise('import.run'),
  validate(validateImportSchema),
  ImportsController.validate,
);

router.post(
  '/imports/commit',
  authorise('import.run'),
  validate(commitImportSchema),
  ImportsController.commit,
);

export default router;
