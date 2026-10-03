import { z } from 'zod';
import { AppError } from '../utils/appError';

/**
 * ============================================================================
 * COMMISSION API VALIDATORS (PROMPT 23)
 * ============================================================================
 * Strict Zero-Trust validation for Commission Member and Admin endpoints.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Never accept commission amount from the frontend.
 * 2. Never accept percentage from the frontend.
 * 3. Never accept recipientId from a normal commission-generation request.
 * 4. The backend determines: BV, upline, level, percentage, commission amount, eligibility.
 */

import { AuditService } from '../services/audit.service';

export const FORBIDDEN_CLIENT_COMMISSION_FIELDS = [
  'commission',
  'commissions',
  'amount',
  'commissionamount',
  'commission_amount',
  'grosscommissionamount',
  'gross_commission_amount',
  'netcommissionamount',
  'net_commission_amount',
  'percentage',
  'percent',
  'rate',
  'commissionrate',
  'commissionpercentage',
  'recipientid',
  'recipient_id',
  'recipientmemberid',
  'recipient_member_id',
  'recipient',
  'recipients',
  'sourcememberid',
  'source_member_id',
  'sourcemember',
  'bv',
  'businessvolume',
  'business_volume',
  'totalbv',
  'total_bv',
  'orderbv',
  'level',
  'commissionlevel',
  'commission_level',
  'walletbalance',
  'wallet_balance',
  'balance',
  'orderstatus',
  'order_status',
  'commissionstatus',
  'commission_status',
  'status',
];

/**
 * Throws 400 Bad Request if any client attempts to override authoritative commission fields,
 * and records a security audit log entry.
 */
export function assertNoCommissionFieldOverrides(
  payload: any,
  endpointName: string = 'Commission',
  userId?: string
): void {
  if (!payload || typeof payload !== 'object') return;
  const keys = Object.keys(payload);
  const violations: string[] = [];

  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
    if (FORBIDDEN_CLIENT_COMMISSION_FIELDS.includes(normalized)) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    // Record high-severity security audit log
    AuditService.recordLog({
      userId: userId || undefined,
      action: 'COMMISSION_SECURITY_VIOLATION_PAYLOAD_TAMPERING',
      entityType: 'CommissionSecurityAlert',
      entityId: violations.join(','),
      oldValue: null,
      newValue: {
        violations,
        endpoint: endpointName,
        attemptedPayload: payload,
      },
    }).catch(() => {});

    throw AppError.badRequest(
      `Direct client specification of commission parameters (${violations.join(
        ', '
      )}) is strictly prohibited on ${endpointName}. The backend authoritatively calculates Business Volume (BV), upline tree lineage, commission levels (1-5), percentages (24%, 8%, 13%, 5%, 4%), payout amounts, and qualification eligibility.`,
      'FORBIDDEN_COMMISSION_FIELD_INJECTION'
    );
  }
}

// ----------------------------------------------------------------------------
// MEMBER PARAMETER SCHEMAS
// ----------------------------------------------------------------------------

export const memberIdParamSchema = z.object({
  memberId: z.string().trim().min(1, 'Member identifier is required'),
});

export const memberCommissionParamsSchema = z.object({
  memberId: z.string().trim().min(1, 'Member identifier is required'),
  commissionId: z.string().trim().min(1, 'Commission identifier is required'),
});

// ----------------------------------------------------------------------------
// MEMBER QUERY SCHEMAS
// ----------------------------------------------------------------------------

export const memberCommissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['PENDING', 'APPROVED', 'AVAILABLE', 'PAID', 'CANCELLED', 'REVERSED'])
    .optional(),
  level: z.coerce.number().int().min(1).max(5).optional(),
  commissionLevel: z.coerce.number().int().min(1).max(5).optional(),
  orderId: z.string().trim().optional(),
  sourceMemberId: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

// ----------------------------------------------------------------------------
// ADMIN PARAMETER & QUERY SCHEMAS
// ----------------------------------------------------------------------------

export const adminOrderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'Order identifier is required'),
});

export const adminCommissionIdParamSchema = z.object({
  commissionId: z.string().trim().min(1, 'Commission identifier is required'),
});

export const adminCommissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  member: z.string().trim().optional(),
  recipientId: z.string().trim().optional(),
  sourceMember: z.string().trim().optional(),
  sourceMemberId: z.string().trim().optional(),
  order: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
  level: z.coerce.number().int().min(1).max(5).optional(),
  commissionLevel: z.coerce.number().int().min(1).max(5).optional(),
  status: z
    .enum(['PENDING', 'APPROVED', 'AVAILABLE', 'PAID', 'CANCELLED', 'REVERSED'])
    .optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

// ----------------------------------------------------------------------------
// ADMIN BODY SCHEMAS WITH ZERO-TRUST INVARIANTS
// ----------------------------------------------------------------------------

export const adminProcessOrderCommissionBodySchema = z
  .record(z.any())
  .optional()
  .refine(
    (body) => {
      if (body) {
        assertNoCommissionFieldOverrides(body, 'Process Order Commission');
      }
      return true;
    },
    {
      message:
        'Client cannot inject commission amount, percentage, recipientId, or BV.',
    }
  );

export const adminReverseCommissionBodySchema = z
  .object({
    reason: z.string().trim().optional(),
  })
  .passthrough()
  .refine(
    (body) => {
      if (body) {
        assertNoCommissionFieldOverrides(body, 'Commission Reversal');
      }
      return true;
    },
    {
      message:
        'Client cannot inject commission amount, percentage, recipientId, or BV into reversal request.',
    }
  );
