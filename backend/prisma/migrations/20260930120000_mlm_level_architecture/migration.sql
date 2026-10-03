-- AlterTable: Add MLM level tracking fields to distributor_profiles
ALTER TABLE "distributor_profiles" ADD COLUMN     "currentBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "currentLevelId" TEXT,
ADD COLUMN     "currentMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- CreateTable: levels (Configurable MLM level tiers: Silver, Gold, Platinum, Diamond, Ruby)
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "requiredBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "requiredMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: member_level_histories (Immutable level promotion audit trail)
CREATE TABLE "member_level_histories" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "previousLevelId" TEXT,
    "newLevelId" TEXT NOT NULL,
    "previousBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "previousMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "qualifyingBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "qualifyingMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "reason" TEXT DEFAULT 'QUALIFICATION_MET',
    "source" TEXT DEFAULT 'SYSTEM_AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_level_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bb_transactions (Immutable personal business volume transaction ledger)
CREATE TABLE "bb_transactions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "source" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: matching_transactions (Immutable binary matching volume transaction ledger)
CREATE TABLE "matching_transactions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "source" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: levels
CREATE UNIQUE INDEX "levels_code_key" ON "levels"("code");
CREATE UNIQUE INDEX "levels_order_key" ON "levels"("order");
CREATE INDEX "levels_code_idx" ON "levels"("code");
CREATE INDEX "levels_order_idx" ON "levels"("order");
CREATE INDEX "levels_isActive_idx" ON "levels"("isActive");

-- CreateIndex: member_level_histories
CREATE INDEX "member_level_histories_memberId_idx" ON "member_level_histories"("memberId");
CREATE INDEX "member_level_histories_previousLevelId_idx" ON "member_level_histories"("previousLevelId");
CREATE INDEX "member_level_histories_newLevelId_idx" ON "member_level_histories"("newLevelId");
CREATE INDEX "member_level_histories_createdAt_idx" ON "member_level_histories"("createdAt");

-- CreateIndex: bb_transactions
CREATE INDEX "bb_transactions_memberId_idx" ON "bb_transactions"("memberId");
CREATE INDEX "bb_transactions_referenceId_idx" ON "bb_transactions"("referenceId");
CREATE INDEX "bb_transactions_source_idx" ON "bb_transactions"("source");
CREATE INDEX "bb_transactions_createdAt_idx" ON "bb_transactions"("createdAt");
CREATE UNIQUE INDEX "bb_transactions_memberId_source_referenceId_key" ON "bb_transactions"("memberId", "source", "referenceId");

-- CreateIndex: matching_transactions
CREATE INDEX "matching_transactions_memberId_idx" ON "matching_transactions"("memberId");
CREATE INDEX "matching_transactions_referenceId_idx" ON "matching_transactions"("referenceId");
CREATE INDEX "matching_transactions_source_idx" ON "matching_transactions"("source");
CREATE INDEX "matching_transactions_createdAt_idx" ON "matching_transactions"("createdAt");
CREATE UNIQUE INDEX "matching_transactions_memberId_source_referenceId_key" ON "matching_transactions"("memberId", "source", "referenceId");

-- CreateIndex: distributor_profiles currentLevelId
CREATE INDEX "distributor_profiles_currentLevelId_idx" ON "distributor_profiles"("currentLevelId");

-- AddForeignKey: distributor_profiles -> levels
ALTER TABLE "distributor_profiles" ADD CONSTRAINT "distributor_profiles_currentLevelId_fkey" FOREIGN KEY ("currentLevelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: member_level_histories -> distributor_profiles & levels
ALTER TABLE "member_level_histories" ADD CONSTRAINT "member_level_histories_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_level_histories" ADD CONSTRAINT "member_level_histories_previousLevelId_fkey" FOREIGN KEY ("previousLevelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_level_histories" ADD CONSTRAINT "member_level_histories_newLevelId_fkey" FOREIGN KEY ("newLevelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bb_transactions -> distributor_profiles
ALTER TABLE "bb_transactions" ADD CONSTRAINT "bb_transactions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: matching_transactions -> distributor_profiles
ALTER TABLE "matching_transactions" ADD CONSTRAINT "matching_transactions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
