import { z } from 'zod';

export const updateDistributorProfileSchema = z
  .object({
    firstName: z.string().min(1, 'First name cannot be empty').trim().optional(),
    lastName: z.string().min(1, 'Last name cannot be empty').trim().optional(),
    displayName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED']).optional(),
  })
  .strict();

export type UpdateDistributorProfileInput = z.infer<typeof updateDistributorProfileSchema>;
