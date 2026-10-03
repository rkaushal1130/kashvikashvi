# MLM Level / Rank System Implementation Plan

## Executive Overview
This document delivers the architectural analysis and production-grade implementation plan for the **Configurable Binary MLM Level / Rank System** in the KashviMLM platform. The plan establishes a hierarchy from **STARTER / BASE** through **RUBY**, governed by independent evaluation of **Business Volume (BB)** and **Binary Matching Volume**.

---

## A. Existing Architecture Summary

### 1. Technology Stack
| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 (SPA)** | Built with **Vite 8**, **React Router DOM v7**, Tailwind CSS & custom styled components, **Lucide React** icons. |
| **Backend Framework** | **Node.js + Express 4.21** | Built with **TypeScript 5.7**, compiled and hot-reloaded via `tsx watch src/server.ts`. Production build via `tsc`. |
| **Database Engine** | **PostgreSQL** | Relational database cluster connected via connection pooling. |
| **ORM / Query Builder** | **Prisma ORM 6.4.1** | Fully typed client `@prisma/client`, schema migrations (`prisma migrate dev`), seeding script (`prisma/seed.ts`). |
| **Authentication & Security**| **JWT + Argon2id** | Industry-standard password hashing with Argon2id, signed JSON Web Tokens (`jsonwebtoken`), role-based middleware (`SUPER_ADMIN`, `ADMIN`, `DISTRIBUTOR`, `CUSTOMER`, `SUPPORT`), Helmet security headers, CORS origin whitelist, and Express Rate Limit. |
| **Validation Engine** | **Zod 3.24** | Type-safe schema validation interceptors (`validate({ body, query, params })`) ensuring clean inputs before controllers execute. |

### 2. Runtime & Application Topology
- **Active Backend**: Located in `backend/` directory (`kashvimlm-backend`), currently running as active process on port `5000` with API root routes:
  - `/api/v1/*` (versioned endpoints)
  - `/api/*` (compatibility alias)
- **Frontend Client**: Located in project root (`src/`), communicates via `src/services/api.js` targeting `http://localhost:5000/api/v1` with automatic auth token injection from `localStorage('kashvi_auth')`.
- **Secondary / Legacy Module**: A standalone module directory exists at `server/` with isolated unit tests; however, the primary operational backend consumed by the frontend is `backend/`.

---

## B. Existing Relevant Database Models

The schema in `backend/prisma/schema.prisma` is a normalized enterprise MLM schema. The models relevant to the level and compensation architecture include:

```
┌──────────────────┐         1:1         ┌────────────────────────┐
│       User       │ ──────────────────> │   DistributorProfile   │
│ (Auth & Role)    │                     │ (Lifetime PV/GV, Rank) │
└──────────────────┘                     └────────────────────────┘
                                                      │
         ┌───────────────────────────────┬────────────┴─────────────────┬───────────────────────────────┐
         │ 1:M                           │ 1:M                          │ 1:M                           │ 1:M
         ▼                               ▼                              ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐            ┌──────────────────┐
│  BusinessCenter  │           │     BVLedger     │           │    Commission    │            │ DistributorRank  │
│  (Left/Right Vol)│           │ (Immutable BV)   │           │ (Matched Volume) │            │     History      │
└──────────────────┘           └──────────────────┘           └──────────────────┘            └──────────────────┘
         │
         │ 1:1
         ▼
┌──────────────────┐
│     MLMNode      │
│  (Binary Tree)   │
└──────────────────┘
```

