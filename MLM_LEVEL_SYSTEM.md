# MLM LEVEL AND QUALIFICATION SYSTEM DOCUMENTATION

Production-grade specification, architecture, security model, and operational guide for the Kashvi MLM Level, Business Building Volume (BB), Binary Matching, and Reconciliation Engine.

---

## Table of Contents
1. [Level Requirements](#1-level-requirements)
2. [Business Building Volume (BB) Definition](#2-business-building-volume-bb-definition)
3. [Binary Matching Volume Definition](#3-binary-matching-volume-definition)
4. [Binary Tree Behavior](#4-binary-tree-behavior)
5. [Qualification Formula](#5-qualification-formula)
6. [Promotion Behavior](#6-promotion-behavior)
7. [Demotion Behavior](#7-demotion-behavior)
8. [Ledger Architecture](#8-ledger-architecture)
9. [API Endpoints](#9-api-endpoints)
10. [Database Models](#10-database-models)
11. [Admin Operations](#11-admin-operations)
12. [Recalculation & Reconciliation Process](#12-recalculation--reconciliation-process)
13. [Error Handling & Failure Atomicity](#13-error-handling--failure-atomicity)
14. [Security Model & Invariants](#14-security-model--invariants)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Level Requirements

The MLM Level System defines 6 authoritative tiers structured strictly from Base (order 0) through Ruby (order 5). 

**Both conditions (Personal BB AND Matching Volume) are strictly mandatory.** Meeting one requirement while failing the other results in non-qualification for that level.

| Level Code | Level Name | Order | Required Personal BB | Required Matching Volume | Weekly Binary Cap | Level Description |
|:---|:---|:---:|:---:|:---:|:---:|:---|
| `BASE` | Base | 0 | 0 | 0 | $500 | Default entry tier upon distributor onboarding |
| `SILVER` | Silver | 1 | 250 | 2,000 | $3,000 | Initial leadership qualification |
| `GOLD` | Gold | 2 | 250 | 5,000 | $5,000 | Intermediate network volume tier |
| `PLATINUM` | Platinum | 3 | 500 | 50,000 | $15,000 | Advanced volume leadership |
| `DIAMOND` | Diamond | 4 | 1,000 | 60,000 | $30,000 | Executive volume milestone |
| `RUBY` | Ruby | 5 | 1,000 | 100,000 | $50,000 | Premier leadership & maximum weekly cap tier |

### Key Examples
- $\text{BB} = 249, \text{Matching} = 2,000 \rightarrow$ **NOT SILVER** (BB gap: 1).
- $\text{BB} = 250, \text{Matching} = 1,999 \rightarrow$ **NOT SILVER** (Matching gap: 1).
- $\text{BB} = 250, \text{Matching} = 2,000 \rightarrow$ **SILVER** (Both conditions satisfied).
- $\text{BB} = 250, \text{Matching} = 5,000 \rightarrow$ **GOLD**.
- $\text{BB} = 499, \text{Matching} = 50,000 \rightarrow$ **NOT PLATINUM** (Holds Gold, BB gap: 1).
- $\text{BB} = 500, \text{Matching} = 50,000 \rightarrow$ **PLATINUM**.
- $\text{BB} = 1,000, \text{Matching} = 60,000 \rightarrow$ **DIAMOND**.
- $\text{BB} = 1,000, \text{Matching} = 99,999 \rightarrow$ **NOT RUBY** (Holds Diamond, Matching gap: 1).
- $\text{BB} = 1,000, \text{Matching} = 100,000 \rightarrow$ **RUBY**.

---

## 2. Business Building Volume (BB) Definition

- **Personal Volume Sole Source**: BB measures Business Building Volume generated exclusively by a member's own direct personal orders or verified adjustments.
- **Strict Independence**: BB **never** incorporates downline group sales, binary spillover, team legs, or matching volume.
- **Ledger-Derived Source of Truth**: BB is stored immutably in `bb_transactions`. A member's current active balance is computed as:
  $$\text{Current BB} = \sum_{\text{type} \in \{\text{CREDIT}, \text{ADJUSTMENT}\}} \text{amount} - \sum_{\text{type} \in \{\text{DEBIT}, \text{REFUND}\}} |\text{amount}|$$
- **Non-Negative Invariant**: Balance can never be negative. Database check constraints (`CHECK ("balanceAfter" >= 0.00)`) and service validation reject any transaction that would drive balance below zero.

---

## 3. Binary Matching Volume Definition

- **Leg Balancing**: In a binary tree where downline volume flows into LEFT and RIGHT legs, matching volume represents the paired volume qualifying for compensation and rank.
- **Single Authoritative Entry Point**: The level system consumes a single qualifying numeric value from `MatchingService.getMatchingVolume(memberId)`.
- **Configurable Matching Formulas**: The engine supports pluggable rules configured via `MATCHING_ENGINE_CONFIG.rule`:
  1. `MINIMUM_LEG` (Default standard rule):
     $$\text{Matched Volume} = \min(\text{Left Leg Volume}, \text{Right Leg Volume})$$
  2. `PAIR_MATCHING`: Matched in stepped 1:1 units (e.g. 100 BV pairs).
  3. `CUMULATIVE_MATCHING`: All-time matched cycle volume credited historically.
  4. `DAILY_MATCHING`: Matching aggregated per 24-hour cycle.
- **Carry-Forward Support**: Volume exceeding the matched amount on the strong leg is retained as carry-forward balance for subsequent cycles.

---

## 4. Binary Tree Behavior

- **Node Placement**: Each distributor node in `mlm_nodes` has at most one `LEFT` child and one `RIGHT` child enforced by unique composite database constraint `@@unique([placementParentId, placementPosition])`.
- **Ancestral Rollup**: When an order occurs, BV propagates upward through the placement parent ancestry:
  - If node is placed on parent's `LEFT`, parent accumulates left-leg volume.
  - If node is placed on parent's `RIGHT`, parent accumulates right-leg volume.
- **Spillover Handling**: Any distributor placed deeper in the binary tree by an upline sponsor confers identical binary volume upward through the placement chain.
- **Isolation of BB and Leg Volume**: Placing downline volume increases upline binary leg volume, but confers $0$ BB to the upline. Personal BB is earned exclusively through personal purchases.

---

## 5. Qualification Formula

Level qualification evaluates candidate tiers from highest to lowest:

$$\text{Eligible Level} = \max_{\text{order}} \left\{ L \in \text{CANONICAL\_LEVELS} \;\middle|\; \text{BB} \ge L.\text{requiredBB} \;\land\; \text{Matching} \ge L.\text{requiredMatching} \right\}$$

- **Order of Evaluation**: $\text{Ruby (5)} \rightarrow \text{Diamond (4)} \rightarrow \text{Platinum (3)} \rightarrow \text{Gold (2)} \rightarrow \text{Silver (1)} \rightarrow \text{Base (0)}$.
- **Partial Qualification Rejection**: If $\text{BB} \ge L.\text{requiredBB}$ but $\text{Matching} < L.\text{requiredMatching}$, or vice versa, the level is not qualified, and evaluation falls through to the next tier down.

---

## 6. Promotion Behavior

1. **Automatic Progression**: Triggered automatically upon valid BB credit or matching volume change.
2. **Promotion Rule**:
   $$\text{Promote Member} \iff \text{eligibleLevel.order} > \text{currentLevel.order}$$
3. **Direct Multi-Tier Jumps**: A distributor whose volumes jump directly from Base to Ruby ($\text{BB} = 1,200, \text{Matching} = 120,000$) is awarded Ruby immediately without requiring manual intermediate progressions through Silver, Gold, Platinum, or Diamond.
4. **Promotion Record Creation**: Every promotion creates an immutable `MemberLevelHistory` record capturing:
   - `memberId`
   - `previousLevelId` & `newLevelId`
   - `qualifyingBB` & `qualifyingMatching`
   - `reason` & `source` (e.g. `ORDER`, `MATCHING`, `RECONCILIATION`, `ADMIN`)
   - `timestamp`

---

## 7. Demotion Behavior

- **Demotion Disabled by Default**: If a member's calculated or current volume decreases (due to returns, chargebacks, period cycle flushes, or recalculations), the member **maintains their achieved level**.
  $$\text{eligibleLevel.order} \le \text{currentLevel.order} \implies \text{No Change (Maintain Highest Achieved)}$$
- **Rank Maintenance Separation**: Monthly active qualification requirements for commission payout are decoupled from permanent career recognition levels.

---

## 8. Ledger Architecture

All financial and volume operations employ dual-ledger immutability:

```
                  ┌──────────────────────────────────────────────┐
                  │              Authoritative Event             │
                  └──────────────────────┬───────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
            ┌─────────────────────────┐     ┌─────────────────────────┐
            │     BBTransaction       │     │   MatchingTransaction   │
            │  (Personal BB Ledger)   │     │ (Binary Matching Ledger)│
            ├─────────────────────────┤     ├─────────────────────────┤
            │ • id                    │     │ • id                    │
            │ • memberId              │     │ • memberId              │
            │ • amount                │     │ • amount                │
            │ • balanceAfter          │     │ • balanceAfter          │
            │ • source, referenceId   │     │ • source, referenceId   │
            │ • @@unique(idempotency) │     │ • @@unique(idempotency) │
            └────────────┬────────────┘     └────────────┬────────────┘
                         │                               │
                         └───────────────┬───────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │       DistributorProfile        │
                        │    (Derived Cache / Snapshot)   │
                        ├─────────────────────────────────┤
                        │ • currentBB                     │
                        │ • currentMatching               │
                        │ • currentLevelId                │
                        └─────────────────────────────────┘
```

- **Idempotency Guarantee**: Composite unique index `@@unique([memberId, source, referenceId])` on both ledgers prevents duplicate credit or replay attacks at the database storage engine layer.
- **Source of Truth Rule**: Ledger entries are never mutated. Stored profiles can be completely purged and rebuilt from ledger entries with mathematical precision.

---

## 9. API Endpoints

All endpoints follow RESTful conventions. Standard member endpoints require authenticated user/distributor tokens. Admin endpoints strictly require `ADMIN` or `SUPER_ADMIN` roles.

### Member Endpoints
| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/members/:memberId/level` | Detailed status of current level, BB, matching, and next tier |
| `GET` | `/api/members/:memberId/level/progress` | Quantitative progression metrics, gaps, and percentage completion |
| `GET` | `/api/members/:memberId/level/history` | Chronological promotion audit trail |
| `GET` | `/api/members/:memberId/bb` | Current BB balance, lifetime volume, credits, debits |
| `GET` | `/api/members/:memberId/bb/history` | Paginated BB transaction ledger entries |
| `GET` | `/api/members/:memberId/matching` | Authoritative matching volume, leg breakdowns, strong/weak leg |
| `GET` | `/api/members/:memberId/matching/history`| Paginated matching transaction history |

### Admin Endpoints
| Method | Route | Description |
|:---|:---|:---|
| `POST` | `/api/admin/members/:memberId/recalculate-level` | Re-evaluates and syncs member level |
| `POST` | `/api/admin/members/:memberId/recalculate-bb` | Recomputes net BB balance from ledger |
| `POST` | `/api/admin/members/:memberId/recalculate-matching` | Recomputes matching volume from leg transactions |
| `POST` | `/api/admin/members/:memberId/reconcile` | Full single-member reconciliation audit |
| `POST` | `/api/admin/members/reconcile-all` | Network-wide batched reconciliation |
| `GET` | `/api/admin/members/reconciliation/history` | Paginated audit trail of all reconciliation runs |
| `GET` | `/api/admin/members/:memberId/reconciliation/history`| Reconciliation audit history for specific member |

---

## 10. Database Models

The MLM Level System introduces 5 primary Prisma models:

1. **`Level` (`levels`)**:
   - `id`, `name`, `code` (`SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`, `RUBY`), `order` (1 to 5), `requiredBB` (DECIMAL 12,2), `requiredMatching` (DECIMAL 12,2), `isActive`.
2. **`MemberLevelHistory` (`member_level_histories`)**:
   - `id`, `memberId`, `previousLevelId`, `newLevelId`, `previousBB`, `previousMatching`, `qualifyingBB`, `qualifyingMatching`, `reason`, `source`, `createdAt`.
3. **`BBTransaction` (`bb_transactions`)**:
   - `id`, `memberId`, `amount`, `balanceAfter`, `type`, `source`, `referenceId`, `description`, `createdAt`.
   - Unique: `[memberId, source, referenceId]`.
4. **`MatchingTransaction` (`matching_transactions`)**:
   - `id`, `memberId`, `amount`, `balanceAfter`, `type`, `source`, `referenceId`, `description`, `createdAt`.
   - Unique: `[memberId, source, referenceId]`.
5. **`ReconciliationAudit` (`reconciliation_audits`)**:
   - `id`, `memberId`, `oldBB`, `calculatedBB`, `bbDiscrepancy`, `oldMatching`, `calculatedMatching`, `matchingDiscrepancy`, `oldLeftVolume`, `calculatedLeftVolume`, `oldRightVolume`, `calculatedRightVolume`, `oldLevel`, `calculatedLevel`, `promoted`, `hasDiscrepancy`, `discrepancyDetails`, `reason`, `actor`, `createdAt`.

---

## 11. Admin Operations

Administrators perform maintenance and auditing via RBAC-protected tools:
- **On-Demand Single Member Audit**: Verifies that a distributor's profile aligns with ledger history.
- **Mass Network Recalculation**: Run periodically or after bonus period finalization to sync derived volume caches.
- **Dry-Run Auditing**: Passing `dryRun: true` in reconciliation computes discrepancies without writing changes to the database.
- **Discrepancy Investigation**: Filter reconciliation history by `hasDiscrepancy: true` to isolate members requiring manual review.

---

## 12. Recalculation & Reconciliation Process

### Safe Batch Processing
To support networks exceeding 1,000,000 distributors without memory exhaustion ($O(\text{batchSize})$ space complexity):
1. Determine total population: `SELECT COUNT(*) FROM distributor_profiles`.
2. Fetch members in bounded chunks using cursor-based pagination:
   ```ts
   take: batchSize,
   cursor: cursor ? { id: cursor } : undefined,
   skip: cursor ? 1 : 0,
   orderBy: { id: 'asc' }
   ```
3. Process each member inside an isolated transaction and row lock.
4. Compute discrepancies between cached profile totals and authoritative ledger aggregates.
5. If discrepancies are found, update profile and write immutable `ReconciliationAudit` and platform `AuditLog`.
6. Progress notifications emitted to logging or external streaming consumers.

---

## 13. Error Handling & Failure Atomicity

Every multi-step volume and level change adheres to the transactional pipeline:

$$\text{Validate Event} \rightarrow \text{Create Ledger Tx} \rightarrow \text{Update Volume} \rightarrow \text{Evaluate Level} \rightarrow \text{Promote} \rightarrow \text{Commit}$$

- **Strict Rollback Invariant**: If any step in the pipeline throws an exception (e.g. disk failure during `MemberLevelHistory` write), the **entire database transaction rolls back**.
- **No Partial States**: BB cannot be credited without level evaluation; level cannot be updated without ledger persistence.
- **Sanitized Client Feedback**: Internal database errors, constraint names, and stack traces are suppressed; clients receive structured error codes (`UNAUTHORIZED_FIELD_MODIFICATION`, `RESOURCE_NOT_FOUND`, `INTERNAL_SERVER_ERROR`).

---

## 14. Security Model & Invariants

1. **Zero-Trust Client Field Protection**:
   [`protectMlmFields`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/src/middleware/protectMlmFields.ts) middleware intercepts all incoming HTTP requests. Any client payload attempting to inject `bb`, `currentBB`, `matching`, `currentMatching`, `level`, `currentLevel`, `rank`, or `wallet` is rejected immediately with `400 Bad Request` (`SECURITY_UNAUTHORIZED_FIELD_MODIFICATION`).
2. **Database Non-Negative Constraints**:
   PostgreSQL check constraints ensure volume fields and balances cannot be forced below zero.
3. **Transaction Reference Verification**:
   Before BB or matching is credited, the originating order reference or cycle ID is verified against the database to prevent fraudulent credits.
4. **Distributed Concurrency Lock**:
   Member-specific mutex locks in [`MLMSecurityService`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/src/services/mlmSecurity.service.ts) serialize simultaneous operations on the same distributor, preventing race conditions.
5. **Replay & Idempotency Defense**:
   Duplicate events sharing identical `(memberId, source, referenceId)` return the existing transaction without incrementing balance or generating duplicate promotion history.

---

## 15. Testing Strategy

The engine is protected by **151 automated tests** across 8 test suites:

| Test Suite | File | Tests | Scope |
|:---|:---|:---:|:---|
| Personal BB Engine | `tests/bb.test.ts` | 12 | Personal volume derivation, idempotency, ledger debits |
| Binary Matching Engine | `tests/matching.test.ts` | 21 | Left/right leg volume, matching formulas, carry-forward |
| Level Promotion Engine | `tests/levelPromotion.test.ts` | 24 | Highest-to-lowest evaluation, mandatory criteria, multi-tier jumps |
| Event Orchestration | `tests/levelPromotionEvent.test.ts` | 16 | Atomic BB/Matching event triggers, rollback verification |
| Master Level Suite | `tests/completeMlmLevelSuite.test.ts` | 29 | Prompt 9 Cases 1-9, concurrency, demotion suppression |
| Member Level APIs | `tests/memberLevelApi.test.ts` | 18 | Member & Admin endpoints, RBAC, input validation |
| Zero-Trust Security | `tests/mlmSecurity.test.ts` | 16 | Field injection blocking, replay attacks, negative balances |
| Reconciliation Engine | `tests/reconciliation.test.ts` | 15 | Batched recalculation, discrepancy detection, ledger preservation |
| **Total** | | **151** | **100% Pass Rate** |

---

*Document Author: Kashvi MLM Engineering Team*  
*Last Updated: September 2026*
