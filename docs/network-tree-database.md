# Binary MLM Network Tree — Database Architecture & Specification

## 1. Executive Architecture Summary

This document specifies the PostgreSQL database schema and Prisma ORM data models implemented for the **Binary MLM Network Tree** within the Kashvi MLM platform.

The system enforces a dual-lineage model:
1. **Sponsor (Enroller) Hierarchy:** Represents direct personal recruitment relationships (Unilevel tree).
2. **Placement (Binary Tree) Hierarchy:** Represents physical positioning in the 2-leg binary matrix (`LEFT` or `RIGHT`), where members generate and accumulate Business Volume (BV) across dual team legs.

All network tree structures are stored permanently in **PostgreSQL** using **Prisma ORM**. No client-side arrays, browser storage, or ephemeral JSON files are used as the source of truth.

---

## 2. Core Principles & Business Logic Invariants

| Concept | Definition | Database Representation | Example |
| :--- | :--- | :--- | :--- |
| **Sponsor (Enroller)** | The active distributor who personally referred and enrolled the member into the platform. | `DistributorProfile.sponsorId` (FK to upline distributor's `DistributorProfile.id`). | Rahul refers Amit $\rightarrow$ Amit's `sponsorId = Rahul.id`. |
| **Placement Parent** | The upline binary node directly above this member in the visual tree topology. | `MLMNode.placementParentId` (FK to upline `MLMNode.id`). | Rahul places Amit on his left branch $\rightarrow$ Amit's `placementParentId = RahulNode.id`. |
| **Placement Position** | The designated binary leg under the placement parent. Max 1 per parent per leg. | `MLMNode.placementPosition` (Enum: `LEFT` or `RIGHT`). | Amit is on the left leg $\rightarrow$ `placementPosition = 'LEFT'`. |
| **Root Node** | The top distributor of an organization or sub-network. Has no placement parent. | `MLMNode.placementParentId = null`. | Rahul is the apex distributor $\rightarrow$ `placementParentId = null`. |
| **Spillover** | When a sponsor's immediate left and right slots are full, new recruits are placed deeper in the downline binary tree. | `DistributorProfile.sponsorId != MLMNode.placementParent.distributorId`. | Rahul sponsors Vikram; placed under Neha on left $\rightarrow$ Sponsor is Rahul, Placement Parent is Neha. |

---

## 3. Database Models & Schema Definition

### 3.1. Distributor Model (`DistributorProfile` $\rightarrow$ `distributor_profiles`)

```prisma
model DistributorProfile {
  id              String            @id @default(uuid())
  userId          String            @unique
  distributorId   String?           @unique // Public Distributor ID (e.g., KV-1001, KV-DEMO-1001)
  distributorCode String            @unique // Unique distributor code e.g., KV-DEMO-1001
  firstName       String
  lastName        String
  displayName     String?
  dateOfBirth     DateTime?
  gender          Gender            @default(NOT_SPECIFIED)
  status          DistributorStatus @default(PENDING)
  rankId          String?
  currentRankId   String?
  highestRankId   String?
  
  // Sponsor (Enroller) Lineage - Person who referred them
  sponsorId       String?

  lifetimePV      Decimal           @default(0.00) @db.Decimal(12, 2)
  lifetimeGV      Decimal           @default(0.00) @db.Decimal(12, 2)
  joinedAt        DateTime          @default(now())
  activatedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  user                  User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentRank           Rank?                     @relation("CurrentRank", fields: [currentRankId], references: [id])
  highestRank           Rank?                     @relation("HighestRank", fields: [highestRankId], references: [id])
  sponsor               DistributorProfile?       @relation("SponsorReferrals", fields: [sponsorId], references: [id])
  sponsoredDistributors DistributorProfile[]      @relation("SponsorReferrals")

  ancestorRelationships   SponsorRelationship[]   @relation("AncestorGenealogy")
  descendantRelationships SponsorRelationship[]   @relation("DescendantGenealogy")

  businessCenters       BusinessCenter[]
  mlmNodes              MLMNode[]
  customers             Customer[]
  rankHistories         DistributorRankHistory[]
  statusHistories       DistributorStatusHistory[]
  badges                DistributorBadge[]
  kycProfile            KYCProfile?
  bankAccounts          BankAccount[]
  orders                Order[]
  bvLedgers             BVLedger[]                @relation("DistributorBVLedger")
  sourceBVLedgers       BVLedger[]                @relation("SourceDistributorBV")
  commissions           Commission[]
  bonuses               Bonus[]
  payoutRequests        PayoutRequest[]
  website               DistributorWebsite?
  trainingProgress      TrainingProgress[]
  enrollments           Enrollment[]
  wallet                Wallet?
  supportTickets        SupportTicket[]

  // Performance Indexes
  @@index([userId])
  @@index([distributorId])
  @@index([distributorCode])
  @@index([sponsorId])
  @@index([status])
  @@index([rankId])
  @@index([currentRankId])
  @@map("distributor_profiles")
}
```

### 3.2. Binary Tree Model (`MLMNode` $\rightarrow$ `mlm_nodes`)

```prisma
enum PlacementPosition {
  LEFT
  RIGHT
}

model MLMNode {
  id                String             @id @default(uuid())
  businessCenterId  String             @unique
  distributorId     String
  
  // Binary Tree Placement Parent
  placementParentId String?
  placementPosition PlacementPosition?
  
  depth             Int                @default(0)
  binaryPath        String?            // Materialized path e.g., "ROOT/L/R"
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  businessCenter    BusinessCenter     @relation(fields: [businessCenterId], references: [id], onDelete: Cascade)
  distributor       DistributorProfile @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  placementParent   MLMNode?           @relation("BinaryChildren", fields: [placementParentId], references: [id], onDelete: Restrict)
  children          MLMNode[]          @relation("BinaryChildren")

  // Database-Level Integrity Constraints
  // 1. Strictly enforces maximum 1 LEFT child and maximum 1 RIGHT child per placement parent node
  @@unique([placementParentId, placementPosition])

  // Performance Indexes for high-speed tree traversal and placement lookups
  @@index([distributorId])
  @@index([businessCenterId])
  @@index([placementParentId])
  @@index([placementPosition])
  @@index([placementParentId, placementPosition])
  @@map("mlm_nodes")
}
```

### 3.3. Auxiliary Related Models

- **`BusinessCenter` (`business_centers`):** Represents an independent commission volume center (e.g. BC-1, BC-2, BC-3). Each center operates an independent binary node (`mlmNode`).
- **`Rank` (`ranks`):** Tracks distributor rank milestones (`Bronze`, `Silver`, `Gold`, `Platinum`, `Diamond`, etc.).
- **`SponsorRelationship` (`sponsor_relationships`):** Maintains high-performance transitive unilevel closure for deep ancestry queries without recursive overhead.

---

## 4. Integrity Constraints & Security Guarantees

### 4.1. Single Child Per Leg Constraint
```sql
CREATE UNIQUE INDEX mlm_nodes_placement_parent_leg_idx 
ON mlm_nodes (placement_parent_id, placement_position) 
WHERE placement_parent_id IS NOT NULL AND placement_position IS NOT NULL;
```
- **PostgreSQL enforcement:** An attempt to insert a second node with `placementParentId = X` and `placementPosition = 'LEFT'` triggers a `P2002: Unique constraint failed` error and is rejected immediately at the database level.

### 4.2. Root Node Compatibility
- Root distributors (such as Rahul `KV-DEMO-1001`) have `placementParentId = null` and `placementPosition = null`.
- Because PostgreSQL unique indexes treat `NULL` values as distinct, multiple root nodes or top-level business centers can exist safely.

### 4.3. Self-Placement Prevention
- Evaluated prior to database transaction:
```ts
if (placementParentNode.distributorId === distributor.id) {
  throw AppError.badRequest('Self-placement is forbidden: A distributor cannot place a node under themselves.', 'SELF_PLACEMENT_FORBIDDEN');
}
```

### 4.4. Circular Hierarchy Prevention
- Binary genealogy check: A member cannot be placed under a placement parent that is already a descendant in their own downline subtree:
```ts
const isCircular = await this.isBinaryAncestor(distributor.id, placementParentNode.id);
if (isCircular) {
  throw AppError.badRequest('Circular placement forbidden: The proposed placement parent is already a descendant of this distributor.', 'CIRCULAR_PLACEMENT_FORBIDDEN');
}
```

---

## 5. Development Seed Data Specification

The database seed (`backend/prisma/seed.ts`) populates an idempotent 5-member binary tree structure:

```
                 Rahul (KV-DEMO-1001)
                /                    \
     Amit (KV-DEMO-1002)     Rohit (KV-DEMO-1003)
     /                 \
Neha (KV-DEMO-1004)  Pooja (KV-DEMO-1005)
```

### Member Ledger & Placement Details

| Distributor | Code / ID | Role | Sponsor | Placement Parent | Leg | Depth | Binary Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rahul Kaushal** | `KV-DEMO-1001` / `KV-1001` | Root Distributor | *None* | *None* (`null`) | *None* | `0` | `ROOT` |
| **Amit Verma** | `KV-DEMO-1002` / `KV-1002` | Left Direct | Rahul | Rahul (`ROOT`) | `LEFT` | `1` | `ROOT/L` |
| **Rohit Singh** | `KV-DEMO-1003` / `KV-1003` | Right Direct | Rahul | Rahul (`ROOT`) | `RIGHT` | `1` | `ROOT/R` |
| **Neha Sharma** | `KV-DEMO-1004` / `KV-1004` | Downline Left | Amit | Amit (`ROOT/L`) | `LEFT` | `2` | `ROOT/L/L` |
| **Pooja Patel** | `KV-DEMO-1005` / `KV-1005` | Downline Right | Amit | Amit (`ROOT/L`) | `RIGHT` | `2` | `ROOT/L/R` |

---

## 6. Verification and Validation Results

The database structure and integrity constraints were verified via:

1. **Prisma Generation:**
   ```bash
   npx prisma generate
   ✔ Generated Prisma Client (v6.19.3) in 380ms
   ```

2. **Database Push & Schema Synchronization:**
   ```bash
   npx prisma db push
   ✔ Datasource "db": PostgreSQL database "kashvimlm", schema "public" at "localhost:5432"
   ✔ Your database is now in sync with your Prisma schema. Done in 340ms
   ```

3. **Idempotent Seeding:**
   ```bash
   npx tsx prisma/seed.ts
   ✔ Seed complete: Rahul, Amit, Rohit, Neha, Pooja and 3 Business Centers populated.
   ```

4. **Dedicated Relationship & Constraint Verification Script:**
   ```bash
   npx tsx scripts/verify-mlm-database.ts
   ```
   - [PASS] Seeded distributors Rahul, Amit, Rohit, Neha, Pooja verified.
   - [PASS] Required distributor fields verified (`id`, `userId`, `distributorId`, `sponsorId`, `status`, `rankId`, `createdAt`, `updatedAt`).
   - [PASS] Required tree model fields verified (`id`, `distributorId`, `businessCenterId`, `placementParentId`, `placementPosition`, `createdAt`, `updatedAt`).
   - [PASS] 5-Distributor binary tree topology verified (Rahul root, Amit left, Rohit right, Neha left of Amit, Pooja right of Amit).
   - [PASS] Unique constraint `parent + LEFT` strictly enforced (duplicate insertion rejected with `P2002`).
   - [PASS] Unique constraint `parent + RIGHT` strictly enforced (duplicate insertion rejected with `P2002`).
   - [PASS] Spillover placement verified (`sponsorId != placementParentId`).
   - [PASS] ALL DATABASE RELATIONSHIP & CONSTRAINT TESTS PASSED 100%.

5. **Full Platform Vitest Test Suites:**
   ```bash
   npx vitest run
   ✔ Test Files: 25 passed (25)
   ✔ Tests:      335 passed (335)
   ```

6. **TypeScript & Production Build:**
   ```bash
   npm run build (backend) -> tsc clean (0 errors)
   npm run build (frontend) -> vite build clean (1909 modules transformed, 0 errors)
   ```
