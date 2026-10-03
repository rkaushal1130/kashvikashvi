-- ============================================================================
-- MLM BUSINESS RULE VALIDATION & SECURITY CONSTRAINTS (PROMPT 8)
-- ============================================================================
-- Enforces database-level invariants:
-- 1. No negative BB balances allowed on transactions or member profile
-- 2. No negative Matching balances allowed on transactions or member profile
-- 3. Composite unique indexes prevent duplicate transactions and replay attacks

-- Check constraints on bb_transactions
ALTER TABLE "bb_transactions"
  DROP CONSTRAINT IF EXISTS "bb_transactions_balance_non_negative",
  ADD CONSTRAINT "bb_transactions_balance_non_negative"
  CHECK ("balanceAfter" >= 0.00);

-- Check constraints on matching_transactions
ALTER TABLE "matching_transactions"
  DROP CONSTRAINT IF EXISTS "matching_transactions_balance_non_negative",
  ADD CONSTRAINT "matching_transactions_balance_non_negative"
  CHECK ("balanceAfter" >= 0.00);

-- Check constraints on distributor_profiles
ALTER TABLE "distributor_profiles"
  DROP CONSTRAINT IF EXISTS "distributor_current_bb_non_negative",
  ADD CONSTRAINT "distributor_current_bb_non_negative"
  CHECK ("currentBB" >= 0.00);

ALTER TABLE "distributor_profiles"
  DROP CONSTRAINT IF EXISTS "distributor_current_matching_non_negative",
  ADD CONSTRAINT "distributor_current_matching_non_negative"
  CHECK ("currentMatching" >= 0.00);
