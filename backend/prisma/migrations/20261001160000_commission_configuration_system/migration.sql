-- ============================================================================
-- COMMISSION CONFIGURATION & LEVEL COMMISSION SYSTEM MIGRATION (PROMPTS 12 & 13)
-- ============================================================================

-- 1. Create Enum for Level Commission Status if not exists
DO $$ BEGIN
    CREATE TYPE "LevelCommissionStatus" AS ENUM ('CALCULATED', 'PAID', 'CANCELLED', 'CLAWED_BACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table: commission_levels
CREATE TABLE IF NOT EXISTS "commission_levels" (
    "id" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_levels_pkey" PRIMARY KEY ("id")
);

-- Constraints on commission_levels
ALTER TABLE "commission_levels"
  DROP CONSTRAINT IF EXISTS "check_commission_level_number",
  ADD CONSTRAINT "check_commission_level_number"
  CHECK ("levelNumber" >= 1 AND "levelNumber" <= 5);

ALTER TABLE "commission_levels"
  DROP CONSTRAINT IF EXISTS "check_commission_percentage_non_negative",
  ADD CONSTRAINT "check_commission_percentage_non_negative"
  CHECK ("percentage" >= 0.00);

-- Unique index on levelNumber
CREATE UNIQUE INDEX IF NOT EXISTS "commission_levels_levelNumber_key" 
  ON "commission_levels"("levelNumber");

-- Partial unique index ensuring only one active configuration exists for each level
CREATE UNIQUE INDEX IF NOT EXISTS "commission_levels_level_active_unique" 
  ON "commission_levels"("levelNumber") 
  WHERE "isActive" = true;

-- Query performance indexes
CREATE INDEX IF NOT EXISTS "commission_levels_levelNumber_idx" 
  ON "commission_levels"("levelNumber");

CREATE INDEX IF NOT EXISTS "commission_levels_isActive_idx" 
  ON "commission_levels"("isActive");

-- 3. Seed Canonical 5-Level Commission Configuration (Prompt 13 Requirements)
-- Level 1 = 24%, Level 2 = 8%, Level 3 = 13%, Level 4 = 5%, Level 5 = 4% (Total 54%)
INSERT INTO "commission_levels" ("id", "levelNumber", "percentage", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 1, 24.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2, 8.00,  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 13.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4, 5.00,  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 5, 4.00,  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("levelNumber") DO UPDATE 
SET 
  "percentage" = EXCLUDED."percentage",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

-- 4. Create Table: level_commissions (from Prompt 12 Architecture)
CREATE TABLE IF NOT EXISTS "level_commissions" (
    "id" TEXT NOT NULL,
    "commissionNumber" TEXT NOT NULL,
    "businessReference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "sourceDistributorId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "ratePercentage" DECIMAL(5,2) NOT NULL,
    "orderBV" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "status" "LevelCommissionStatus" NOT NULL DEFAULT 'CALCULATED',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "periodId" TEXT,
    "walletTransactionId" TEXT,
    "calculationDetails" JSONB,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_commissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "level_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_commissions_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_commissions_sourceDistributorId_fkey" FOREIGN KEY ("sourceDistributorId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_commissions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "commission_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "level_commissions_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Unique and query indexes for level_commissions
CREATE UNIQUE INDEX IF NOT EXISTS "level_commissions_commissionNumber_key" ON "level_commissions"("commissionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "level_commissions_businessReference_key" ON "level_commissions"("businessReference");
CREATE UNIQUE INDEX IF NOT EXISTS "level_commissions_orderId_level_key" ON "level_commissions"("orderId", "level");
CREATE UNIQUE INDEX IF NOT EXISTS "level_commissions_walletTransactionId_key" ON "level_commissions"("walletTransactionId");

CREATE INDEX IF NOT EXISTS "level_commissions_distributorId_status_idx" ON "level_commissions"("distributorId", "status");
CREATE INDEX IF NOT EXISTS "level_commissions_sourceDistributorId_idx" ON "level_commissions"("sourceDistributorId");
CREATE INDEX IF NOT EXISTS "level_commissions_orderId_idx" ON "level_commissions"("orderId");
CREATE INDEX IF NOT EXISTS "level_commissions_level_idx" ON "level_commissions"("level");
CREATE INDEX IF NOT EXISTS "level_commissions_status_idx" ON "level_commissions"("status");
CREATE INDEX IF NOT EXISTS "level_commissions_createdAt_idx" ON "level_commissions"("createdAt");