### 1. `User` Model
- Primary key: `id` (UUID).
- Fields: `email`, `passwordHash`, `roleName` (`DISTRIBUTOR`, `ADMIN`, `SUPER_ADMIN`, `CUSTOMER`), `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- Relations: 1-to-1 with `DistributorProfile`, 1-to-1 with `Wallet`.

### 2. `DistributorProfile` Model
- Represents the independent distributor / MLM member.
- Identification: `distributorCode` (e.g. `DST-10001`), `distributorId` (e.g. `KV-1001`).
- Lineage: `sponsorId` (Unilevel enroller), self-relation for referrals.
- Volume Tracking: `lifetimePV` (Personal Business Volume accumulator), `lifetimeGV` (Group Volume accumulator).
- Current Rank Fields: `currentRankId` (`Rank`), `highestRankId` (`Rank`).
- Relations: `businessCenters` (`BusinessCenter[]`), `mlmNodes` (`MLMNode[]`), `bvLedgers` (`BVLedger[]`), `commissions` (`Commission[]`), `rankHistories` (`DistributorRankHistory[]`).

### 3. `MLMNode` & `BusinessCenter` Models
- **`BusinessCenter`**: Multi-center capability (BC-1, BC-2, etc.).
  - `leftVolume`, `rightVolume`: Current cycle accumulated leg volume.
  - `accumulatedLeftVolume`, `accumulatedRightVolume`: Total historical volume accrued on respective binary legs.
- **`MLMNode`**: Represents binary placement.
  - `placementParentId`: Binary parent node ID.
  - `placementPosition`: `LEFT` or `RIGHT`.
  - `depth`: Depth from tree root.
  - `binaryPath`: Materialized path for high-performance subtree traversals.
  - Unique Constraint: `@@unique([placementParentId, placementPosition])` enforcing strictly at most one left and one right child per node.

### 4. `BVLedger` (Append-Only Volume Ledger)
- Immutable financial-grade audit ledger for volume.
- Fields: `distributorId`, `businessCenterId`, `sourceType` (`ORDER`, `BONUS`, `ADJUSTMENT`, `REVERSAL`), `sourceId`, `bv`, `balanceAfter`, `position` (`LEFT`, `RIGHT`, or `null` for personal volume).
- Distinguishes **Personal Order Volume** (`position = null`, attributed directly to purchaser) from **Binary Leg Team Volume** (`position = LEFT` or `RIGHT`, attributed to upline binary ancestors).

### 5. `Rank` & `DistributorRankHistory` Models
- **`Rank`**: Currently holds `rankCode`, `name`, `level` (Int), `minPersonalBV`, `minGroupBV`, `minActiveLegs`, `binaryWeeklyCap`, `oneTimeBonus`.
- **`DistributorRankHistory`**: Records rank transitions (`distributorId`, `rankId`, `periodId`, `personalBV`, `groupBV`, `achievedAt`).

### 6. `Commission` & `CommissionRule` Models
- **`Commission`**: Stores calculated earnings per cycle with strict idempotency key `businessReference`.
- Records `leftVolumeMatched` and `rightVolumeMatched` representing paired binary matching volume.

### 7. `Wallet` & `WalletTransaction` Models
- E-wallet tracking `availableBalance`, `pendingBalance`, `lifetimeEarned`, `lifetimePaid`.
- Commission postings credit the wallet through append-only transactions.

---

## C. Existing MLM Flow

```
[Distributor Registers] ──> [Placed in Binary Tree (MLMNode)]
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Places Product Order]                                  [Downline Places Orders]
    │                                                               │
    ▼                                                               ▼
[Personal BB Credited]                                  [Leg Volume Rolls Up Binary Tree]
- Recorded in BVLedger (position: null)                 - Left or Right leg credited in BVLedger
- Increments Distributor.lifetimePV                     - BusinessCenter left/rightVolume updated
    │                                                               │
    └───────────────────────────────┬───────────────────────────────┘
                                    ▼
                    [Cycle / Commission Evaluation]
                    - Matching Volume: min(leftVolume, rightVolume)
                    - Dual-leg commissions paid & recorded
