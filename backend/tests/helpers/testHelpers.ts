import { signAccessToken } from '../../src/utils/jwt';
import { UserRole, AccountStatus } from '../../src/types';

export function createTestToken(overrides?: {
  id?: string;
  email?: string;
  role?: UserRole;
  status?: AccountStatus;
}): string {
  return signAccessToken({
    sub: overrides?.id || 'usr-test-123',
    email: overrides?.email || 'test@kashvimlm.com',
    role: overrides?.role || 'DISTRIBUTOR',
    status: overrides?.status || 'ACTIVE',
  });
}

export function createAdminToken(): string {
  return createTestToken({
    id: 'usr-admin-001',
    email: 'admin@kashvimlm.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  });
}

export function createCustomerToken(): string {
  return createTestToken({
    id: 'usr-cust-001',
    email: 'customer@kashvimlm.com',
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });
}
