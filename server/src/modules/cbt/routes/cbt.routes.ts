import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { CbtController } from '../controllers/cbt.controller';
import {
  assessmentParamSchema,
  createAssessmentSchema,
  createQuestionSchema,
  fetchAssessmentsSchema,
  fetchQuestionsSchema,
  flushAnswersSchema,
  questionParamSchema,
  submitAttemptSchema,
  updateAssessmentSchema,
  updateQuestionSchema,
} from '../validators/cbt.schema';

/**
 * The question bank and computer-based tests (spec section 25).
 *
 * Writing questions and papers is `question.manage` and `cbt.manage`; sitting
 * one is `cbt.take`, which only a pupil holds. Everything under `/attempts`
 * belongs to the candidate whose attempt it is, checked in the service — a
 * paper in progress is nobody else's to answer or submit.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

/* -- Question bank --------------------------------------------------------- */

router.get('/questions', authorise('cbt.read', 'question.manage'), validate(fetchQuestionsSchema), CbtController.questions);
router.post('/questions', authorise('question.manage'), validate(createQuestionSchema), CbtController.createQuestion);
router.patch('/questions/:id', authorise('question.manage'), validate(updateQuestionSchema), CbtController.updateQuestion);
router.delete('/questions/:id', authorise('question.manage'), validate(questionParamSchema), CbtController.removeQuestion);

/* -- Papers ---------------------------------------------------------------- */

router.get('/assessments', authorise('cbt.read', 'cbt.take'), validate(fetchAssessmentsSchema), CbtController.assessments);
router.post('/assessments', authorise('cbt.manage'), validate(createAssessmentSchema), CbtController.createAssessment);
router.get('/assessments/:id', authorise('cbt.read', 'cbt.take'), validate(assessmentParamSchema), CbtController.assessment);
router.patch('/assessments/:id', authorise('cbt.manage'), validate(updateAssessmentSchema), CbtController.updateAssessment);

/* -- Sitting a paper ------------------------------------------------------- */

router.post('/assessments/:id/attempts', authorise('cbt.take'), validate(assessmentParamSchema), CbtController.startAttempt);
router.post('/attempts/:attemptId/answers', authorise('cbt.take'), validate(flushAnswersSchema), CbtController.flushAnswers);
router.post('/attempts/:attemptId/submit', authorise('cbt.take'), validate(submitAttemptSchema), CbtController.submitAttempt);

export default router;
