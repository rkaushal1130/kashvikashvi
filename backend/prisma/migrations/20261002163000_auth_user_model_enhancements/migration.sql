-- ============================================================================
-- AUTHENTICATION & USER MODEL ENHANCEMENTS
-- ============================================================================
-- Enhances "users" table with unified authentication, referral, and sponsor fields
-- while strictly preserving all existing MLM/network data and relationships.

-- 1. Add new columns to "users" table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "sponsorId" TEXT,
  ADD COLUMN IF NOT EXISTS "placementId" TEXT,
  ADD COLUMN IF NOT EXISTS "position" "PlacementPosition",
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- 2. Populate fullName from distributor_profiles if null
UPDATE "users" u
SET "fullName" = dp."displayName"
FROM "distributor_profiles" dp
WHERE dp."userId" = u."id" AND u."fullName" IS NULL AND dp."displayName" IS NOT NULL;

-- 3. Populate referralCode from distributor_profiles if null
UPDATE "users" u
SET "referralCode" = dp."distributorCode"
FROM "distributor_profiles" dp
WHERE dp."userId" = u."id" AND u."referralCode" IS NULL AND dp."distributorCode" IS NOT NULL;

-- 4. Populate sponsorId from distributor_profiles if null
UPDATE "users" u
SET "sponsorId" = dp."sponsorId"
FROM "distributor_profiles" dp
WHERE dp."userId" = u."id" AND u."sponsorId" IS NULL AND dp."sponsorId" IS NOT NULL;

-- 5. Create unique constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "users_userId_key" ON "users"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key" ON "users"("referralCode");

CREATE INDEX IF NOT EXISTS "users_userId_idx" ON "users"("userId");
CREATE INDEX IF NOT EXISTS "users_referralCode_idx" ON "users"("referralCode");
CREATE INDEX IF NOT EXISTS "users_sponsorId_idx" ON "users"("sponsorId");
CREATE INDEX IF NOT EXISTS "users_placementId_idx" ON "users"("placementId");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
CREATE INDEX IF NOT EXISTS "users_lastLoginAt_idx" ON "users"("lastLoginAt");
