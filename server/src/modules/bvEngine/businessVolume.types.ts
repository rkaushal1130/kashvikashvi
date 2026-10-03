export type BvTransactionStatus = 'PENDING' | 'APPROVED' | 'CANCELLED' | 'REFUNDED';

export type BvTransactionType =
  | 'PURCHASE'
  | 'SALE'
  | 'BONUS'
  | 'ADJUSTMENT'
  | 'PERSONAL_ORDER'
  | 'REFUND_REVERSAL';

export interface BvTransaction {
  id: string;
  distributorId: string; // member_id e.g. 'KV-1001'
  distributorDbId?: string;
  orderId: string;
  amount: number;
  businessVolume: number;
  type: BvTransactionType;
  status: BvTransactionStatus;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface CreateBvTransactionInput {
  distributorId: string;
  orderId?: string;
  amount: number;
  businessVolume: number;
  type?: BvTransactionType;
  status?: BvTransactionStatus;
  description?: string;
}

export interface BvSummaryResult {
  distributorId: string;
  personalBV: number;
  leftTeamBV: number;
  rightTeamBV: number;
  totalTeamBV: number;
  totalNetworkBV: number;
}

export interface TeamVolumeResult {
  distributorId: string;
  team: 'LEFT' | 'RIGHT' | 'TOTAL';
  leg?: 'LEFT' | 'RIGHT' | 'TOTAL';
  businessVolume: number;
  memberCount: number;
  details: {
    distributorId: string;
    name: string;
    position: 'LEFT' | 'RIGHT';
    personalBV: number;
  }[];
}
