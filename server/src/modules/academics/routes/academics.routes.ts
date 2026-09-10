import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  createClassSchema,
  createHouseSchema,
  createLevelSchema,
  createPeriodSchema,
  createRoomSchema,
  createSessionSchema,
  createSubjectSchema,
  createTermSchema,
  fetchClassesSchema,
  fetchSubjectsSchema,
  fetchTermsSchema,
  idParamSchema,
  updateClassSchema,
  updateHouseSchema,
  updateLevelSchema,
  updatePeriodSchema,
  updateRoomSchema,
  updateSessionSchema,
  updateSubjectSchema,
  updateTermSchema,
} from '../validators/academics.schema';
import { AcademicsStructureController as Structure } from '../controllers/academicsStructure.controller';
import { AcademicsResourcesController as Resources } from '../controllers/academicsResources.controller';

const router = Router();

/**
 * Every route below is authenticated and tenant-scoped. Reads need
 * `academics.read`; writes need `academics.manage`.
 */
router.use(authMiddleware, tenantMiddleware);

const read = authorise('academics.read');
const manage = authorise('academics.manage');

// ─── Sessions ────────────────────────────────────────────────────────────────
router.get('/academics/sessions', read, Structure.sessions);
router.post('/academics/sessions', manage, validate(createSessionSchema), Structure.createSession);
router.patch('/academics/sessions/:id', manage, validate(updateSessionSchema), Structure.updateSession);
router.delete('/academics/sessions/:id', manage, validate(idParamSchema), Structure.removeSession);

// ─── Terms ───────────────────────────────────────────────────────────────────
router.get('/academics/terms', read, validate(fetchTermsSchema), Structure.terms);
router.post('/academics/terms', manage, validate(createTermSchema), Structure.createTerm);
router.patch('/academics/terms/:id', manage, validate(updateTermSchema), Structure.updateTerm);
router.post('/academics/terms/:id/set-current', manage, validate(idParamSchema), Structure.setCurrentTerm);

// ─── Levels ──────────────────────────────────────────────────────────────────
router.get('/academics/levels', read, Structure.levels);
router.post('/academics/levels', manage, validate(createLevelSchema), Structure.createLevel);
router.patch('/academics/levels/:id', manage, validate(updateLevelSchema), Structure.updateLevel);
router.delete('/academics/levels/:id', manage, validate(idParamSchema), Structure.removeLevel);

// ─── Classes ─────────────────────────────────────────────────────────────────
router.get('/academics/classes', read, validate(fetchClassesSchema), Structure.classes);
router.get('/academics/classes/:id', read, validate(idParamSchema), Structure.schoolClass);
router.post('/academics/classes', manage, validate(createClassSchema), Structure.createClass);
router.patch('/academics/classes/:id', manage, validate(updateClassSchema), Structure.updateClass);
router.delete('/academics/classes/:id', manage, validate(idParamSchema), Structure.removeClass);

// ─── Subjects ────────────────────────────────────────────────────────────────
router.get('/academics/subjects', read, validate(fetchSubjectsSchema), Resources.subjects);
router.post('/academics/subjects', manage, validate(createSubjectSchema), Resources.createSubject);
router.patch('/academics/subjects/:id', manage, validate(updateSubjectSchema), Resources.updateSubject);
router.delete('/academics/subjects/:id', manage, validate(idParamSchema), Resources.removeSubject);

// ─── Rooms ───────────────────────────────────────────────────────────────────
router.get('/academics/rooms', read, Resources.rooms);
router.post('/academics/rooms', manage, validate(createRoomSchema), Resources.createRoom);
router.patch('/academics/rooms/:id', manage, validate(updateRoomSchema), Resources.updateRoom);

// ─── Houses ──────────────────────────────────────────────────────────────────
router.get('/academics/houses', authorise('academics.read', 'house.read'), Resources.houses);
router.post('/academics/houses', manage, validate(createHouseSchema), Resources.createHouse);
router.patch('/academics/houses/:id', manage, validate(updateHouseSchema), Resources.updateHouse);

// ─── Periods ─────────────────────────────────────────────────────────────────
router.get('/academics/periods', authorise('academics.read', 'timetable.read'), Resources.periods);
router.post('/academics/periods', manage, validate(createPeriodSchema), Resources.createPeriod);
router.patch('/academics/periods/:id', manage, validate(updatePeriodSchema), Resources.updatePeriod);
router.delete('/academics/periods/:id', manage, validate(idParamSchema), Resources.removePeriod);

export default router;
