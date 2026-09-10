import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

/**
 * Only the administrator's dashboard is served here.
 *
 * The teacher, parent, student and bursar dashboards are almost entirely made
 * of timetable, results, finance and curriculum data, none of which is modelled
 * server-side yet. They stay unimplemented rather than returning four screens
 * of zeros, which would read as a broken product rather than an unbuilt one.
 */
const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/dashboard/admin', authorise('analytics.read'), DashboardController.fetchAdmin);

export default router;
