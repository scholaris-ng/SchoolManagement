import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  emptyArray,
  emptyPage,
  placeholderListSchema,
} from '../../../shared/placeholder/unbuiltModule';

/**
 * Assessment: computer-based tests, the question bank, and the score sheets
 * that feed a report card. None of it is modelled yet.
 *
 * This is the same absence `/analytics/results` already reports as a zero
 * average — no assessment exists, so nothing has been marked. Serving the lists
 * empty lets the screens draw their own empty states.
 *
 * Nothing that writes is routed, and neither is anything under `/attempts`:
 * sitting a test, answering a question and submitting a paper are all writes
 * against a candidate's record, and a stub there would report a paper as taken.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/assessments', authorise('cbt.read'), validate(placeholderListSchema), emptyPage);

router.get(
  '/questions',
  authorise('cbt.read', 'question.manage'),
  validate(placeholderListSchema),
  emptyPage,
);

router.get(
  '/score-sheets',
  authorise('result.read', 'result.enter'),
  validate(placeholderListSchema),
  emptyPage,
);

/**
 * Grading schemes decide what a mark is worth. The client types them as a bare
 * array, and they are read by anyone who may see a result, not only by whoever
 * may edit the scheme.
 */
router.get(
  '/grading-schemes',
  authorise('result.read', 'grading.manage'),
  validate(placeholderListSchema),
  emptyArray,
);

/** Stock remarks for report cards — read alongside the sheets they annotate. */
router.get(
  '/comment-templates',
  authorise('result.read', 'reportcard.read'),
  validate(placeholderListSchema),
  emptyArray,
);

export default router;
