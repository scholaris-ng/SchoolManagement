import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

/**
 * The administrator, teacher and bursar dashboards are served here.
 *
 * The parent and student dashboards are almost entirely made of results and
 * attendance data, none of which is modelled server-side yet. They stay
 * unimplemented rather than returning screens of zeros, which would read as
 * a broken product rather than an unbuilt one.
 *
 * The teacher and bursar dashboards are in a similar situation — their
 * underlying modules (timetable, score sheets, lesson notes, assessments,
 * messaging; invoices, payments, arrears) are unbuilt too — but both are
 * routed anyway: unlike parent and student, `/` renders them unconditionally
 * for those personas, so leaving them unrouted 404s for every teacher and
 * bursar who signs in. An honest empty screen is a better landing page than
 * a broken request.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

router.get('/dashboard/admin', authorise('analytics.read'), DashboardController.fetchAdmin);
router.get('/dashboard/teacher', authorise('curriculum.read'), DashboardController.fetchTeacher);
router.get('/dashboard/bursar', authorise('finance.read'), DashboardController.fetchBursar);

export default router;
