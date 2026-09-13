import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { emptyPage, placeholderListSchema } from '../../../shared/placeholder/unbuiltModule';
import { AssessmentController } from '../controllers/assessment.controller';
import {
  broadsheetSchema,
  createCommentTemplateSchema,
  createGradingSchemeSchema,
  fetchScoreSheetsSchema,
  reportCardParamSchema,
  saveReportCardCommentsSchema,
  saveScoresSchema,
  scoreSheetParamSchema,
  studentResultsSchema,
  transcriptParamSchema,
  transitionScoreSheetSchema,
  updateGradingSchemeSchema,
} from '../validators/assessment.schema';

/**
 * Results (spec sections 19–22).
 *
 * Reading a sheet, card, broadsheet or transcript is `result.read` or
 * `reportcard.read`/`transcript.read`; each is narrowed in the service to the
 * pairs a teacher takes or the children a parent has. Entering marks is
 * `result.enter`; the workflow's three steps are `result.enter`,
 * `result.approve` and `result.publish` in turn, checked in the service so
 * the error can say which step was missing.
 *
 * Computer-based tests are still lists with nothing behind them — see
 * `cbt.routes.ts` when that lands.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

/* -- Grading schemes ------------------------------------------------------- */

router.get('/grading-schemes', authorise('result.read', 'grading.manage'), AssessmentController.gradingSchemes);
router.post('/grading-schemes', authorise('grading.manage'), validate(createGradingSchemeSchema), AssessmentController.createGradingScheme);
router.patch('/grading-schemes/:id', authorise('grading.manage'), validate(updateGradingSchemeSchema), AssessmentController.updateGradingScheme);

/* -- Score sheets ---------------------------------------------------------- */

router.get('/score-sheets', authorise('result.read', 'result.enter'), validate(fetchScoreSheetsSchema), AssessmentController.scoreSheets);
router.get('/score-sheets/:id', authorise('result.read', 'result.enter'), validate(scoreSheetParamSchema), AssessmentController.scoreSheet);
router.patch('/score-sheets/:id/scores', authorise('result.enter', 'result.amend'), validate(saveScoresSchema), AssessmentController.saveScores);
router.post(
  '/score-sheets/:id/transition',
  authorise('result.enter', 'result.approve', 'result.publish'),
  validate(transitionScoreSheetSchema),
  AssessmentController.transition,
);

/* -- Report cards, broadsheet, comments ------------------------------------ */

router.get('/report-cards/:studentId/:termId', authorise('reportcard.read'), validate(reportCardParamSchema), AssessmentController.reportCard);
router.patch(
  '/report-cards/:studentId/:termId',
  authorise('reportcard.generate'),
  validate(saveReportCardCommentsSchema),
  AssessmentController.saveReportCardComments,
);
/** The portal's results tab — a report card by another name. */
router.get('/students/:studentId/results', authorise('result.read', 'reportcard.read'), validate(studentResultsSchema), AssessmentController.studentResults);
router.get('/broadsheet', authorise('result.read'), validate(broadsheetSchema), AssessmentController.broadsheet);
router.get('/comment-templates', authorise('result.read', 'reportcard.read'), AssessmentController.commentTemplates);
router.post('/comment-templates', authorise('reportcard.generate'), validate(createCommentTemplateSchema), AssessmentController.createCommentTemplate);

/* -- Transcripts ----------------------------------------------------------- */

router.get('/transcripts/:studentId', authorise('transcript.read'), validate(transcriptParamSchema), AssessmentController.transcript);
router.post('/transcripts/:studentId/issue', authorise('transcript.issue'), validate(transcriptParamSchema), AssessmentController.issueTranscript);

/* -- Computer-based tests: lists only, nothing behind them yet ------------- */

router.get('/assessments', authorise('cbt.read'), validate(placeholderListSchema), emptyPage);
router.get('/questions', authorise('cbt.read', 'question.manage'), validate(placeholderListSchema), emptyPage);

export default router;
