import { z } from 'zod';

export const enrollmentTypeEnum = z.enum(['DISTRIBUTOR', 'CUSTOMER']);
export const placementPositionEnum = z.enum(['LEFT', 'RIGHT']);

export const enrollmentIdParamSchema = z.object({
  id: z.string().uuid('Enrollment ID must be a valid UUID'),
});

export const createEnrollmentSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor ID or code is required').trim(),
  prospectEmail: z.string().email('Please enter a valid prospect email').toLowerCase().trim(),
  prospectPhone: z.string().trim().optional(),
  enrollmentType: enrollmentTypeEnum.default('DISTRIBUTOR'),
});

// Step 1: Personal Info
export const step1PersonalInfoSchema = z.object({
  legalName: z.string().min(2, 'Legal name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  mobile: z
    .string()
    .min(7, 'Mobile number must be at least 7 digits')
    .max(20, 'Mobile number is too long')
    .regex(/^[0-9+\-()\s]+$/, 'Mobile number contains invalid characters')
    .trim(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine((dob) => {
      const date = new Date(dob);
      if (isNaN(date.getTime())) return false;
      const ageDifMs = Date.now() - date.getTime();
      const ageDate = new Date(ageDifMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return age >= 18;
    }, 'Prospect must be at least 18 years old'),
});

// Step 2: Address & PIN
export const step2AddressSchema = z.object({
  address: z.string().min(3, 'Street address must be at least 3 characters').max(200).trim(),
  apartment: z.string().max(50).trim().optional(),
  city: z.string().min(2, 'City is required').max(100).trim(),
  state: z.string().min(2, 'State / Province is required').max(100).trim(),
  country: z.string().min(2, 'Country is required').max(100).trim(),
  postalCode: z.string().min(3, 'Postal code / PIN is required').max(20).trim(),
});

// Step 3: Tree Placement
export const step3TreePlacementSchema = z.object({
  sponsor: z.string().min(1, 'Sponsor ID or distributor code is required').trim(),
  businessCenter: z.string().trim().optional(),
  placementParent: z.string().min(1, 'Placement parent ID or distributor code is required').trim(),
  placementPosition: placementPositionEnum,
});

// Step 4: Starter Kit
export const step4StarterKitSchema = z.object({
  starterKitId: z.string().trim().optional(),
  productPackage: z.string().min(2, 'Product/package name is required').trim(),
  price: z.coerce.number().positive('Price must be greater than zero'),
  bv: z.coerce.number().min(0, 'BV must be 0 or greater'),
});

// Step 5: Bank & Security
export const step5BankSecuritySchema = z.object({
  accountHolder: z.string().min(2, 'Account holder name is required').max(100).trim(),
  bankName: z.string().min(2, 'Bank name is required').max(100).trim(),
  accountNumber: z
    .string()
    .min(4, 'Account number must be at least 4 digits')
    .max(35, 'Account number cannot exceed 35 digits')
    .regex(/^[0-9A-Za-z]+$/, 'Account number must contain only letters and digits')
    .trim(),
  ifsc: z
    .string()
    .min(4, 'IFSC / routing code is required')
    .max(25, 'IFSC / routing code is too long')
    .trim(),
  securityPin: z
    .string()
    .regex(/^\d{4,6}$/, 'Security PIN must be a 4 to 6 digit numeric code'),
});

export const updateEnrollmentSchema = z.object({
  prospectPhone: z.string().trim().optional(),
  legalName: z.string().min(2).max(100).trim().optional(),
  selectedPackage: z.string().trim().optional(),
  rejectionReason: z.string().trim().optional(),
});

export const completeEnrollmentSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  phone: z.string().min(7, 'Phone number must be at least 7 digits').trim(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  panNumber: z.string().optional(),

  address: z.string().min(3, 'Address is required').trim(),
  city: z.string().min(2, 'City is required').trim(),
  state: z.string().min(2, 'State is required').trim(),
  pincode: z.string().min(3, 'Pincode is required').trim(),
  country: z.string().default('India'),

  sponsorId: z.string().min(1, 'Sponsor ID is required').trim(),
  placementParentId: z.string().trim().optional(),
  placementPosition: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase().trim() : val),
    z.enum(['LEFT', 'RIGHT'])
  ),
  businessCenter: z.string().trim().optional(),

  enrollmentType: z.enum(['DISTRIBUTOR', 'CUSTOMER']).default('DISTRIBUTOR'),
  starterKitId: z.string().trim().optional(),
  productPackage: z.string().default('Starter Pack'),
  price: z.coerce.number().default(0),
  bv: z.coerce.number().default(0),

  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type Step1PersonalInfoInput = z.infer<typeof step1PersonalInfoSchema>;
export type Step2AddressInput = z.infer<typeof step2AddressSchema>;
export type Step3TreePlacementInput = z.infer<typeof step3TreePlacementSchema>;
export type Step4StarterKitInput = z.infer<typeof step4StarterKitSchema>;
export type Step5BankSecurityInput = z.infer<typeof step5BankSecuritySchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type CompleteEnrollmentInput = z.infer<typeof completeEnrollmentSchema>;

