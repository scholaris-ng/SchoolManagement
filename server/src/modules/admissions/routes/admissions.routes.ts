import { Router } from 'express';
import { authorise, authoriseAll } from '../../../shared/middleware/authorise.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  admissionIdParamSchema,
  convertAdmissionSchema,
  createAdmissionSchema,
  fetchAdmissionsSchema,
  transitionAdmissionSchema,
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

export default router;