```

1. **Member Onboarding & Placement**:
   - The distributor registers under a sponsor (`sponsorId`).
   - A `BusinessCenter` (BC-1) is generated and placed into the binary tree (`MLMNode`) under an available position (`LEFT` or `RIGHT`) chosen manually or via automatic placement rules.
2. **Order Creation & Authoritative BV / BB**:
   - When a purchase is completed and marked `PAID`, `OrderService.createOrder` derives `unitBV` and `totalBV` exclusively from authoritative database records (frontend input BV is never trusted).
   - `BVService.creditBV` logs an immutable `BVLedger` entry with `position = null` for the buyer.
   - `DistributorProfile.lifetimePV` increments by the order's `totalBV`.
3. **Binary Leg Volume Uplink (Roll-Up)**:
   - Volume traverses up the binary ancestors using the `MLMNode.placementParentId` chain.
   - For each ancestor, leg volume is added to the ancestor's `BusinessCenter` (`leftVolume` or `rightVolume` and `accumulatedLeftVolume` or `accumulatedRightVolume`), and an immutable `BVLedger` record is appended with `position: LEFT` or `RIGHT`.
4. **Matching & Commission Calculation**:
   - During commission cycles, `CommissionService` evaluates dual-leg matched volume:
     $$\text{matchedVolume} = \min(\text{leftVolume}, \text{rightVolume})$$
   - Commission is generated, and matched leg volumes are tracked on the `Commission` record (`leftVolumeMatched`, `rightVolumeMatched`).

---

## D. What Can Be Reused

1. **Binary MLM Tree & Placement Engine**:
   - `MLMNode`, `BusinessCenter`, and `TreePlacementService` with all 6 tree integrity constraints (no circular nodes, collision prevention, valid parentage).
2. **Immutable Volume Accounting**:
   - `BVLedger` append-only mechanism for tracking both personal volume and binary team volume with running balances.
3. **Order & BV Pipeline**:
   - Server-side authoritative BV calculation on `Product` and `Order`.
4. **Binary Leg Accumulators**:
   - `BusinessCenter.accumulatedLeftVolume` and `accumulatedRightVolume` provide an immediate historical record of leg volume.
5. **Existing Rank & History Schema**:
   - `Rank` and `DistributorRankHistory` tables already exist with relationships to `DistributorProfile`. They can be seamlessly extended without breaking foreign keys or existing data.
6. **Core Infrastructure**:
   - Global error handling (`AppError`), logging (`pino`), authentication (`JWT/Argon2id`), and API response wrappers (`sendSuccess`).

---

## E. What Needs to Be Added

### 1. Dedicated Level / Rank Hierarchy Specification
The system requires a strict 6-tier ordered level hierarchy:

| Level Index | Level Code | Level Display Name | Required Personal BB | Required Matching Volume | Description |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | `RANK_STARTER` | **Starter / Base** | `0` | `0` | Default entry tier upon registration. |
| **1** | `RANK_SILVER` | **Silver** | `250` | `2,000` | Entry leadership level. |
| **2** | `RANK_GOLD` | **Gold** | `250` | `5,000` | Intermediate business builder. |
| **3** | `RANK_PLATINUM`| **Platinum** | `500` | `50,000` | Senior builder level. |
| **4** | `RANK_DIAMOND` | **Diamond** | `1,000` | `60,000` | Executive leader level. |
| **5** | `RANK_RUBY` | **Ruby** | `1,000` | `100,000` | Top tier leadership level. |

### 2. Dual Independence Rule
- **Personal BB (Business Building / Business Volume)**:
  - Measured purely from personal product purchases/sales accrued to the distributor's account (`DistributorProfile.currentBB` / `lifetimePV` and personal `BVLedger` entries).
  - It does **NOT** include downline leg volume.
- **Matching Volume**:
  - Measured purely from binary paired team volume:
    $$\text{Total Matching} = \min(\text{Total Accumulated Left Leg Volume}, \text{Total Accumulated Right Leg Volume})$$
    or the sum of all matched volume cycles credited to the distributor's business center.
  - It does **NOT** include personal BB.
- **Qualification Formula**:
  $$\text{Qualifies for Level } L \iff (\text{member.currentBB} \ge L\text{.requiredBB}) \land (\text{member.totalMatching} \ge L\text{.requiredMatching})$$

### 3. Dedicated Service Architecture
To fulfill requirement 10 & 11 ("Do NOT hardcode promotion logic inside controllers"), a dedicated modular service package will be created in `backend/src/services/level/`:
- `BBService`: Independent calculation of personal BB.
- `MatchingService`: Independent calculation of binary matching volume.
- `LevelQualificationService`: Requirement evaluation, qualification check, and progress metrics.
- `LevelPromotionService`: Automated progression, rank assignment, and notification dispatch.
- `LevelHistoryService`: Complete audit trail retrieval and logging.
- `LevelRecalculationService`: Full network or single-member retroactive audit and synchronization.

---

## F. Potential Conflicts & Resolutions

| # | Potential Conflict | Analysis & Risk | Resolution Strategy |
| :---: | :--- | :--- | :--- |
| **1** | **Level Naming Conflict** | The previous seed in `backend/prisma/seed.ts` defined `Bronze`, `Silver`, `Gold`, `Platinum`, `Diamond`. The new requirement specifies `Starter / Base` $\to$ `Silver` $\to$ `Gold` $\to$ `Platinum` $\to$ `Diamond` $\to$ `Ruby`. `Bronze` is not in the new tier list. | Deprecate `RANK_BRONZE`. Seed the canonical 6 tiers: `RANK_STARTER` (0), `RANK_SILVER` (1), `RANK_GOLD` (2), `RANK_PLATINUM` (3), `RANK_DIAMOND` (4), `RANK_RUBY` (5). Existing members with `RANK_BRONZE` will be safely migrated to `RANK_STARTER`. |
| **2** | **Conflating BB with Group Volume** | In generic MLM terms, some codebases treat BV, PV, and GV interchangeably. The requirement explicitly mandates: "Do not assume that matching volume and BB are the same thing. BB and Matching must be stored/calculated independently." | Strictly isolate the data sources: `BBService` only aggregates personal order volume (where `position` is null / personal purchases). `MatchingService` only evaluates balanced binary leg volume $\min(\text{Left}, \text{Right})$. No code path may mix or cross-subsidize these metrics. |
| **3** | **Promotion Execution Timing** | Triggering promotions inside heavy database writes (like order checkout) could introduce transaction locks or latency. | The promotion check will be executed within the order post-completion hook and volume uplink event, encapsulated in `LevelPromotionService.evaluateAndPromote(distributorId)`. It uses an atomic optimistic lock to ensure zero duplicate promotion events. |
| **4** | **Level Demotion Risk** | If a customer refunds an order, personal BB might drop. MLM best practices typically track "Current Level" vs "Highest Achieved Level". | Both `currentRankId` and `highestRankId` are preserved on `DistributorProfile`. Demotion rules can be configured; by default, career rank achievements are immutable once logged in `DistributorRankHistory`, while active level perks check current volume. |

---

## G. Proposed Database Changes

We extend the existing Prisma schema in `backend/prisma/schema.prisma` without dropping any existing tables or columns:

### 1. Updates to `Rank` Model
Add explicit, configurable fields for `requiredBB` and `requiredMatching`:

```prisma
model Rank {
  id               String   @id @default(uuid())
  rankCode         String   @unique // e.g. RANK_STARTER, RANK_SILVER, RANK_GOLD, RANK_PLATINUM, RANK_DIAMOND, RANK_RUBY
  name             String   // e.g. "Silver", "Gold", "Platinum", "Diamond", "Ruby"
  level            Int      @unique // 0: Starter, 1: Silver, 2: Gold, 3: Platinum, 4: Diamond, 5: Ruby
  
  // New Explicit MLM Level System Fields
  requiredBB       Decimal  @default(0.00) @db.Decimal(12, 2)
  requiredMatching Decimal  @default(0.00) @db.Decimal(12, 2)
  
  // Existing fields preserved for backward compatibility
  minPersonalBV    Decimal  @default(0.00) @db.Decimal(12, 2)
  minGroupBV       Decimal  @default(0.00) @db.Decimal(12, 2)
  minActiveLegs    Int      @default(0)
  binaryWeeklyCap  Decimal  @default(0.00) @db.Decimal(12, 2)
  oneTimeBonus     Decimal  @default(0.00) @db.Decimal(12, 2)
  iconUrl          String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  currentDistributors DistributorProfile[]     @relation("CurrentRank")
  highestDistributors DistributorProfile[]     @relation("HighestRank")
  rankHistories       DistributorRankHistory[]
  commissionRules     CommissionRule[]
  coursesRequired     TrainingCourse[]

  @@index([level])
  @@index([rankCode])
  @@map("ranks")
}
```

### 2. Updates to `DistributorProfile` Model
Add direct volume cache fields for high-performance dashboard reads:

```prisma
model DistributorProfile {
  // ... existing fields ...
  
  // Cached MLM Level Metrics (Updated atomically by LevelPromotionService & BVService)
  currentBB             Decimal           @default(0.00) @db.Decimal(12, 2)
  totalMatching         Decimal           @default(0.00) @db.Decimal(12, 2)
  
  // Existing fields preserved
  lifetimePV            Decimal           @default(0.00) @db.Decimal(12, 2)
  lifetimeGV            Decimal           @default(0.00) @db.Decimal(12, 2)
  
  // ... existing relations ...
}
```

### 3. Updates to `DistributorRankHistory` Model
Capture the exact snapshot of both BB and Matching at the exact moment of promotion:

```prisma
model DistributorRankHistory {
  id                String             @id @default(uuid())
  distributorId     String
  rankId            String
  periodId          String?
  
  // Volume snapshot at promotion time
  qualifiedBB       Decimal            @default(0.00) @db.Decimal(12, 2)
  qualifiedMatching Decimal            @default(0.00) @db.Decimal(12, 2)
  
  // Backward compatibility fields
  personalBV        Decimal            @default(0.00) @db.Decimal(12, 2)
  groupBV           Decimal            @default(0.00) @db.Decimal(12, 2)
  
  promotedBy        String?            // "SYSTEM_AUTO" or Admin User ID
  achievedAt        DateTime           @default(now())
  createdAt         DateTime           @default(now())

  distributor       DistributorProfile @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  rank              Rank               @relation(fields: [rankId], references: [id])
  period            CommissionPeriod?  @relation(fields: [periodId], references: [id])

  @@index([distributorId])
  @@index([rankId])
  @@index([achievedAt])
  @@map("distributor_rank_history")
}
```

---

## H. Proposed API Structure

All routes follow the project's standard Express router configuration mounted in `backend/src/routes/index.ts`.

### 1. Member Level Endpoints (`/api/v1/levels`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/levels/me` | `authenticate` | Returns current distributor's level, current BB, total matching, qualification status, and progress towards next level. |
| `GET` | `/api/v1/levels/history` | `authenticate` | Returns paginated list of rank promotion events for the authenticated member. |
| `GET` | `/api/v1/levels/config` | Public / Auth | Returns the list of all active levels (Starter $\to$ Ruby) with their required BB and Matching metrics for frontend UI display. |
| `GET` | `/api/v1/levels/member/:memberId` | `authenticate` | Allows distributors to view the level and public qualification badges of team downlines. |

