import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

/**
 * The administrator and teacher dashboards are served here.
 *
 * The parent, student and bursar dashboards are almost entirely made of
 * results, finance and attendance data, none of which is modelled
 * server-side yet. They stay unimplemented rather than returning three
 * screens of zeros, which would read as a broken product rather than an
 * unbuilt one.
 *
 * The teacher dashboard is in the same situation — timetable entries,
 * attendance registers, score sheets, lesson notes, assessments and
 * messaging are all unbuilt too — but it is routed anyway: unlike the other
 * three, it currently 404s for every teacher who signs in, since `/` renders
 * it unconditionally for that persona. An honest empty to-do list is a
 * better landing screen than a broken request.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get('/dashboard/admin', authorise('analytics.read'), DashboardController.fetchAdmin);
router.get('/dashboard/teacher', authorise('curriculum.read'), DashboardController.fetchTeacher);

export default router;
