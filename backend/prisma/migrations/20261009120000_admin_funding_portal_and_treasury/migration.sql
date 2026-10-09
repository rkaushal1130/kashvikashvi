-- ============================================================================
-- ADMIN FUNDING PORTAL & PLATFORM TREASURY LEDGER MIGRATION
-- Migration: 20261009120000_admin_funding_portal_and_treasury
-- ============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
  CREATE TYPE "PlatformTransactionType" AS ENUM (
    'FUNDING',
    'FUNDING_REVERSAL',
    'COMMISSION_RESERVE',
    'PAYOUT',
    'ADJUSTMENT',
    'REFUND',
    'RECONCILIATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformTransactionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED',
    'REVERSED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FundingAccountStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'DISCONNECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FundingTransactionStatus" AS ENUM (
    'CREATED',
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'REVERSED',
    'RECONCILIATION_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create PlatformWallet table
CREATE TABLE IF NOT EXISTS "platform_wallets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletCode" TEXT NOT NULL DEFAULT 'PRIMARY_TREASURY',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "availableBalance" DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  "pendingBalance" DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_platform_wallet_available_positive" CHECK ("availableBalance" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_wallets_walletCode_key" ON "platform_wallets"("walletCode");

-- 3. Create PlatformWalletTransaction table (Immutable Treasury Ledger)
CREATE TABLE IF NOT EXISTS "platform_wallet_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "transactionNumber" TEXT NOT NULL,
  "type" "PlatformTransactionType" NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "balanceBefore" DECIMAL(14, 2) NOT NULL,
  "balanceAfter" DECIMAL(14, 2) NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT,
  "externalTransactionId" TEXT,
  "providerTransactionId" TEXT,
  "idempotencyKey" TEXT,
  "status" "PlatformTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "performedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_platform_wallet_txn_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "fk_platform_wallet_txns_wallet" FOREIGN KEY ("walletId") REFERENCES "platform_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_wallet_transactions_transactionNumber_key" ON "platform_wallet_transactions"("transactionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_wallet_transactions_idempotencyKey_key" ON "platform_wallet_transactions"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_walletId_idx" ON "platform_wallet_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_type_idx" ON "platform_wallet_transactions"("type");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_status_idx" ON "platform_wallet_transactions"("status");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_reference_idx" ON "platform_wallet_transactions"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_externalTxnId_idx" ON "platform_wallet_transactions"("externalTransactionId");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_providerTxnId_idx" ON "platform_wallet_transactions"("providerTransactionId");
CREATE INDEX IF NOT EXISTS "platform_wallet_transactions_createdAt_idx" ON "platform_wallet_transactions"("createdAt");

-- 4. Create FundingAccount table (Verified Corporate Accounts)
CREATE TABLE IF NOT EXISTS "funding_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "maskedAccountNumber" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "FundingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "funding_accounts_provider_providerAccountId_key" ON "funding_accounts"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "funding_accounts_provider_idx" ON "funding_accounts"("provider");
CREATE INDEX IF NOT EXISTS "funding_accounts_status_idx" ON "funding_accounts"("status");
CREATE INDEX IF NOT EXISTS "funding_accounts_isPrimary_idx" ON "funding_accounts"("isPrimary");

-- 5. Create FundingTransaction table (Audit-Tracked Funding Lifecycle)
CREATE TABLE IF NOT EXISTS "funding_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fundingAccountId" TEXT NOT NULL,
  "initiatedByAdminId" TEXT NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "FundingTransactionStatus" NOT NULL DEFAULT 'CREATED',
  "provider" TEXT NOT NULL,
  "providerTransactionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "platformWalletTransactionId" TEXT,
  "failureReason" TEXT,
  "metadata" JSONB,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_funding_txn_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "fk_funding_txns_account" FOREIGN KEY ("fundingAccountId") REFERENCES "funding_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_funding_txns_admin" FOREIGN KEY ("initiatedByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_funding_txns_wallet_txn" FOREIGN KEY ("platformWalletTransactionId") REFERENCES "platform_wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "funding_transactions_idempotencyKey_key" ON "funding_transactions"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "funding_transactions_platformWalletTransactionId_key" ON "funding_transactions"("platformWalletTransactionId") WHERE "platformWalletTransactionId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "funding_transactions_provider_providerTxnId_key" ON "funding_transactions"("provider", "providerTransactionId") WHERE "providerTransactionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "funding_transactions_fundingAccountId_idx" ON "funding_transactions"("fundingAccountId");
CREATE INDEX IF NOT EXISTS "funding_transactions_initiatedByAdminId_idx" ON "funding_transactions"("initiatedByAdminId");
CREATE INDEX IF NOT EXISTS "funding_transactions_status_idx" ON "funding_transactions"("status");
CREATE INDEX IF NOT EXISTS "funding_transactions_provider_idx" ON "funding_transactions"("provider");
CREATE INDEX IF NOT EXISTS "funding_transactions_initiatedAt_idx" ON "funding_transactions"("initiatedAt");
CREATE INDEX IF NOT EXISTS "funding_transactions_createdAt_idx" ON "funding_transactions"("createdAt");

-- 6. Create WebhookEvent table (Provider Inbound Webhook Idempotency Ledger)
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "metadata" JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_externalEventId_key" ON "webhook_events"("provider", "externalEventId");
CREATE INDEX IF NOT EXISTS "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE INDEX IF NOT EXISTS "webhook_events_externalEventId_idx" ON "webhook_events"("externalEventId");
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" ON "webhook_events"("status");
CREATE INDEX IF NOT EXISTS "webhook_events_processedAt_idx" ON "webhook_events"("processedAt");