#### Sample Response: `GET /api/v1/levels/me`
```json
{
  "success": true,
  "data": {
    "currentLevel": {
      "level": 2,
      "code": "RANK_GOLD",
      "name": "Gold",
      "requiredBB": 250.00,
      "requiredMatching": 5000.00,
      "achievedAt": "2026-09-15T10:30:00Z"
    },
    "metrics": {
      "currentBB": 320.00,
      "totalMatching": 14500.00,
      "accumulatedLeftVolume": 22000.00,
      "accumulatedRightVolume": 14500.00
    },
    "nextLevel": {
      "level": 3,
      "code": "RANK_PLATINUM",
      "name": "Platinum",
      "requiredBB": 500.00,
      "requiredMatching": 50000.00,
      "bbGap": 180.00,
      "matchingGap": 35500.00,
      "bbProgressPercentage": 64.0,
      "matchingProgressPercentage": 29.0,
      "isQualified": false
    }
  }
}
```

### 2. Admin Level Management Endpoints (`/api/v1/admin/levels`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/levels/config` | `requireRole(['ADMIN', 'SUPER_ADMIN'])` | List all level definitions with qualification thresholds. |
| `PUT` | `/api/v1/admin/levels/config/:levelId` | `requireRole(['ADMIN', 'SUPER_ADMIN'])` | Update level configuration (e.g., adjust required BB or Matching). |
| `POST`| `/api/v1/admin/levels/recalculate` | `requireRole(['ADMIN', 'SUPER_ADMIN'])` | Trigger audit/recalculation for the entire network or a single member. |
| `GET` | `/api/v1/admin/levels/distribution` | `requireRole(['ADMIN', 'SUPER_ADMIN'])` | Demographic stats of member counts across Silver, Gold, Platinum, Diamond, Ruby. |

