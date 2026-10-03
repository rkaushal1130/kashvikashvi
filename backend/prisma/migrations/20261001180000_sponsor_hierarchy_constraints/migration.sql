-- ============================================================================
-- SPONSOR HIERARCHY INTEGRITY & ANTI-CIRCULARITY CONSTRAINTS (PROMPT 15)
-- ============================================================================
-- 1. Prevent self-sponsorship on distributor_profiles:
--    A distributor can never be their own direct sponsor.
ALTER TABLE "distributor_profiles"
  DROP CONSTRAINT IF EXISTS "check_distributor_no_self_sponsor",
  ADD CONSTRAINT "check_distributor_no_self_sponsor"
  CHECK ("sponsorId" IS NULL OR "sponsorId" != "id");

-- 2. Prevent self-referencing in sponsor_relationships closure table:
--    Ancestor and descendant must not be identical.
ALTER TABLE "sponsor_relationships"
  DROP CONSTRAINT IF EXISTS "check_sponsor_rel_no_self_reference",
  ADD CONSTRAINT "check_sponsor_rel_no_self_reference"
  CHECK ("ancestorId" != "descendantId");

-- 3. Enforce positive, bounded depth on sponsor_relationships closure table:
--    Depth must be at least 1 and within reasonable bounds (<= 25).
ALTER TABLE "sponsor_relationships"
  DROP CONSTRAINT IF EXISTS "check_sponsor_rel_depth_positive",
  ADD CONSTRAINT "check_sponsor_rel_depth_positive"
  CHECK ("depth" >= 1 AND "depth" <= 25);
