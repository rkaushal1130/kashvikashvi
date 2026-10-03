import { Router } from 'express';
import { EnrollmentController } from './enrollment.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { enrollSchema } from '../../schemas/enrollment.schemas.js';

const router = Router();

router.get('/verify-sponsor/:sponsorId', EnrollmentController.verifySponsor);
router.post('/submit', validateRequest({ body: enrollSchema }), EnrollmentController.enroll);
router.post('/enroll', validateRequest({ body: enrollSchema }), EnrollmentController.enroll);

export default router;
