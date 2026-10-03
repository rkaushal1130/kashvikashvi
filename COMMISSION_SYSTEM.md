# KashviMLM Commission System — Production Reference Manual

This document provides a comprehensive, production-grade specification and architectural guide for the KashviMLM Commission Calculation, Distribution, Ledger, Wallet, and Reconciliation Engine.

---

## Table of Contents
1. [Business Volume (BV)](#1-business-volume-bv)
2. [Commission Rates](#2-commission-rates)
3. [Level 1–5 Generational Meaning](#3-level-15-generational-meaning)
4. [Sponsor Hierarchy vs. Binary Placement Hierarchy](#4-sponsor-hierarchy-vs-binary-placement-hierarchy)
5. [Commission Calculation Engine](#5-commission-calculation-engine)
6. [Eligibility & Qualification Engine](#6-eligibility--qualification-engine)
7. [Commission Ledger & Immutability](#7-commission-ledger--immutability)
8. [Wallet Ledger & Atomic Distribution](#8-wallet-ledger--atomic-distribution)
9. [Order Lifecycle & Concurrency Control](#9-order-lifecycle--concurrency-control)
10. [Refund & Commission Reversal System](#10-refund--commission-reversal-system)
11. [API Architecture & Endpoints](#11-api-architecture--endpoints)
12. [Security Architecture & Zero-Trust Invariants](#12-security-architecture--zero-trust-invariants)
13. [Commission Reconciliation System](#13-commission-reconciliation-system)
14. [Testing & Verification Suite](#14-testing--verification-suite)

---

## 1. Business Volume (BV)

### 1.1 Commission Base Definition
In the KashviMLM platform, **Business Volume (BV)** is the sole authoritative monetary base for unilevel commission calculations.
- Commissions are **never** calculated directly from retail price, Maximum Retail Price (MRP), package price, tax, or shipping fees.
- Each order item carries an authoritative BV value determined by product SKU configuration:
$$\text{Order BV} = \sum_{i=1}^{n} (\text{Item BV}_i \times \text{Quantity}_i)$$

### 1.2 Authoritative Resolution & Tamper Resistance
- Resolved server-side by `AuthoritativeBVService.resolveAuthoritativeBV(orderId)`.
- Client applications, browsers, mobile apps, or distributors are **strictly blocked** from passing, overriding, or tampering with BV in any payload.
- Any request attempting to supply `businessVolume`, `totalBV`, or `bv` is rejected by `protectMlmFields` and `assertNoCommissionFieldOverrides` with HTTP 400 Bad Request and logged as a high-severity security alert.

---

## 2. Commission Rates

### 2.1 5-Level Unilevel Rate Schedule
The unilevel commission structure distributes bonuses across 5 generational upline tiers:

| Tier | Level | Percentage | Payout on ₹10,000 BV | Payout on ₹1,000 BV |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | Direct Sponsor | **24.00%** | ₹2,400.00 | ₹240.00 |
| **Level 2** | Sponsor's Sponsor | **8.00%** | ₹800.00 | ₹80.00 |
| **Level 3** | Third Upline | **13.00%** | ₹1,300.00 | ₹130.00 |
| **Level 4** | Fourth Upline | **5.00%** | ₹500.00 | ₹50.00 |
| **Level 5** | Fifth Upline | **4.00%** | ₹400.00 | ₹40.00 |
| **TOTAL** | — | **54.00%** | **₹5,400.00** | **₹540.00** |

### 2.2 Maximum Theoretical Distribution
The total theoretical distribution cap across all 5 tiers is exactly **54.00%** of the order's commissionable BV.
- The remaining 46.00% represents corporate gross margin and operational pool allocations.
- Rates are managed dynamically through `CommissionConfigService` and stored in the `commission_levels` database table.
- Calculations dynamically fetch configured rates with zero floating-point drift, ensuring system adjustments do not require code deployments.

---

## 3. Level 1–5 Generational Meaning

### 3.1 Lineage Mapping
Commission levels strictly represent generational distance in the personal sponsorship lineage:
- **Level 1**: The distributor who directly enrolled/sponsored the purchasing member.
- **Level 2**: The direct sponsor of the Level 1 distributor.
- **Level 3**: The direct sponsor of the Level 2 distributor.
- **Level 4**: The direct sponsor of the Level 3 distributor.
- **Level 5**: The direct sponsor of the Level 4 distributor.

### 3.2 Handling Truncated Lineage (Missing Uplines)
If a distributor’s upline sponsor chain contains fewer than 5 members (for example, a new network branch only 3 levels deep):
- Commissions are calculated and posted **only** for the existing valid upline levels (e.g., Level 1, 2, and 3).
- Levels 4 and 5 are **not created**.
- Unallocated commission percentages remain in the platform treasury and are not reassigned to arbitrary distributors.

---

## 4. Sponsor Hierarchy vs. Binary Placement Hierarchy

### 4.1 Strict Architectural Separation
KashviMLM maintains two completely decoupled network tree graphs:

```
SPONSOR TREE (Unilevel Lineage)            BINARY TREE (Placement Tree)
         [A]                                        [A]
          |                                        /   \
         [B]                                     [X]   [B]
          |                                     /   \
         [C]                                  [C]   [Y]
          |
         [D]
```

1. **Sponsor Tree (`sponsorId` / `sponsorRelationship`)**:
   - Represents personal enrollment genealogy.
   - Authoritatively determines Level 1 through Level 5 upline beneficiaries for unilevel commissions.
2. **Binary Placement Tree (`MLMNode` / `placementParentId` / `placementPosition`)**:
   - Represents the dual-leg (`LEFT` / `RIGHT`) business center structure.
   - Authoritatively determines binary volume pairing and binary balancing bonuses.

### 4.2 Invariance Guarantee
Changing a member's binary placement parent, swapping binary legs, or inserting binary spillover nodes **never** alters or influences the sponsor upline chain or unilevel commission distribution. Verified by Test 10 of the commission test suite.

---

## 5. Commission Calculation Engine

### 5.1 Service Implementation
Implemented in `CommissionCalculationService` and `SafeDecimal`:
- **Formula**:
$$\text{Gross Commission} = \text{Round}\left( \frac{\text{BV} \times \text{Rate Percentage}}{100}, 2 \right)$$
- All calculations utilize fixed-point decimal arithmetic (`SafeDecimal`) avoiding IEEE-754 binary floating-point rounding errors.
- Rounding mode: Half-up to 2 decimal places (exact financial cents/paise).

### 5.2 Edge Cases Handled
- **Zero BV ($BV = 0$)**: Payout is exactly ₹0.00; no ledger transactions created.
- **Self-Sponsoring / Cyclic Traversal**: `SponsorUplineService` validates genealogy graph acyclicity; members can never sponsor themselves or earn Level 1 commissions on personal purchases through fake self-referral loops.
- **Decimal Precision**: Fractions (e.g., ₹1,234.56 BV @ 24% = ₹296.2944) strictly round to ₹296.29 without penny accumulation errors across periods.

---

## 6. Eligibility & Qualification Engine

### 6.1 Rules Evaluated
Implemented in `CommissionEligibilityService`:
1. **Active Account Status**: Beneficiary distributor account status must be `ACTIVE`. Accounts marked `SUSPENDED`, `BLOCKED`, `PENDING_KYC`, or soft-deleted are bypassed.
2. **KYC Verification**: Where platform policy mandates KYC compliance for payouts, unverified members have commissions posted as `PENDING` rather than immediate wallet distribution.
3. **Rank Independence**: Member ranks (`SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`, `RUBY`) govern executive leadership pools and matching bonuses, but **do not** reduce or manipulate unilevel commission rates unless explicit qualification tier rules are configured.

---

## 7. Commission Ledger & Immutability

### 7.1 Database Model (`commission_transactions`)
Every commission award produces a permanent, immutable record in `CommissionTransaction`:
- `id`: UUID primary key.
- `orderId`: Foreign key to `Order`.
- `recipientMemberId`: Foreign key to `DistributorProfile` (beneficiary).
- `sourceMemberId`: Foreign key to `DistributorProfile` (purchaser).
- `commissionLevel`: Unilevel level (1–5).
- `businessVolume`: Authoritative BV of the order.
- `percentage`: Exact rate percentage applied (e.g., 24.00).
- `grossCommissionAmount`: Total commission calculated.
- `status`: `PENDING` | `APPROVED` | `AVAILABLE` | `PAID` | `REVERSED` | `CANCELLED`.
- `idempotencyKey`: Unique business reference (`COMM:{orderId}:L{level}:{recipientId}`).
- `walletTransactionId`: Foreign key linking to the corresponding wallet credit entry.

### 7.2 Idempotency & Composite Constraints
- Enforced at the database engine level via:
  ```prisma
  @@unique([orderId, recipientMemberId, commissionLevel])
  @@unique([idempotencyKey])
  ```
- Prevents accidental duplicates from concurrent execution or network retries.
- Immutable Ledger Principle: Records in `commission_transactions` are **never deleted**. Corrections occur solely via offsetting compensatory reversals.

---

## 8. Wallet Ledger & Atomic Distribution

### 8.1 Double-Entry Posting
Commissions are posted atomically via `AtomicCommissionPostingService` and `CommissionWalletService`.
Within a single database transaction (`prisma.$transaction`):
1. Create `CommissionTransaction` record with status `PAID`.
2. Create `WalletTransaction` with type `COMMISSION` or `CREDIT` linked to the commission ID.
3. Increment `Wallet.availableBalance` and `Wallet.balance` by the net amount.
4. Update `CommissionTransaction.walletTransactionId`.

### 8.2 Atomic Rollback Guarantee
If any step in the posting sequence fails (e.g., wallet lock contention or constraint violation), the entire database transaction aborts. No orphaned commissions or unbacked wallet balances can occur.

---

## 9. Order Lifecycle & Concurrency Control

### 9.1 Lifecycle States Triggering Commission
Handled by `OrderCommissionLifecycleService`:
- Orders trigger commission calculation upon reaching `PAID`, `CONFIRMED`, or `DELIVERED` status.
- Unpaid, pending payment, or abandoned checkout orders do not generate commissions.

### 9.2 Concurrency Mutex & Replay Defense
- Memory-level execution locks serialize requests for the same `orderId` or `distributorId`.
- Duplicate webhook payloads from payment gateways (e.g., Razorpay/Stripe webhook retries) are de-duplicated via cryptographic webhook signatures and the order payment status machine.
- Calling `processOrderCommission(orderId)` multiple times executes exactly once and returns `isIdempotentSkip: true`.

---

## 10. Refund & Commission Reversal System

### 10.1 Compensatory Reversal Model
Handled by `CommissionReversalService` and stored in `commission_reversals`:
- Original `CommissionTransaction` records remain in the database for auditing with status updated to `REVERSED`.
- An immutable `CommissionReversal` record is inserted with negative amount.
- An offsetting `DEBIT` / `REVERSAL` transaction is posted to the beneficiary's wallet.

### 10.2 Partial Refund Proportionality
For partial refunds (e.g., 50% return on multi-item orders):
$$\text{Reversal Ratio} = \frac{\text{Refunded BV}}{\text{Original Order BV}}$$
$$\text{Reversal Amount} = \text{Round}(\text{Original Commission} \times \text{Reversal Ratio}, 2)$$
Commissions are reversed proportionally across all 5 levels without manual intervention.

### 10.3 Wallet Deficit / Negative Balance Recovery
If a distributor withdraws wallet funds prior to an order refund:
- The wallet balance becomes negative (`availableBalance < 0`), or
- The system marks `recoveryStatus: NEGATIVE_BALANCE_APPLIED` and logs an unrecovered deficit.
- Future commission earnings automatically offset the negative balance before payouts resume.

---

## 11. API Architecture & Endpoints

### 11.1 Member Endpoints (Self-Service)
- `GET /api/v1/members/dashboard/commissions`:
  Database-aggregated member dashboard summary.
  - Totals: Total, Pending, Available, Paid, Reversed Commission.
  - Level 1–5 breakdown: BV processed, commission earned, transaction count, percentage.
  - Paginated recent transactions.
- `GET /api/v1/members/me/commissions`:
  Paginated personal commission transaction list with filter support.

### 11.2 Administrative Endpoints (Admin-Only)
Protected under `authenticate` and `authorizeRoles('SUPER_ADMIN', 'ADMIN')`:
- `GET /api/v1/admin/commissions`:
  Audit list with multi-parameter filtering (member, source member, order, level, status, date range).
- `POST /api/v1/admin/orders/:orderId/process-commission`:
  Authoritatively triggers order commission generation. Rejects all parameter overrides.
- `POST /api/v1/admin/commissions/:commissionId/reverse`:
  Authoritatively reverses a single commission with persistent audit justification.
- `POST /api/v1/admin/commissions/reconcile/order/:orderId`:
  Executes comprehensive 4-plane audit on a specific order.
- `POST /api/v1/admin/commissions/reconcile/member/:memberId`:
  Audits member wallet balance, transaction ledger sum, and commission records.
- `POST /api/v1/admin/commissions/reconcile/period`:
  Sweeps all orders and commissions across a specified date window.

---

## 12. Security Architecture & Zero-Trust Invariants

### 12.1 Parameter Tampering Guards
The commission system operates under a **Zero-Trust Client Invariant**:
- A user can never submit a request like:
  ```json
  {
    "commission": 500000,
    "level": 1,
    "recipientMemberId": "my-id"
  }
  ```
- Any client attempting to provide financial fields is rejected by `assertNoCommissionFieldOverrides`.
- An audit alert `COMMISSION_SECURITY_VIOLATION_PAYLOAD_TAMPERING` is persistently logged.

### 12.2 Role-Based Access Control (RBAC)
- All administrative reconciliation, manual trigger, and reversal routes enforce `SUPER_ADMIN` and `ADMIN` role checks.
- Non-admin users attempting to access admin endpoints receive `403 Forbidden`.
- Unauthenticated requests receive `401 Unauthorized`.

---

## 13. Commission Reconciliation System

### 13.1 Comparison Engine
Cross-checks records across 4 system planes:
1. `Order` records and status.
2. `Business Volume` definitions.
3. `CommissionTransaction` ledger entries.
4. `WalletTransaction` and `Wallet` balances.

### 13.2 Detected Discrepancies
1. `MISSING_COMMISSION`: Expected upline member missing commission on an eligible paid order.
2. `DUPLICATE_COMMISSION`: Multiple commission transactions for the same order and level.
3. `INCORRECT_COMMISSION_AMOUNT`: Commission amount deviates from calculated rate.
4. `INCORRECT_RECIPIENT`: Commission recipient does not match true sponsor upline.
5. `INCORRECT_COMMISSION_LEVEL`: Recorded level outside bounds (1–5).
6. `WALLET_MISMATCH`: Unlinked wallet transaction, amount drift, or wallet balance out of sync with ledger transactions.
7. `REVERSAL_MISMATCH`: Refunded order missing reversal or excessive reversal amount.

### 13.3 Non-Destructive Operation
- Reconciliation **never** modifies or deletes database records by default.
- Discrepancies are catalogued with severity ratings (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) for administrative review.
- Safe automated correction applies strictly to isolated missing commissions on paid orders when `autoCorrect: true` is explicitly passed.

---

## 14. Testing & Verification Suite

The commission system is guarded by 12 dedicated automated test suites in `backend/tests/`:

```
backend/tests/
├── commissionCalculation.test.ts       # Mathematical precision & rate verification
├── commissionEligibility.test.ts       # Account status & qualification checks
├── commissionLedger.test.ts            # Ledger creation & idempotency constraints
├── atomicCommissionPosting.test.ts      # Double-entry posting & rollback verification
├── commissionWallet.test.ts            # Wallet credit & balance synchronization
├── orderCommissionLifecycle.test.ts    # Order status transitions & idempotency skips
├── commissionReversal.test.ts          # Full & partial refund reversals
├── commissionApi.test.ts               # API endpoints, filters & pagination
├── commissionDashboard.test.ts         # DB aggregation queries & performance
├── commissionSecurity.test.ts          # Zero-trust audit, tampering & RBAC
├── completeCommissionSuite.test.ts     # 14 Canonical specification tests (Prompt 26)
└── commissionReconciliation.test.ts    # 4-plane audit & anomaly detection (Prompt 27)
```

### 14.1 Running All Commission Tests
```bash
# Run complete commission specification suite
npm run test:commission-suite

# Run security audit suite
npm run test:commission-security

# Run reconciliation engine suite
npm run test:commission-reconciliation

# Run dashboard aggregation suite
npm run test:commission-dashboard

# Run API contract suite
npm run test:commission-api
```
All tests run with zero warnings, zero floating-point discrepancies, and complete atomicity verification.
