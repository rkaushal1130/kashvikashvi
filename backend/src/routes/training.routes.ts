import { Router } from 'express';
import { TrainingController } from '../controllers/training.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  courseIdParamSchema,
  lessonActionParamSchema,
  trainingCourseQuerySchema,
} from '../validators/training.validators';

export const trainingRouter = Router();

trainingRouter.use(authenticate);

// GET /api/v1/training/progress - Retrieve user's overall training progress
trainingRouter.get('/progress', TrainingController.getProgress);

// GET /api/v1/training - Retrieve all courses with user's progress
trainingRouter.get(
  '/',
  validate({ query: trainingCourseQuerySchema }),
  TrainingController.getCourses
);

// GET /api/v1/training/:courseId - Retrieve single course details & lesson list
trainingRouter.get(
  '/:courseId',
  validate({ params: courseIdParamSchema }),
  TrainingController.getCourseById
);

// POST /api/v1/training/:courseId/lessons/:lessonId/start - Mark lesson started
trainingRouter.post(
  '/:courseId/lessons/:lessonId/start',
  validate({ params: lessonActionParamSchema }),
  TrainingController.startLesson
);

// POST /api/v1/training/:courseId/lessons/:lessonId/complete - Mark lesson completed
trainingRouter.post(
  '/:courseId/lessons/:lessonId/complete',
  validate({ params: lessonActionParamSchema }),
  TrainingController.completeLesson
);
