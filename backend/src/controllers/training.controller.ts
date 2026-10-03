import { NextFunction, Request, Response } from 'express';
import { TrainingService } from '../services/training.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  courseIdParamSchema,
  lessonActionParamSchema,
  trainingCourseQuerySchema,
} from '../validators/training.validators';

export class TrainingController {
  /**
   * Retrieves all training courses with authenticated user's progress.
   * GET /api/v1/training
   */
  public static async getCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const query = trainingCourseQuerySchema.parse(req.query);
      const courses = await TrainingService.getCourses(req.user.id, query);

      sendSuccess(res, {
        message: 'Training courses retrieved successfully.',
        data: courses,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves single training course details with all lessons and progress.
   * GET /api/v1/training/:courseId
   */
  public static async getCourseById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const { courseId } = courseIdParamSchema.parse(req.params);
      const course = await TrainingService.getCourseById(req.user.id, courseId);

      sendSuccess(res, {
        message: 'Training course details retrieved successfully.',
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marks a lesson as started.
   * POST /api/v1/training/:courseId/lessons/:lessonId/start
   */
  public static async startLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const { courseId, lessonId } = lessonActionParamSchema.parse(req.params);
      const result = await TrainingService.startLesson(req.user.id, courseId, lessonId);

      sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marks a lesson as completed.
   * POST /api/v1/training/:courseId/lessons/:lessonId/complete
   */
  public static async completeLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const { courseId, lessonId } = lessonActionParamSchema.parse(req.params);
      const result = await TrainingService.completeLesson(req.user.id, courseId, lessonId);

      sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves overall training progress (completed tasks, remaining tasks, progress percentage).
   * GET /api/v1/training/progress
   */
  public static async getProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const progress = await TrainingService.getProgress(req.user.id);

      sendSuccess(res, {
        message: 'Overall training progress retrieved successfully.',
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }
}
