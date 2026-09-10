import 'reflect-metadata';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env';
import { requestIdMiddleware } from './shared/middleware/requestId.middleware';
import { apiRateLimiter } from './shared/middleware/rateLimiter.middleware';
import {
  globalErrorHandler,
  notFoundHandler,
} from './shared/middleware/errorHandler.middleware';

import healthRoutes from './modules/health/routes/health.routes';
import authRoutes from './modules/auth/routes/auth.routes';
import schoolRoutes from './modules/school/routes/school.routes';
import roleRoutes from './modules/rbac/routes/role.routes';
import auditRoutes from './modules/audit/routes/audit.routes';
import academicsRoutes from './modules/academics/routes/academics.routes';
import studentsRoutes from './modules/students/routes/students.routes';
import guardiansRoutes from './modules/guardians/routes/guardians.routes';
import notificationsRoutes from './modules/notifications/routes/notifications.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import analyticsRoutes from './modules/analytics/routes/analytics.routes';
import staffRoutes from './modules/staff/routes/staff.routes';
import admissionsRoutes from './modules/admissions/routes/admissions.routes';
import importsRoutes from './modules/imports/routes/imports.routes';
import curriculumRoutes from './modules/curriculum/routes/curriculum.routes';
import calendarRoutes from './modules/calendar/routes/calendar.routes';
import financeRoutes from './modules/finance/routes/finance.routes';
import assessmentRoutes from './modules/assessment/routes/assessment.routes';
import behaviourRoutes from './modules/behaviour/routes/behaviour.routes';
import disciplineRoutes from './modules/discipline/routes/discipline.routes';
import engagementRoutes from './modules/engagement/routes/engagement.routes';
import timetableRoutes from './modules/timetable/routes/timetable.routes';

export function createApp(): Express {
  const app = express();

  // Behind App Hosting / Cloud Run there is a proxy in front, so `req.ip` is
  // only correct once Express is told to read the forwarding header. Rate
  // limiting keys off it.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(requestIdMiddleware);

  // Outside the versioned prefix so a platform probe never tracks an API
  // version, and ahead of the rate limiter so probes are never throttled.
  app.use('/api/health', healthRoutes);

  app.use(env.apiPrefix, apiRateLimiter);

  const api = [
    authRoutes,
    schoolRoutes,
    roleRoutes,
    auditRoutes,
    academicsRoutes,
    studentsRoutes,
    guardiansRoutes,
    notificationsRoutes,
    dashboardRoutes,
    analyticsRoutes,
    staffRoutes,
    admissionsRoutes,
    importsRoutes,
    curriculumRoutes,
    calendarRoutes,
    financeRoutes,
    assessmentRoutes,
    behaviourRoutes,
    disciplineRoutes,
    engagementRoutes,
    timetableRoutes,
  ];
  api.forEach((routes) => app.use(env.apiPrefix, routes));

  // Anything under /api that matched no route answers as JSON. Registered here,
  // before any SPA fallback, so /api/* can never return the React index.html —
  // the bug spec section 46 calls out by name.
  app.use('/api', notFoundHandler);

  app.use(globalErrorHandler);

  return app;
}

/**
 * Explicit allowlist, never a wildcard in production (spec section 40).
 * Same-origin requests carry no Origin header, and must not be refused.
 */
function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (env.corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}
