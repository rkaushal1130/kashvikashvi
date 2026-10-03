-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DISTRIBUTOR', 'CUSTOMER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "DistributorStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PlacementPosition" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING', 'LEGAL');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE_RECEIPT', 'ORDER_FULFILLMENT', 'ADJUSTMENT', 'RETURN', 'TRANSFER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'WALLET', 'BANK_TRANSFER', 'CRYPTO', 'UPI');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BVTransactionType" AS ENUM ('ORDER_ACCRUAL', 'COMMISSION_DEDUCTION', 'MANUAL_ADJUSTMENT', 'FLUSH', 'CARRYOVER');

-- CreateEnum
CREATE TYPE "CommissionPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'CALCULATING', 'FINALIZED', 'PAID');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('BINARY_MATCH', 'DIRECT_REFERRAL', 'FAST_START', 'MATCHING_BONUS', 'RANK_ACHIEVEMENT', 'LEADERSHIP_POOL');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('FAST_START', 'CAR_BONUS', 'LIFESTYLE_BONUS', 'RANK_BONUS', 'GLOBAL_POOL');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('COMMISSION_CREDIT', 'BONUS_CREDIT', 'ORDER_PAYMENT', 'PAYOUT_WITHDRAWAL', 'PEER_TRANSFER_DEBIT', 'PEER_TRANSFER_CREDIT', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT,
    "roleName" "UserRole" NOT NULL DEFAULT 'DISTRIBUTOR',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "distributorCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "status" "DistributorStatus" NOT NULL DEFAULT 'PENDING',
    "currentRankId" TEXT,
    "highestRankId" TEXT,
    "sponsorId" TEXT,
    "lifetimePV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "lifetimeGV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_status_history" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "previousStatus" "DistributorStatus" NOT NULL,
    "newStatus" "DistributorStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "sponsorId" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_relationships" (
    "id" TEXT NOT NULL,
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsor_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_centers" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "centerNumber" INTEGER NOT NULL DEFAULT 1,
    "centerCode" TEXT NOT NULL,
    "status" "CenterStatus" NOT NULL DEFAULT 'ACTIVE',
    "leftVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rightVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "accumulatedLeftVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "accumulatedRightVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mlm_nodes" (
    "id" TEXT NOT NULL,
    "businessCenterId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "placementParentId" TEXT,
    "placementPosition" "PlacementPosition",
    "depth" INTEGER NOT NULL DEFAULT 0,
    "binaryPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mlm_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT,
    "streetAddress" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_profiles" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "status" "KYCStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "idType" TEXT,
    "idNumber" TEXT,
    "documentFrontUrl" TEXT,
    "documentBackUrl" TEXT,
    "selfieUrl" TEXT,
    "taxIdNumber" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "status" "BankAccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "routingNumber" TEXT,
    "branchName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),
    "securityQuestion" TEXT,
    "securityAnswerHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "retailPrice" DECIMAL(12,2) NOT NULL,
    "distributorPrice" DECIMAL(12,2) NOT NULL,
    "bv" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "costPrice" DECIMAL(12,2),
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAutoShipEligible" BOOLEAN NOT NULL DEFAULT true,
    "weightKg" DECIMAL(6,2),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 10,
    "warehouseLocation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "distributorId" TEXT,
    "customerId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "shippingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "shippingAddressId" TEXT NOT NULL,
    "billingAddressId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "totalBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "gatewayTransactionId" TEXT,
    "gatewayResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bv_ledgers" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "businessCenterId" TEXT,
    "orderId" TEXT,
    "type" "BVTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "position" "PlacementPosition",
    "sourceDistributorId" TEXT,
    "commissionPeriodId" TEXT,
    "balanceAfter" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bv_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_periods" (
    "id" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CommissionPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "totalCommissionsCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalBVProcessed" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "lockedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixedAmount" DECIMAL(12,2),
    "minPersonalBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "minGroupBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "maxPayoutCap" DECIMAL(12,2),
    "rankRequiredId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "commissionNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "businessCenterId" TEXT,
    "periodId" TEXT NOT NULL,
    "ruleId" TEXT,
    "type" "CommissionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'CALCULATED',
    "leftVolumeMatched" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rightVolumeMatched" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payoutDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonuses" (
    "id" TEXT NOT NULL,
    "bonusNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "periodId" TEXT,
    "type" "BonusType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "pendingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalWithdrawn" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(12,2) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "walletTransactionId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "processedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranks" (
    "id" TEXT NOT NULL,
    "rankCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "minPersonalBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "minGroupBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "minActiveLegs" INTEGER NOT NULL DEFAULT 0,
    "binaryWeeklyCap" DECIMAL(12,2) NOT NULL,
    "oneTimeBonus" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_rank_history" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "periodId" TEXT,
    "personalBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "groupBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_rank_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "criteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_badges" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "minRankRequiredId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_lessons" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_progress" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_websites" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL,
    "bio" TEXT,
    "bannerUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "socialLinks" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_links" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "conversionsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "assignedToId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "enrollmentNumber" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "prospectEmail" TEXT NOT NULL,
    "prospectPhone" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "selectedPackage" TEXT,
    "placementParentId" TEXT,
    "placementPosition" "PlacementPosition",
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_steps" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "stepData" JSONB,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "enrollment_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'STRING',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleName_idx" ON "users"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_profiles_userId_key" ON "distributor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_profiles_distributorCode_key" ON "distributor_profiles"("distributorCode");

-- CreateIndex
CREATE INDEX "distributor_profiles_distributorCode_idx" ON "distributor_profiles"("distributorCode");

-- CreateIndex
CREATE INDEX "distributor_profiles_sponsorId_idx" ON "distributor_profiles"("sponsorId");

-- CreateIndex
CREATE INDEX "distributor_profiles_status_idx" ON "distributor_profiles"("status");

-- CreateIndex
CREATE INDEX "distributor_profiles_currentRankId_idx" ON "distributor_profiles"("currentRankId");

-- CreateIndex
CREATE INDEX "distributor_status_history_distributorId_idx" ON "distributor_status_history"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_userId_key" ON "customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerCode_key" ON "customers"("customerCode");

-- CreateIndex
CREATE INDEX "customers_customerCode_idx" ON "customers"("customerCode");

-- CreateIndex
CREATE INDEX "customers_sponsorId_idx" ON "customers"("sponsorId");

-- CreateIndex
CREATE INDEX "sponsor_relationships_ancestorId_idx" ON "sponsor_relationships"("ancestorId");

-- CreateIndex
CREATE INDEX "sponsor_relationships_descendantId_idx" ON "sponsor_relationships"("descendantId");

-- CreateIndex
CREATE INDEX "sponsor_relationships_depth_idx" ON "sponsor_relationships"("depth");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_relationships_ancestorId_descendantId_key" ON "sponsor_relationships"("ancestorId", "descendantId");

-- CreateIndex
CREATE UNIQUE INDEX "business_centers_centerCode_key" ON "business_centers"("centerCode");

-- CreateIndex
CREATE INDEX "business_centers_distributorId_idx" ON "business_centers"("distributorId");

-- CreateIndex
CREATE INDEX "business_centers_status_idx" ON "business_centers"("status");

-- CreateIndex
CREATE INDEX "business_centers_centerCode_idx" ON "business_centers"("centerCode");

-- CreateIndex
CREATE UNIQUE INDEX "business_centers_distributorId_centerNumber_key" ON "business_centers"("distributorId", "centerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "mlm_nodes_businessCenterId_key" ON "mlm_nodes"("businessCenterId");

-- CreateIndex
CREATE INDEX "mlm_nodes_placementParentId_idx" ON "mlm_nodes"("placementParentId");

-- CreateIndex
CREATE INDEX "mlm_nodes_distributorId_idx" ON "mlm_nodes"("distributorId");

-- CreateIndex
CREATE INDEX "mlm_nodes_businessCenterId_idx" ON "mlm_nodes"("businessCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "mlm_nodes_placementParentId_placementPosition_key" ON "mlm_nodes"("placementParentId", "placementPosition");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_profiles_distributorId_key" ON "kyc_profiles"("distributorId");

-- CreateIndex
CREATE INDEX "kyc_profiles_status_idx" ON "kyc_profiles"("status");

-- CreateIndex
CREATE INDEX "bank_accounts_distributorId_idx" ON "bank_accounts"("distributorId");

-- CreateIndex
CREATE INDEX "bank_accounts_status_idx" ON "bank_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "security_profiles_userId_key" ON "security_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_slug_idx" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_parentId_idx" ON "product_categories"("parentId");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_productId_key" ON "inventories"("productId");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventoryId_idx" ON "inventory_transactions"("inventoryId");

-- CreateIndex
CREATE INDEX "inventory_transactions_productId_idx" ON "inventory_transactions"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_customerId_key" ON "carts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_key" ON "cart_items"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_distributorId_idx" ON "orders"("distributorId");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayTransactionId_key" ON "payments"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "payments_paymentNumber_idx" ON "payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "bv_ledgers_distributorId_idx" ON "bv_ledgers"("distributorId");

-- CreateIndex
CREATE INDEX "bv_ledgers_businessCenterId_idx" ON "bv_ledgers"("businessCenterId");

-- CreateIndex
CREATE INDEX "bv_ledgers_commissionPeriodId_idx" ON "bv_ledgers"("commissionPeriodId");

-- CreateIndex
CREATE INDEX "bv_ledgers_orderId_idx" ON "bv_ledgers"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_periods_periodCode_key" ON "commission_periods"("periodCode");

-- CreateIndex
CREATE INDEX "commission_periods_periodCode_idx" ON "commission_periods"("periodCode");

-- CreateIndex
CREATE INDEX "commission_periods_status_idx" ON "commission_periods"("status");

-- CreateIndex
CREATE INDEX "commission_periods_startDate_endDate_idx" ON "commission_periods"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "commission_rules_ruleCode_key" ON "commission_rules"("ruleCode");

-- CreateIndex
CREATE INDEX "commission_rules_ruleCode_idx" ON "commission_rules"("ruleCode");

-- CreateIndex
CREATE INDEX "commission_rules_type_idx" ON "commission_rules"("type");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_commissionNumber_key" ON "commissions"("commissionNumber");

-- CreateIndex
CREATE INDEX "commissions_commissionNumber_idx" ON "commissions"("commissionNumber");

-- CreateIndex
CREATE INDEX "commissions_distributorId_idx" ON "commissions"("distributorId");

-- CreateIndex
CREATE INDEX "commissions_periodId_idx" ON "commissions"("periodId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_businessCenterId_idx" ON "commissions"("businessCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "bonuses_bonusNumber_key" ON "bonuses"("bonusNumber");

-- CreateIndex
CREATE INDEX "bonuses_bonusNumber_idx" ON "bonuses"("bonusNumber");

-- CreateIndex
CREATE INDEX "bonuses_distributorId_idx" ON "bonuses"("distributorId");

-- CreateIndex
CREATE INDEX "bonuses_periodId_idx" ON "bonuses"("periodId");

-- CreateIndex
CREATE INDEX "bonuses_status_idx" ON "bonuses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_transactionNumber_key" ON "wallet_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "wallet_transactions_transactionNumber_idx" ON "wallet_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "wallet_transactions_referenceId_idx" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_payoutNumber_key" ON "payout_requests"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_walletTransactionId_key" ON "payout_requests"("walletTransactionId");

-- CreateIndex
CREATE INDEX "payout_requests_payoutNumber_idx" ON "payout_requests"("payoutNumber");

-- CreateIndex
CREATE INDEX "payout_requests_distributorId_idx" ON "payout_requests"("distributorId");

-- CreateIndex
CREATE INDEX "payout_requests_status_idx" ON "payout_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_rankCode_key" ON "ranks"("rankCode");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_level_key" ON "ranks"("level");

-- CreateIndex
CREATE INDEX "ranks_level_idx" ON "ranks"("level");

-- CreateIndex
CREATE INDEX "distributor_rank_history_distributorId_idx" ON "distributor_rank_history"("distributorId");

-- CreateIndex
CREATE INDEX "distributor_rank_history_rankId_idx" ON "distributor_rank_history"("rankId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_badgeCode_key" ON "badges"("badgeCode");

-- CreateIndex
CREATE INDEX "distributor_badges_distributorId_idx" ON "distributor_badges"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_badges_distributorId_badgeId_key" ON "distributor_badges"("distributorId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "training_courses_slug_key" ON "training_courses"("slug");

-- CreateIndex
CREATE INDEX "training_lessons_courseId_idx" ON "training_lessons"("courseId");

-- CreateIndex
CREATE INDEX "training_progress_distributorId_idx" ON "training_progress"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "training_progress_distributorId_lessonId_key" ON "training_progress"("distributorId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_websites_distributorId_key" ON "distributor_websites"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_websites_subdomain_key" ON "distributor_websites"("subdomain");

-- CreateIndex
CREATE INDEX "distributor_websites_subdomain_idx" ON "distributor_websites"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "website_links_slug_key" ON "website_links"("slug");

-- CreateIndex
CREATE INDEX "website_links_websiteId_idx" ON "website_links"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_slug_idx" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_isPublished_idx" ON "news"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_ticketNumber_idx" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_idx" ON "support_messages"("ticketId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_enrollmentNumber_key" ON "enrollments"("enrollmentNumber");

-- CreateIndex
CREATE INDEX "enrollments_enrollmentNumber_idx" ON "enrollments"("enrollmentNumber");

-- CreateIndex
CREATE INDEX "enrollments_sponsorId_idx" ON "enrollments"("sponsorId");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_steps_enrollmentId_stepNumber_key" ON "enrollment_steps"("enrollmentId", "stepNumber");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_profiles" ADD CONSTRAINT "distributor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_profiles" ADD CONSTRAINT "distributor_profiles_currentRankId_fkey" FOREIGN KEY ("currentRankId") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_profiles" ADD CONSTRAINT "distributor_profiles_highestRankId_fkey" FOREIGN KEY ("highestRankId") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_profiles" ADD CONSTRAINT "distributor_profiles_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "distributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_status_history" ADD CONSTRAINT "distributor_status_history_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "distributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_relationships" ADD CONSTRAINT "sponsor_relationships_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_relationships" ADD CONSTRAINT "sponsor_relationships_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_centers" ADD CONSTRAINT "business_centers_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlm_nodes" ADD CONSTRAINT "mlm_nodes_businessCenterId_fkey" FOREIGN KEY ("businessCenterId") REFERENCES "business_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlm_nodes" ADD CONSTRAINT "mlm_nodes_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlm_nodes" ADD CONSTRAINT "mlm_nodes_placementParentId_fkey" FOREIGN KEY ("placementParentId") REFERENCES "mlm_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_profiles" ADD CONSTRAINT "security_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_sourceDistributorId_fkey" FOREIGN KEY ("sourceDistributorId") REFERENCES "distributor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_businessCenterId_fkey" FOREIGN KEY ("businessCenterId") REFERENCES "business_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_commissionPeriodId_fkey" FOREIGN KEY ("commissionPeriodId") REFERENCES "commission_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_rankRequiredId_fkey" FOREIGN KEY ("rankRequiredId") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_businessCenterId_fkey" FOREIGN KEY ("businessCenterId") REFERENCES "business_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "commission_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "commission_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_rank_history" ADD CONSTRAINT "distributor_rank_history_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_rank_history" ADD CONSTRAINT "distributor_rank_history_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_rank_history" ADD CONSTRAINT "distributor_rank_history_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "commission_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_badges" ADD CONSTRAINT "distributor_badges_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_badges" ADD CONSTRAINT "distributor_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_minRankRequiredId_fkey" FOREIGN KEY ("minRankRequiredId") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "training_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_websites" ADD CONSTRAINT "distributor_websites_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_links" ADD CONSTRAINT "website_links_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "distributor_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "distributor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_steps" ADD CONSTRAINT "enrollment_steps_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

