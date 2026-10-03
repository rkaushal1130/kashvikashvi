-- ============================================================================
-- AUTHORITATIVE BUSINESS VOLUME (BV) HANDLING MIGRATION (PROMPT 14)
-- ============================================================================

-- 1. Add commissionableBusinessVolume to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "commissionableBusinessVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- Backfill from totalBV if existing
UPDATE "orders"
SET "commissionableBusinessVolume" = "totalBV"
WHERE "commissionableBusinessVolume" = 0.00 AND "totalBV" > 0.00;

-- Enforce non-negative constraint
ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "check_order_commissionable_bv_non_negative",
  ADD CONSTRAINT "check_order_commissionable_bv_non_negative"
  CHECK ("commissionableBusinessVolume" >= 0.00);

-- 2. Add commissionableBV to order_items
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "commissionableBV" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- Backfill from totalBV if existing
UPDATE "order_items"
SET "commissionableBV" = "totalBV"
WHERE "commissionableBV" = 0.00 AND "totalBV" > 0.00;

-- Enforce non-negative constraint
ALTER TABLE "order_items"
  DROP CONSTRAINT IF EXISTS "check_order_item_commissionable_bv_non_negative",
  ADD CONSTRAINT "check_order_item_commissionable_bv_non_negative"
  CHECK ("commissionableBV" >= 0.00);

-- 3. Add commissionableBusinessVolume to level_commissions
ALTER TABLE "level_commissions"
  ADD COLUMN IF NOT EXISTS "commissionableBusinessVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- Backfill from orderBV if existing
UPDATE "level_commissions"
SET "commissionableBusinessVolume" = "orderBV"
WHERE "commissionableBusinessVolume" = 0.00 AND "orderBV" > 0.00;

-- Enforce non-negative constraint
ALTER TABLE "level_commissions"
  DROP CONSTRAINT IF EXISTS "check_level_commission_commissionable_bv_non_negative",
  ADD CONSTRAINT "check_level_commission_commissionable_bv_non_negative"
  CHECK ("commissionableBusinessVolume" >= 0.00);
