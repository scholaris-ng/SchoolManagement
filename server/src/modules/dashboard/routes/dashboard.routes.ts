import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

/**
 * The administrator, teacher, bursar and parent dashboards are served here.
 *
 * The student dashboard is almost entirely made of results and timetable
 * data, none of which is modelled server-side yet. It stays unimplemented
 * rather than returning a screen of zeros, which would read as a broken
 * product rather than an unbuilt one.
 *
 * The teacher, bursar and parent dashboards are each missing some of the same
 * underlying modules (results and messaging, for all three; timetable, score
 * sheets, lesson notes and assessments besides, for the teacher) — but all
 * three are routed anyway: `/` renders them unconditionally for those
 * personas, so leaving one unrouted 404s for everybody who signs in as it.
 * An honest, partly-real screen is a better landing page than a broken
 * request, the same trade `DashboardService` documents on each method.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get('/dashboard/admin', authorise('analytics.read'), DashboardController.fetchAdmin);
router.get('/dashboard/teacher', authorise('curriculum.read'), DashboardController.fetchTeacher);
router.get('/dashboard/bursar', authorise('finance.read'), DashboardController.fetchBursar);
router.get('/dashboard/parent', authorise('student.read'), DashboardController.fetchParent);

export default router;
