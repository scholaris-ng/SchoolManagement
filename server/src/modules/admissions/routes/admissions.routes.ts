import { Router } from 'express';
import { authorise, authoriseAll } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  admissionIdParamSchema,
  convertAdmissionSchema,
  createAdmissionSchema,
  fetchAdmissionsSchema,
  linkApplicationGuardianSchema,
  scheduleInterviewSchema,
  transitionAdmissionSchema,
  unlinkApplicationGuardianSchema,
} from '../validators/admissions.schema';
import { AdmissionsController } from '../controllers/admissions.controller';

/**
 * Admissions, as staff work them (spec section 10).
 *
 * The funnel chart is not here: it lives in the analytics module with the
 * other aggregates, because the analytics screen reads it as well as this one.
 *
 * `authMiddleware` and `tenantMiddleware` run once, globally, in app.ts. The
 * public submission route is mounted separately, ahead of them, in
 * `publicAdmissions.routes.ts`.
 */
const router = Router();

router.get(
  '/admissions',
  authorise('admission.read'),
  validate(fetchAdmissionsSchema),
  AdmissionsController.fetchAll,
);

router.get(
  '/admissions/:id',
  authorise('admission.read'),
  validate(admissionIdParamSchema),
  AdmissionsController.fetchOne,
);

router.post(
  '/admissions',
  authorise('admission.manage'),
  validate(createAdmissionSchema),
  AdmissionsController.create,
);

/**
 * A stage change is sent as an intent, not a write. Which stages this caller
 * may actually reach is the service's decision: moving an application along
 * needs `admission.manage`, while offering, accepting or refusing a place
 * needs `admission.decide` on top of it.
 */
router.post(
  '/admissions/:id/transition',
  authorise('admission.manage', 'admission.decide'),
  validate(transitionAdmissionSchema),
  AdmissionsController.transition,
);

/**
 * Setting up, or recording the result of, an interview — kept separate from
 * `transition` because it never moves `status` by itself. `admission.manage`
 * alone is enough: a school telling a family when to come in, or writing down
 * how the interview went, is not the same act as deciding the place.
 */
router.patch(
  '/admissions/:id/interview',
  authorise('admission.manage'),
  validate(scheduleInterviewSchema),
  AdmissionsController.scheduleInterview,
);

/**
 * Enrolment. Needs the permission to create a pupil and the permission to
 * manage guardians, because it creates both — this one call is where an
 * application's contacts finally become guardian records.
 */
router.post(
  '/admissions/:id/convert',
  authoriseAll('student.create', 'guardian.manage'),
  validate(convertAdmissionSchema),
  AdmissionsController.convert,
);

/**
 * Attaching an existing guardian record before enrollment — for a family the
 * office already knows. `admission.manage` alone is enough: this only
 * associates the application with a `Guardian` row that already exists, and
 * grants nothing on its own — no portal access, no billing, no directory
 * listing — the way editing the application's own `contacts` doesn't either.
 */
router.post(
  '/admissions/:id/guardians',
  authorise('admission.manage'),
  validate(linkApplicationGuardianSchema),
  AdmissionsController.linkGuardian,
);

router.delete(
  '/admissions/:id/guardians/:linkId',
  authorise('admission.manage'),
  validate(unlinkApplicationGuardianSchema),
  AdmissionsController.unlinkGuardian,
);

export default router;
