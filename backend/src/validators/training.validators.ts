import { z } from 'zod';

export const trainingCourseCategoryEnum = z.enum([
  'ORIENTATION',
  'BUSINESS_SETUP',
  'PRODUCT',
  'ETHICS',
  'MARKETING',
  'TOOLS',
]);

export const trainingCourseQuerySchema = z.object({
  category: trainingCourseCategoryEnum.optional(),
  search: z.string().trim().optional(),
  isMandatory: z.coerce.boolean().optional(),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().trim().min(1, 'Course ID or slug is required'),
});

export const lessonActionParamSchema = z.object({
  courseId: z.string().trim().min(1, 'Course ID or slug is required'),
  lessonId: z.string().trim().min(1, 'Lesson ID is required'),
});

export type TrainingCourseCategoryEnum = z.infer<typeof trainingCourseCategoryEnum>;
export type TrainingCourseQueryInput = z.infer<typeof trainingCourseQuerySchema>;
