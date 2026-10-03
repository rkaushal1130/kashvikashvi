import { NextFunction, Request, Response } from 'express';
import { EnrollmentService } from '../services/enrollment.service';
import { sendSuccess } from '../utils/apiResponse';

export class EnrollmentController {
  /**
   * Initializes a new enrollment session.
   * POST /api/v1/enrollments
   */
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enrollment = await EnrollmentService.createEnrollment(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Enrollment session initialized successfully.',
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves an enrollment session by ID.
   * GET /api/v1/enrollments/:id
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
      sendSuccess(res, {
        message: 'Enrollment session retrieved.',
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing enrollment session.
   * PATCH /api/v1/enrollments/:id
   */
  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await EnrollmentService.updateEnrollment(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Enrollment session updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 1: Personal Info
   * POST /api/v1/enrollments/:id/step/1
   */
  public static async saveStep1(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.saveStep1(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Step 1 (Personal Info) saved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 2: Address & PIN
   * POST /api/v1/enrollments/:id/step/2
   */
  public static async saveStep2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.saveStep2(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Step 2 (Address & PIN) saved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 3: Tree Placement
   * POST /api/v1/enrollments/:id/step/3
   */
  public static async saveStep3(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.saveStep3(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Step 3 (Tree Placement) validated and saved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 4: Starter Kit
   * POST /api/v1/enrollments/:id/step/4
   */
  public static async saveStep4(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.saveStep4(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Step 4 (Starter Kit) saved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 5: Bank & Security
   * POST /api/v1/enrollments/:id/step/5
   */
  public static async saveStep5(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.saveStep5(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Step 5 (Bank & Security) saved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * SUBMIT: Final Submission & Activation
   * POST /api/v1/enrollments/:id/submit
   */
  public static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.submitEnrollment(req.params.id);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Enrollment completed successfully! Account and placement activated.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Direct complete enrollment in a single atomic transaction.
   * POST /api/v1/enrollments/complete
   */
  public static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EnrollmentService.completeDirectEnrollment(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Enrollment completed successfully! Account and placement activated.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

