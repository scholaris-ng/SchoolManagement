import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { tenantMiddleware } from '../../../shared/middleware/tenant.middleware';
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
const router = Router();

router.use(authMiddleware, tenantMiddleware);

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

router.get(
  '/finance/overview',
  authorise('analytics.read', 'finance.read'),
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
