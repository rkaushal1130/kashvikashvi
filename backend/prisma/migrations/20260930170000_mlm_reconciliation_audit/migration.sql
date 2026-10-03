-- CreateTable: reconciliation_audits
CREATE TABLE IF NOT EXISTS "reconciliation_audits" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "oldBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "calculatedBB" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "bbDiscrepancy" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "oldMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "calculatedMatching" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "matchingDiscrepancy" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "oldLeftVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "calculatedLeftVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "oldRightVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "calculatedRightVolume" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "oldLevel" TEXT NOT NULL DEFAULT 'BASE',
    "calculatedLevel" TEXT NOT NULL DEFAULT 'BASE',
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyDetails" JSONB,
    "reason" TEXT NOT NULL DEFAULT 'ADMIN_AUDIT',
    "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reconciliation_audits_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "distributor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reconciliation_audits_memberId_idx" ON "reconciliation_audits"("memberId");
CREATE INDEX IF NOT EXISTS "reconciliation_audits_hasDiscrepancy_idx" ON "reconciliation_audits"("hasDiscrepancy");
CREATE INDEX IF NOT EXISTS "reconciliation_audits_actor_idx" ON "reconciliation_audits"("actor");
CREATE INDEX IF NOT EXISTS "reconciliation_audits_createdAt_idx" ON "reconciliation_audits"("createdAt");