---

## I. Proposed Service Structure

The implementation will be organized under `backend/src/services/level/`:

```
backend/src/services/level/
├── bb.service.ts                  # Independent personal BB calculation & verification
├── matching.service.ts            # Independent binary matching volume calculation
├── levelQualification.service.ts  # Qualification check & progress calculation
├── levelPromotion.service.ts      # Automated progression & rank assignment
├── levelHistory.service.ts        # Historical logging and audit reporting
├── levelRecalculation.service.ts  # Batch & on-demand network volume audit
├── level.types.ts                 # Shared TypeScript interfaces & DTOs
└── index.ts                       # Unified export facade
```

### Detailed Service Responsibilities

#### 1. `BBService` (`bb.service.ts`)
- **Primary Method**: `calculateCurrentBB(distributorId: string, client?: Prisma.TransactionClient): Promise<number>`
- **Logic**:
  - Queries `BVLedger` where `distributorId = :id` and `position IS NULL` (personal orders/adjustments).
  - Validates against `DistributorProfile.lifetimePV`.
  - Ensures zero inclusion of binary downline team volume.

#### 2. `MatchingService` (`matching.service.ts`)
- **Primary Method**: `calculateTotalMatching(distributorId: string, client?: Prisma.TransactionClient): Promise<number>`
- **Logic**:
  - Fetches the distributor's primary `BusinessCenter`.
  - Computes:
    $$\text{Total Matching} = \min(\text{accumulatedLeftVolume}, \text{accumulatedRightVolume})$$
  - Optionally cross-references total historical matched volume across all closed commission periods.
  - Ensures zero inclusion of personal BB.

