/**
 * Immutable Audit Log Definitions & Tracked Action Types
 * For Enterprise Compliance, KYC, Financial Audits, and Security Forensics
 */

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  PRODUCT_DELETED = 'PRODUCT_DELETED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  BV_CREDIT = 'BV_CREDIT',
  BV_DEBIT = 'BV_DEBIT',
  COMMISSION_CREATED = 'COMMISSION_CREATED',
  COMMISSION_REVERSED = 'COMMISSION_REVERSED',
  WALLET_ADJUSTMENT = 'WALLET_ADJUSTMENT',
  PAYOUT_APPROVED = 'PAYOUT_APPROVED',
  PAYOUT_REJECTED = 'PAYOUT_REJECTED',
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',
  ADMIN_ACTION = 'ADMIN_ACTION',

  // MLM Binary Tree Audit Events (Prompt 16)
  SPONSOR_ASSIGNED = 'SPONSOR_ASSIGNED',
  DISTRIBUTOR_CREATED = 'DISTRIBUTOR_CREATED',
  TREE_MEMBER_PLACED = 'TREE_MEMBER_PLACED',
  TREE_MEMBER_MOVED = 'TREE_MEMBER_MOVED',
  TREE_MEMBER_REMOVED = 'TREE_MEMBER_REMOVED',
  TREE_POSITION_CHANGED = 'TREE_POSITION_CHANGED',
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId: string | null;
  memberId?: string | null;
  sponsorId?: string | null;
  placementParentId?: string | null;
  position?: string | null;
  reason?: string | null;
  oldValue: any | null;
  newValue: any | null;
  ipAddress: string | null;
  ip?: string | null;
  userAgent: string | null;
  createdAt: string;
  timestamp?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  } | null;
}

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  memberId?: string | null;
  sponsorId?: string | null;
  placementParentId?: string | null;
  position?: string | null;
  reason?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  timestamp?: string;
}

export interface TreeAuditLogParams {
  event: AuditAction | string;
  actorId?: string | null;
  memberId: string;
  sponsorId?: string | null;
  placementParentId?: string | null;
  position?: string | null;
  oldValue?: any;
  newValue?: any;
  ip?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: string;
  reason?: string | null;
}

export interface AdminMoveDistributorParams {
  adminId: string;
  memberId: string;
  oldParent: string;
  oldPosition: string;
  newParent: string;
  newPosition: string;
  reason: string;
  timestamp?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogFilterOptions {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  memberId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
