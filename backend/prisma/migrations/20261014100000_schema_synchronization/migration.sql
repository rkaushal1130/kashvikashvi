-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_KYC', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BVSourceType" AS ENUM ('ORDER', 'ORDER_REFUND', 'ADJUSTMENT', 'BONUS', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CommissionRuleType" AS ENUM ('BASE', 'PC_ORDER', 'MILESTONE', 'FRONTLINE', 'BINARY', 'RANK', 'LEVEL_COMMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "CommissionTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'AVAILABLE', 'PAID', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingCourseCategory" AS ENUM ('ORIENTATION', 'BUSINESS_SETUP', 'PRODUCT', 'ETHICS', 'MARKETING', 'TOOLS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommissionPeriodStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "CommissionPeriodStatus" ADD VALUE 'CALCULATED';
ALTER TYPE "CommissionPeriodStatus" ADD VALUE 'APPROVED';
ALTER TYPE "CommissionPeriodStatus" ADD VALUE 'CLOSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommissionStatus" ADD VALUE 'PENDING';
ALTER TYPE "CommissionStatus" ADD VALUE 'QUALIFIED';
ALTER TYPE "CommissionStatus" ADD VALUE 'REVERSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommissionType" ADD VALUE 'BASE';
ALTER TYPE "CommissionType" ADD VALUE 'PC_ORDER';
ALTER TYPE "CommissionType" ADD VALUE 'MILESTONE';
ALTER TYPE "CommissionType" ADD VALUE 'FRONTLINE';
ALTER TYPE "CommissionType" ADD VALUE 'BINARY';
ALTER TYPE "CommissionType" ADD VALUE 'RANK';
ALTER TYPE "CommissionType" ADD VALUE 'OTHER';

-- AlterEnum
BEGIN;
CREATE TYPE "EnrollmentStatus_new" AS ENUM ('DRAFT', 'PENDING', 'KYC_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');
ALTER TABLE "public"."enrollments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "enrollments" ALTER COLUMN "status" TYPE "EnrollmentStatus_new" USING ("status"::text::"EnrollmentStatus_new");
ALTER TYPE "EnrollmentStatus" RENAME TO "EnrollmentStatus_old";
ALTER TYPE "EnrollmentStatus_new" RENAME TO "EnrollmentStatus";
DROP TYPE "public"."EnrollmentStatus_old";
ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LevelCommissionStatus_new" AS ENUM ('CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', 'REVERSED', 'FORFEITED');
ALTER TABLE "public"."level_commissions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "level_commissions" ALTER COLUMN "status" TYPE "LevelCommissionStatus_new" USING ("status"::text::"LevelCommissionStatus_new");
ALTER TYPE "LevelCommissionStatus" RENAME TO "LevelCommissionStatus_old";
ALTER TYPE "LevelCommissionStatus_new" RENAME TO "LevelCommissionStatus";
DROP TYPE "public"."LevelCommissionStatus_old";
ALTER TABLE "level_commissions" ALTER COLUMN "status" SET DEFAULT 'CALCULATED';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayoutStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "PayoutStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PayoutStatus" ADD VALUE 'PAID';
ALTER TYPE "PayoutStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'INACTIVE';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'CREDIT';
ALTER TYPE "WalletTransactionType" ADD VALUE 'DEBIT';
ALTER TYPE "WalletTransactionType" ADD VALUE 'COMMISSION';
ALTER TYPE "WalletTransactionType" ADD VALUE 'PAYOUT';
ALTER TYPE "WalletTransactionType" ADD VALUE 'REFUND';
ALTER TYPE "WalletTransactionType" ADD VALUE 'ADJUSTMENT';
ALTER TYPE "WalletTransactionType" ADD VALUE 'REVERSAL';

-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_periodId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_billingAddressId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_shippingAddressId_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_userId_fkey";

-- DropIndex
DROP INDEX "bv_ledgers_orderId_idx";

-- DropIndex
DROP INDEX "commission_rules_ruleCode_idx";

-- AlterTable
ALTER TABLE "business_centers" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "bv_ledgers" ADD COLUMN IF NOT EXISTS "bv" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "sourceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "sourceType" "BVSourceType" NOT NULL DEFAULT 'ORDER',
ALTER COLUMN "type" SET DEFAULT 'ORDER_ACCRUAL',
ALTER COLUMN "amount" SET DEFAULT 0.00,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "commission_levels" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "commission_periods" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
ALTER COLUMN "periodCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "configurationJson" JSONB,
ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "ruleCode" DROP NOT NULL,
DROP COLUMN "type",
ADD COLUMN IF NOT EXISTS "type" "CommissionRuleType" NOT NULL;

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "businessReference" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "details" JSONB,
ADD COLUMN IF NOT EXISTS "sourceDistributorId" TEXT,
ADD COLUMN IF NOT EXISTS "sourceOrderId" TEXT,
ALTER COLUMN "periodId" DROP NOT NULL,
DROP COLUMN "type",
ADD COLUMN IF NOT EXISTS "type" "CommissionRuleType" NOT NULL DEFAULT 'BASE';

-- AlterTable
ALTER TABLE "distributor_profiles" ADD COLUMN IF NOT EXISTS "distributorId" TEXT,
ADD COLUMN IF NOT EXISTS "rankId" TEXT;

-- AlterTable
ALTER TABLE "distributor_websites" ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "logo" TEXT,
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'LIGHT',
ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'My KASHVIMLM Store',
ALTER COLUMN "siteTitle" DROP NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "businessCenterId" TEXT,
ADD COLUMN IF NOT EXISTS "createdUserId" TEXT,
ADD COLUMN IF NOT EXISTS "currentStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "enrollmentType" "UserRole" NOT NULL DEFAULT 'DISTRIBUTOR',
ADD COLUMN IF NOT EXISTS "legalName" TEXT,
ADD COLUMN IF NOT EXISTS "packageBV" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "packagePrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "securityPinHash" TEXT,
ADD COLUMN IF NOT EXISTS "starterKitId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "funding_accounts" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "funding_transactions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "level_commissions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "levels" ADD COLUMN IF NOT EXISTS "requiredLeftMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "requiredRightMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "member_level_histories" ADD COLUMN IF NOT EXISTS "newLevelCode" TEXT,
ADD COLUMN IF NOT EXISTS "previousLeftMatching" DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "previousLevelCode" TEXT,
ADD COLUMN IF NOT EXISTS "previousRightMatching" DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "qualifyingLeftMatching" DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "qualifyingRightMatching" DECIMAL(12,2) DEFAULT 0.00,
ALTER COLUMN "reason" SET DEFAULT 'LEVEL_REQUIREMENTS_MET',
ALTER COLUMN "source" SET DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "authorId" TEXT,
ADD COLUMN IF NOT EXISTS "image" TEXT,
ADD COLUMN IF NOT EXISTS "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "publishedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "userId" TEXT,
ALTER COLUMN "shippingAddressId" DROP NOT NULL,
ALTER COLUMN "billingAddressId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "platform_wallets" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "categoryCode" TEXT,
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "wholesalePrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "retailPrice" SET DEFAULT 0.00,
ALTER COLUMN "distributorPrice" SET DEFAULT 0.00,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "security_profiles" ADD COLUMN IF NOT EXISTS "securityPinHash" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" DROP COLUMN "category",
ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "distributorId" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "category" "TrainingCourseCategory" NOT NULL DEFAULT 'ORIENTATION';

-- AlterTable
ALTER TABLE "training_progress" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "commissionTransactionId" TEXT,
ADD COLUMN IF NOT EXISTS "memberId" TEXT,
ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "distributorId" TEXT,
ADD COLUMN IF NOT EXISTS "lifetimeEarned" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "lifetimePaid" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "website_links" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL DEFAULT 'Shop Products',
ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL DEFAULT '/',
ALTER COLUMN "slug" DROP NOT NULL,
ALTER COLUMN "targetUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutProvider" TEXT NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
    "externalTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "bankAccountId" TEXT,
    "payoutRequestId" TEXT,
    "walletTransactionId" TEXT,
    "platformTransactionId" TEXT,
    "failureReason" TEXT,
    "adminNotes" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "commission_transactions" (
    "id" TEXT NOT NULL,
    "recipientMemberId" TEXT NOT NULL,
    "sourceMemberId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "commissionLevel" INTEGER NOT NULL,
    "businessVolume" DECIMAL(12,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grossCommissionAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'ORDER_PURCHASE',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "walletTransactionId" TEXT,
    "calculationDetails" JSONB,
    "reversalReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "commission_reversals" (
    "id" TEXT NOT NULL,
    "originalCommissionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "refundId" TEXT,
    "recipientMemberId" TEXT NOT NULL,
    "commissionLevel" INTEGER NOT NULL,
    "reversedBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "recoveryStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "unrecoveredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "walletTransactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_payoutRequestId_key" ON "withdrawal_requests"("payoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_walletTransactionId_key" ON "withdrawal_requests"("walletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_idempotencyKey_key" ON "withdrawal_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawal_requests_memberId_idx" ON "withdrawal_requests"("memberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawal_requests_createdAt_idx" ON "withdrawal_requests"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawal_requests_externalTransactionId_idx" ON "withdrawal_requests"("externalTransactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawal_requests_idempotencyKey_idx" ON "withdrawal_requests"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_family_idx" ON "sessions"("family");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commission_transactions_idempotencyKey_key" ON "commission_transactions"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commission_transactions_walletTransactionId_key" ON "commission_transactions"("walletTransactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_recipientMemberId_status_idx" ON "commission_transactions"("recipientMemberId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_recipientMemberId_commissionLevel_idx" ON "commission_transactions"("recipientMemberId", "commissionLevel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_recipientMemberId_createdAt_idx" ON "commission_transactions"("recipientMemberId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_sourceMemberId_idx" ON "commission_transactions"("sourceMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_orderId_idx" ON "commission_transactions"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_commissionLevel_idx" ON "commission_transactions"("commissionLevel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_status_idx" ON "commission_transactions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_transactions_createdAt_idx" ON "commission_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commission_transactions_orderId_recipientMemberId_commissio_key" ON "commission_transactions"("orderId", "recipientMemberId", "commissionLevel");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commission_reversals_idempotencyKey_key" ON "commission_reversals"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_originalCommissionId_idx" ON "commission_reversals"("originalCommissionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_orderId_idx" ON "commission_reversals"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_recipientMemberId_idx" ON "commission_reversals"("recipientMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_recipientMemberId_createdAt_idx" ON "commission_reversals"("recipientMemberId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_refundId_idx" ON "commission_reversals"("refundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_recoveryStatus_idx" ON "commission_reversals"("recoveryStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_reversals_createdAt_idx" ON "commission_reversals"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_centers_leftVolume_idx" ON "business_centers"("leftVolume");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_centers_rightVolume_idx" ON "business_centers"("rightVolume");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_centers_accumulatedLeftVolume_idx" ON "business_centers"("accumulatedLeftVolume");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_centers_accumulatedRightVolume_idx" ON "business_centers"("accumulatedRightVolume");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bv_ledgers_sourceType_idx" ON "bv_ledgers"("sourceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bv_ledgers_sourceId_idx" ON "bv_ledgers"("sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bv_ledgers_position_idx" ON "bv_ledgers"("position");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bv_ledgers_distributorId_position_idx" ON "bv_ledgers"("distributorId", "position");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bv_ledgers_createdAt_idx" ON "bv_ledgers"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_rules_type_idx" ON "commission_rules"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_rules_enabled_idx" ON "commission_rules"("enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_rules_priority_idx" ON "commission_rules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commissions_businessReference_key" ON "commissions"("businessReference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commissions_businessReference_idx" ON "commissions"("businessReference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commissions_type_idx" ON "commissions"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_profiles_distributorId_key" ON "distributor_profiles"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_profiles_userId_idx" ON "distributor_profiles"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_profiles_distributorId_idx" ON "distributor_profiles"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_profiles_rankId_idx" ON "distributor_profiles"("rankId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_websites_slug_key" ON "distributor_websites"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_websites_slug_idx" ON "distributor_websites"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "enrollments_prospectEmail_idx" ON "enrollments"("prospectEmail");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "funding_transactions_platformWalletTransactionId_key" ON "funding_transactions"("platformWalletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "funding_transactions_provider_providerTransactionId_key" ON "funding_transactions"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "levels_requiredBB_idx" ON "levels"("requiredBB");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "levels_requiredLeftMatching_idx" ON "levels"("requiredLeftMatching");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "levels_requiredRightMatching_idx" ON "levels"("requiredRightMatching");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_level_histories_memberId_newLevelId_key" ON "member_level_histories"("memberId", "newLevelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mlm_nodes_placementPosition_idx" ON "mlm_nodes"("placementPosition");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mlm_nodes_placementParentId_placementPosition_idx" ON "mlm_nodes"("placementParentId", "placementPosition");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mlm_nodes_binaryPath_idx" ON "mlm_nodes"("binaryPath");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "news_status_idx" ON "news"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "news_publishedAt_idx" ON "news"("publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "news_authorId_idx" ON "news"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_requests_requestedAt_idx" ON "payout_requests"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_wallet_transactions_idempotencyKey_key" ON "platform_wallet_transactions"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_categoryCode_key" ON "product_categories"("categoryCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_categories_categoryCode_idx" ON "product_categories"("categoryCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_isFeatured_idx" ON "products"("isFeatured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_distributorId_idx" ON "support_tickets"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "training_courses_category_idx" ON "training_courses"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wallet_transactions_memberId_idx" ON "wallet_transactions"("memberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wallet_transactions_commissionTransactionId_idx" ON "wallet_transactions"("commissionTransactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wallet_transactions_orderId_idx" ON "wallet_transactions"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_distributorId_key" ON "wallets"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wallets_distributorId_idx" ON "wallets"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "website_links_sortOrder_idx" ON "website_links"("sortOrder");

-- RenameForeignKey
ALTER TABLE "funding_transactions" RENAME CONSTRAINT "fk_funding_txns_account" TO "funding_transactions_fundingAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "funding_transactions" RENAME CONSTRAINT "fk_funding_txns_admin" TO "funding_transactions_initiatedByAdminId_fkey";

-- RenameForeignKey
ALTER TABLE "funding_transactions" RENAME CONSTRAINT "fk_funding_txns_wallet_txn" TO "funding_transactions_platformWalletTransactionId_fkey";

-- RenameForeignKey
ALTER TABLE "platform_wallet_transactions" RENAME CONSTRAINT "fk_platform_wallet_txns_wallet" TO "platform_wallet_transactions_walletId_fkey";

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "commission_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "distributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "distributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_reversals" ADD CONSTRAINT "commission_reversals_originalCommissionId_fkey" FOREIGN KEY ("originalCommissionId") REFERENCES "commission_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_reversals" ADD CONSTRAINT "commission_reversals_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_reversals" ADD CONSTRAINT "commission_reversals_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "distributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "platform_wallet_transactions_externalTxnId_idx" RENAME TO "platform_wallet_transactions_externalTransactionId_idx";

-- RenameIndex
ALTER INDEX "platform_wallet_transactions_providerTxnId_idx" RENAME TO "platform_wallet_transactions_providerTransactionId_idx";

-- RenameIndex
ALTER INDEX "platform_wallet_transactions_reference_idx" RENAME TO "platform_wallet_transactions_referenceType_referenceId_idx";