#### 3. `LevelQualificationService` (`levelQualification.service.ts`)
- **Primary Method**: `evaluateQualification(distributorId: string): Promise<QualificationResult>`
- **Logic**:
  - Retrieves current level, member's `currentBB`, and `totalMatching`.
  - Fetches all configured levels ordered by `level ASC`.
  - Evaluates qualification predicate for each tier:
    $$\text{currentBB} \ge \text{requiredBB} \land \text{totalMatching} \ge \text{requiredMatching}$$
  - Returns current eligible level, progress percentages toward the next tier, and gap numbers.

#### 4. `LevelPromotionService` (`levelPromotion.service.ts`)
- **Primary Method**: `evaluateAndPromote(distributorId: string, client?: Prisma.TransactionClient): Promise<PromotionResult>`
- **Logic**:
  - Invokes `LevelQualificationService.evaluateQualification`.
  - Compares the qualified level with member's `currentRank.level`.
  - If qualified for a higher level:
    - Atomically updates `DistributorProfile.currentRankId` and `DistributorProfile.highestRankId`.
    - Creates an entry in `DistributorRankHistory` with `qualifiedBB`, `qualifiedMatching`, and `promotedBy: "SYSTEM_AUTO"`.
    - Dispatches user notification (`NotificationService.createNotification`).
    - Dispatches leadership rank bonus if configured in `CommissionRule`.
  - Safe & Idempotent: Never creates duplicate rank history entries for the same level tier.

#### 5. `LevelHistoryService` (`levelHistory.service.ts`)
- **Primary Method**: `getHistory(distributorId: string, options: PaginationOptions): Promise<HistoryResult>`
- **Logic**:
  - Fetches chronologically ordered rank achievements.
  - Formats volume snapshot metrics, achievement dates, and promotion notes for UI tables.

#### 6. `LevelRecalculationService` (`levelRecalculation.service.ts`)
- **Primary Method**: `recalculateNetworkLevels(options?: RecalcOptions): Promise<RecalcSummary>`
- **Logic**:
  - Scans all active distributors in the binary tree.
  - Recalculates both `currentBB` and `totalMatching` from source ledgers.
  - Synchronizes cached fields on `DistributorProfile`.
  - Promotes any members who qualify for higher ranks but were missed due to asynchronous event lags.
  - Generates detailed audit report for administrative review.

---

## J. Verification & Testing Strategy

Before shipping changes, the implementation will be verified through:
1. **Unit Tests (`vitest`)**:
   - `bb.service.test.ts`: Verify BB increases only on personal purchases, never from team spillover.
   - `matching.service.test.ts`: Verify matching volume strictly equals $\min(\text{left}, \text{right})$.
   - `levelQualification.service.test.ts`: Test edge cases (e.g. BB met but matching missing, matching met but BB missing, both met).
   - `levelPromotion.service.test.ts`: Test single-level promotions, multi-level jumps (e.g. Starter directly to Gold on high volume), and idempotency.
2. **Integration Tests (`supertest`)**:
   - Verify `/api/v1/levels/me` returns accurate real-time metrics.
   - Verify `/api/v1/admin/levels/config` allows authorized admins to view and modify rules.
   - Verify `/api/v1/admin/levels/recalculate` executes cleanly with full audit output.

---

## Conclusion
This architecture guarantees:
1. **Zero Coupling with Controllers**: All promotion and calculation logic is encapsulated inside dedicated, testable services.
2. **Strict Independence of BB and Matching**: Business Building personal volume and Binary Matching team volume are tracked and computed independently.
3. **Full Compatibility**: Seamlessly integrates with the existing PostgreSQL Prisma schema and binary placement tree.
