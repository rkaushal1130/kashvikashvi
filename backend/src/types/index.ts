export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DISTRIBUTOR' | 'CUSTOMER' | 'SUPPORT';

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_KYC' | 'BLOCKED';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  distributorProfileId?: string;
  distributorCode?: string;
  customerId?: string;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  family: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export * from './commissionCalculation.types';
export * from './commissionEligibility.types';
export * from './levelCommission.types';
export * from './commissionConfig.types';
export * from './commissionLedger.types';
export * from './commissionPosting.types';
export * from './commissionWallet.types';
export * from './orderCommissionLifecycle.types';
export * from './commissionReversal.types';
export * from './commissionDashboard.types';
export * from './commissionReconciliation.types';

