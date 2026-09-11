import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  changeStatusSchema,
  createStudentSchema,
  fetchStudentsSchema,
  promoteStudentsSchema,
  searchStudentsSchema,
  studentIdParamSchema,
  updateStudentSchema,
} from '../validators/students.schema';
import {
  addDocumentSchema,
  removeDocumentSchema,
  studentScopedSchema,
} from '../validators/studentRelations.schema';
import { StudentsController } from '../controllers/students.controller';
import { StudentRelationsController } from '../controllers/studentRelations.controller';

/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

/**
 * `student.read` is the gate; which pupils the caller then sees is narrowed
 * per row by `StudentAccessService` — a parent holds this permission and must
 * still only ever see their own children.
 */
router.get(
  '/students',
  authorise('student.read'),
  validate(fetchStudentsSchema),
  StudentsController.fetchAll,
);

// Before `/students/:id`, or "search" is read as an id and fails validation.
router.get(
  '/students/search',
  authorise('student.read'),
  validate(searchStudentsSchema),
  StudentsController.search,
);

router.get(
  '/students/:id',
  authorise('student.read'),
  validate(studentIdParamSchema),
  StudentsController.fetchOne,
);

router.post(
  '/students',
  authorise('student.create'),
  validate(createStudentSchema),
  StudentsController.create,
);

router.patch(
  '/students/:id',
  authorise('student.update'),
  validate(updateStudentSchema),
  StudentsController.update,
);

router.post(
  '/students/:id/status',
  authorise('student.update'),
  validate(changeStatusSchema),
  StudentsController.changeStatus,
);

/**
 * Before `/students/:id`, or "promotions" is read as a student id. Express
 * matches in registration order, and this literal has to win.
 */
router.post(
  '/students/promotions',
  authorise('student.promote'),
  validate(promoteStudentsSchema),
  StudentRelationsController.promote,
);

// ─── What hangs off a student record ────────────────────────────────────────
router.get(
  '/students/:studentId/enrollments',
  authorise('student.read'),
  validate(studentScopedSchema),
  StudentRelationsController.enrollments,
);

router.get(
  '/students/:studentId/documents',
  authorise('student.read'),
  validate(studentScopedSchema),
  StudentRelationsController.documents,
);

router.post(
  '/students/:studentId/documents',
  authorise('student.update'),
  validate(addDocumentSchema),
  StudentRelationsController.addDocument,
);

router.delete(
  '/students/:studentId/documents/:documentId',
  authorise('student.update'),
  validate(removeDocumentSchema),
  StudentRelationsController.removeDocument,
);

export default router;
