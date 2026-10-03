import { Prisma } from '@prisma/client';

export interface CommissionRateConfig {
  id?: string;
  levelNumber: number;
  percentage: Prisma.Decimal;
  percentageNumber: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommissionConfigValidationResult {
  isValid: boolean;
  errors: string[];
  levels: CommissionRateConfig[];
  totalPercentage: Prisma.Decimal;
  totalPercentageNumber: number;
}

export interface UpdateCommissionRateInput {
  levelNumber: number;
  percentage: number | string | Prisma.Decimal;
  isActive?: boolean;
}

export const CANONICAL_DEFAULT_RATES: readonly { levelNumber: number; percentage: string }[] = Object.freeze([
  { levelNumber: 1, percentage: '24.00' },
  { levelNumber: 2, percentage: '8.00' },
  { levelNumber: 3, percentage: '13.00' },
  { levelNumber: 4, percentage: '5.00' },
  { levelNumber: 5, percentage: '4.00' },
]);
