import { Router } from 'express';
import { authorise } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  admissionFunnelSchema,
  attendanceSummarySchema,
  attendanceTrendSchema,
  financeOverviewSchema,
  resultAnalyticsSchema,
  retentionRiskSchema,
  staffPerformanceSchema,
} from '../validators/analytics.schema';
import { AnalyticsController } from '../controllers/analytics.controller';

/**
 * The six aggregates behind the management analytics screen.
 *
 * Two of them do not live under `/analytics` because they are not analytics-only
 * — the attendance summary is the class table on the attendance screen and the
 * finance overview is the bursar's header, and both were named by the client
 * before this module existed. Their paths follow the client (spec section 35),
 * not this file's folder.
 *
 * Each route is guarded by the narrowest permission that fits: seeing how the
 * school is performing is `analytics.read`, seeing how a named colleague is
 * performing is `analytics.staff`, and seeing which families may withdraw is
 * `analytics.retention`. A teacher holds the first and neither of the others.
 */
/** `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. */
const router = Router();

/**
 * Unlike `/finance/overview` below, `result.read` stays in this OR: a teacher
 * holds it (for their own classes) but not `analytics.read`, and reads this
 * same whole-school average from the `/results` page's Analytics tab, which
 * is why that client route additionally requires `academics.read` — the
 * permission a parent (who also holds bare `result.read`) lacks.
 */
router.get(
  '/analytics/results',
  authorise('analytics.read', 'result.read'),
  validate(resultAnalyticsSchema),
  AnalyticsController.fetchResults,
);

router.get(
  '/analytics/staff',
  authorise('analytics.staff'),
  validate(staffPerformanceSchema),
  AnalyticsController.fetchStaff,
);

router.get(
  '/analytics/retention',
  authorise('analytics.retention'),
  validate(retentionRiskSchema),
  AnalyticsController.fetchRetention,
);

router.get(
  '/attendance/summary',
  authorise('analytics.read', 'attendance.read'),
  validate(attendanceSummarySchema),
  AnalyticsController.fetchAttendanceSummary,
);

router.get(
  '/attendance/trend',
  authorise('analytics.read', 'attendance.read'),
  validate(attendanceTrendSchema),
  AnalyticsController.fetchAttendanceTrend,
);

/**
 * `finance.read` is deliberately absent here: a parent holds it for their own
 * children's invoices, payments and ledger (each narrowed by
 * `visibleStudentIds` in the finance module), but this endpoint is a
 * whole-school aggregate that cannot be narrowed the same way — there is no
 * per-family "collection rate". A parent's own figures live at
 * `/family/finance` instead.
 */
router.get(
  '/finance/overview',
  authorise('analytics.read'),
  validate(financeOverviewSchema),
  AnalyticsController.fetchFinanceOverview,
);

router.get(
  '/admissions/funnel',
  authorise('analytics.read', 'admission.read'),
  validate(admissionFunnelSchema),
  AnalyticsController.fetchAdmissionFunnel,
);

export default router;
