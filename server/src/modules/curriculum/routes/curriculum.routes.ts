import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { CurriculumController } from '../controllers/curriculum.controller';
import { SchemeController } from '../controllers/scheme.controller';
import {
  bulkDeleteLessonNotesSchema,
  createCurriculumSchema,
  createLessonNoteSchema,
  createObjectiveSchema,
  createTopicSchema,
  curriculumParamSchema,
  curriculumScopedParamSchema,
  fetchCoverageSchema,
  fetchCurriculaSchema,
  fetchLessonNotesSchema,
  fetchSchemesSchema,
  generateSchemeSchema,
  lessonNoteParamSchema,
  markCoverageSchema,
  objectiveParamSchema,
  schemeParamSchema,
  topicParamSchema,
  updateCurriculumSchema,
  updateLessonNoteSchema,
  updateObjectiveSchema,
  updateSchemeSchema,
  updateTopicSchema,
} from '../validators/curriculum.schema';

/**
 * The curriculum tree (spec section 13): curricula, their topics, each
 * topic's objectives, and the coverage marked against them.
 *
 * Reads are `curriculum.read`, writes `curriculum.manage`; a teacher holds
 * both, and `CurriculumService` narrows every one of them to the plans for the
 * pairs they teach or wrote. Deleting a plan is narrower again — the author
 * or `academics.manage` — and the service says so.
 *
 * Schemes of work follow the curriculum's visibility; a teacher's lesson notes
 * are their own, and a reviewer (`lessonnote.approve`) sees everyone's.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts.
 */
const router = Router();

const read = authorise('curriculum.read');
const manage = authorise('curriculum.manage');

/* -- Curricula ------------------------------------------------------------- */

router.get(
  '/curricula',
  read,
  validate(fetchCurriculaSchema),
  CurriculumController.fetchAll,
);
router.post(
  '/curricula',
  manage,
  validate(createCurriculumSchema),
  CurriculumController.create,
);
router.patch(
  '/curricula/:id',
  manage,
  validate(updateCurriculumSchema),
  CurriculumController.update,
);
router.delete(
  '/curricula/:id',
  manage,
  validate(curriculumParamSchema),
  CurriculumController.remove,
);

/* -- Topics and objectives ------------------------------------------------- */

router.get(
  '/curricula/:curriculumId/topics',
  read,
  validate(curriculumScopedParamSchema),
  CurriculumController.topics,
);
router.post(
  '/curricula/:curriculumId/topics',
  manage,
  validate(createTopicSchema),
  CurriculumController.createTopic,
);
router.patch(
  '/curricula/:curriculumId/topics/:topicId',
  manage,
  validate(updateTopicSchema),
  CurriculumController.updateTopic,
);
router.delete(
  '/curricula/:curriculumId/topics/:topicId',
  manage,
  validate(topicParamSchema),
  CurriculumController.removeTopic,
);

router.post(
  '/curricula/:curriculumId/topics/:topicId/objectives',
  manage,
  validate(createObjectiveSchema),
  CurriculumController.createObjective,
);
router.patch(
  '/curricula/:curriculumId/topics/:topicId/objectives/:objectiveId',
  manage,
  validate(updateObjectiveSchema),
  CurriculumController.updateObjective,
);
router.delete(
  '/curricula/:curriculumId/topics/:topicId/objectives/:objectiveId',
  manage,
  validate(objectiveParamSchema),
  CurriculumController.removeObjective,
);

/* -- Coverage -------------------------------------------------------------- */

router.get(
  '/curriculum-coverage',
  read,
  validate(fetchCoverageSchema),
  CurriculumController.coverage,
);
router.post(
  '/curricula/:curriculumId/coverage',
  manage,
  validate(markCoverageSchema),
  CurriculumController.markCoverage,
);

/* -- Schemes of work ------------------------------------------------------- */

router.get(
  '/schemes',
  authorise('scheme.read'),
  validate(fetchSchemesSchema),
  SchemeController.schemes,
);
router.post(
  '/schemes/generate',
  authorise('scheme.manage'),
  validate(generateSchemeSchema),
  SchemeController.generate,
);
router.get(
  '/schemes/:id',
  authorise('scheme.read'),
  validate(schemeParamSchema),
  SchemeController.scheme,
);
router.patch(
  '/schemes/:id',
  authorise('scheme.manage', 'scheme.approve'),
  validate(updateSchemeSchema),
  SchemeController.updateScheme,
);

/* -- Lesson notes ---------------------------------------------------------- */

router.get(
  '/lesson-notes',
  authorise('lessonnote.read'),
  validate(fetchLessonNotesSchema),
  SchemeController.notes,
);
router.post(
  '/lesson-notes',
  authorise('lessonnote.manage'),
  validate(createLessonNoteSchema),
  SchemeController.createNote,
);
// Before '/lesson-notes/:id', or 'bulk-delete' is read as an id.
router.post(
  '/lesson-notes/bulk-delete',
  authorise('lessonnote.manage'),
  validate(bulkDeleteLessonNotesSchema),
  SchemeController.bulkDeleteNotes,
);
router.get(
  '/lesson-notes/:id',
  authorise('lessonnote.read'),
  validate(lessonNoteParamSchema),
  SchemeController.note,
);
router.patch(
  '/lesson-notes/:id',
  authorise('lessonnote.manage', 'lessonnote.approve'),
  validate(updateLessonNoteSchema),
  SchemeController.updateNote,
);
router.delete(
  '/lesson-notes/:id',
  authorise('lessonnote.manage'),
  validate(lessonNoteParamSchema),
  SchemeController.removeNote,
);

export default router;
