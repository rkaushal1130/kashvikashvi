import { Router } from 'express';
import { EnrollmentController } from '../controllers/enrollment.controller';
import { validate } from '../middleware/validate';
import {
  completeEnrollmentSchema,
  createEnrollmentSchema,
  enrollmentIdParamSchema,
  step1PersonalInfoSchema,
  step2AddressSchema,
  step3TreePlacementSchema,
  step4StarterKitSchema,
  step5BankSecuritySchema,
  updateEnrollmentSchema,
} from '../validators/enrollment.validators';

const router = Router();

// POST /api/v1/enrollments/complete - Direct complete enrollment
router.post(
  '/complete',
  validate({ body: completeEnrollmentSchema }),
  EnrollmentController.complete
);

// POST /api/v1/enrollments - Initialize enrollment session
router.post(
  '/',
  validate({ body: createEnrollmentSchema }),
  EnrollmentController.create
);

// GET /api/v1/enrollments/:id - Retrieve enrollment progression
router.get(
  '/:id',
  validate({ params: enrollmentIdParamSchema }),
  EnrollmentController.getById
);

// PATCH /api/v1/enrollments/:id - Update enrollment metadata
router.patch(
  '/:id',
  validate({ params: enrollmentIdParamSchema, body: updateEnrollmentSchema }),
  EnrollmentController.update
);

// STEP 1: Personal Info
// POST /api/v1/enrollments/:id/step/1
router.post(
  '/:id/step/1',
  validate({ params: enrollmentIdParamSchema, body: step1PersonalInfoSchema }),
  EnrollmentController.saveStep1
);

// STEP 2: Address & PIN
// POST /api/v1/enrollments/:id/step/2
router.post(
  '/:id/step/2',
  validate({ params: enrollmentIdParamSchema, body: step2AddressSchema }),
  EnrollmentController.saveStep2
);

// STEP 3: Tree Placement
// POST /api/v1/enrollments/:id/step/3
router.post(
  '/:id/step/3',
  validate({ params: enrollmentIdParamSchema, body: step3TreePlacementSchema }),
  EnrollmentController.saveStep3
);

// STEP 4: Starter Kit
// POST /api/v1/enrollments/:id/step/4
router.post(
  '/:id/step/4',
  validate({ params: enrollmentIdParamSchema, body: step4StarterKitSchema }),
  EnrollmentController.saveStep4
);

// STEP 5: Bank & Security
// POST /api/v1/enrollments/:id/step/5
router.post(
  '/:id/step/5',
  validate({ params: enrollmentIdParamSchema, body: step5BankSecuritySchema }),
  EnrollmentController.saveStep5
);

// SUBMIT: Final submission & activation
// POST /api/v1/enrollments/:id/submit
router.post(
  '/:id/submit',
  validate({ params: enrollmentIdParamSchema }),
  EnrollmentController.submit
);

export const enrollmentRouter = router;
