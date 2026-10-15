export interface ClientFundingOrderDTO {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REVERSED';
  paymentMethod: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  idempotencyKey: string;
  walletTransactionId: string | null;
  failureReason: string | null;
  metadata?: Record<string, any> | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientFundingOrderInput {
  amount: number;
  currency?: string;
  paymentMethod: 'RAZORPAY_UPI' | 'RAZORPAY_CARD' | 'RAZORPAY_NETBANKING' | 'BANK_WIRE';
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface VerifyClientFundingPaymentInput {
  orderId?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface BankAccountDTO {
  id: string;
  distributorId?: string;
  userId?: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  isPrimary: boolean;
  bankName: string;
  accountHolderName: string;
  accountNumber: string; // Masked for security e.g. "•••• •••• •••• 1234"
  routingNumber?: string | null; // IFSC code
  branchName?: string | null;
  providerVerificationId?: string | null;
  verificationStatus?: string | null;
  verificationMessage?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddBankAccountInput {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  isPrimary?: boolean;
}
