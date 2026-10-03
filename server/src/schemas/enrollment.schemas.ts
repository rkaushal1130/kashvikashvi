import { z } from 'zod';

export const enrollSchema = z.object({
  // Declared so Zod does not strip it: validateRequest replaces req.body with the
  // parsed result, and EnrollmentController.enroll reads req.body.sponsorId.
  sponsorId: z.string().min(1, 'Sponsor ID is required'),
  placementParentId: z.string().optional(),
  enrollType: z.enum(['distributor', 'customer']).default('distributor'),
  fullName: z.string().min(2, 'Full name is required'),
  dob: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(8, 'Phone number is required'),
  panNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  placementLeg: z.enum(['auto', 'left', 'right']).default('auto'),
  parentBusinessCenter: z.string().default('BC 001'),
  starterKitId: z.string().default('kit_pro'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  agreeTerms: z.boolean().default(true),
});
