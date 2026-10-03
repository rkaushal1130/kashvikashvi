import { z } from 'zod';

export const updateCommissionRateSchema = z.object({
  percentage: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, {
      message: 'Percentage must be a non-negative number between 0.00 and 100.00',
    }),
  isActive: z.boolean().optional(),
});

export const levelNumberParamSchema = z.object({
  levelNumber: z
    .string()
    .refine((val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 1 && num <= 5;
    }, {
      message: 'Level number must be an integer between 1 and 5',
    }),
});
