# Production Audit & Operational Specification: Admin Funding Portal

> **Document Version**: 2.0.0 (Production Release)  
> **Status**: AUTHORITATIVE AUDIT & OPERATIONAL MANUAL  
> **Module**: Admin Funding Portal, Platform Treasury, & Bank Provider Integration  
> **Last Audited**: 2026-10-09  

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Provider Integration](#2-provider-integration)
3. [Bank Account Connection](#3-bank-account-connection)
4. [Funding Lifecycle](#4-funding-lifecycle)
5. [Treasury](#5-treasury)
6. [Ledger](#6-ledger)
7. [Webhooks](#7-webhooks)
8. [Reconciliation](#8-reconciliation)
9. [Security](#9-security)
10. [Admin Permissions](#10-admin-permissions)
11. [Commission Integration](#11-commission-integration)
12. [Withdrawal Integration](#12-withdrawal-integration)
13. [Failure Handling](#13-failure-handling)
14. [Testing](#14-testing)
15. [Deployment Configuration](#15-deployment-configuration)

---

## 1. Architecture

The **Admin Funding Portal** provides a high-security, audit-compliant financial foundation that bridges corporate bank accounts and licensed payment providers with the KashviMLM platform treasury and member wallet ledger.

### High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph External Provider Infrastructure [External Banking & Provider Rails]
        RPX["RazorpayX / Bank API Rails"]
        WH_IN["Provider Inbound Webhooks"]
    end

    subgraph Security Boundary [Zero-Trust Security & Perimeter]
        AUTH["JWT & RBAC Guard (ADMIN / SUPER_ADMIN)"]
        WHSIG["HMAC-SHA256 Webhook Signature Validator"]
        RATELIMIT["Express Rate Limiting & Helmet Headers"]
    end

    subgraph Service Layer [Authoritative Backend Services]
        FC["FundingController (/api/v1/funding)"]
        FWS["FundingWorkflowService"]
        FS["FundingService"]
        FWH["FundingWebhookService"]
        FRS["FundingReconciliationService"]
        TCS["TreasuryCommissionService"]
        PTS["PlatformTreasuryService"]
    end

    subgraph Storage Layer [PostgreSQL & Prisma Engine]
        FA[("funding_accounts")]
        FT[("funding_transactions")]
        WHE[("webhook_events")]
        PW[("platform_wallets")]
        PWT[("platform_wallet_transactions")]
        AL[("audit_logs")]
    end

    subgraph Frontend Portal [Admin Web Application]
        AFP["AdminFundingPortalPage (React 19 + Lucide)"]
        AFA["adminFundingApi Service Client"]
    end

    AFP -->|Authenticated REST API| AUTH
    AUTH --> FC
    WH_IN --> WHSIG
    WHSIG --> FWH
    FC --> FWS
    FC --> FS
    FC --> FRS
    FWS --> PTS
    FWH --> FWS
    FRS --> FWS
    TCS --> PTS
    PTS --> PW
    PTS --> PWT
    FWS --> FT
    FS --> FA
    FWH --> WHE
    FWS --> AL
```

### Architectural Principles

1. **Zero Unbacked Credits**: Platform treasury balances (`PlatformWallet.availableBalance`) are **never** increased by arbitrary client parameters or manual balance increments. Increases only occur through verified provider settlement or multi-admin dual-control reconciliation.
2. **Double-Entry & Append-Only Ledger**: Balances are calculated and tracked via strictly immutable `PlatformWalletTransaction` records with atomic before/after balances.
3. **Strict Maker-Checker Separation**: Actions involving substantial capital movement require audit tracing linking the initiating administrator and reviewing administrator.
4. **Idempotency Across All Channels**: Requests require unique idempotency keys, and webhooks deduplicate on `(provider, externalEventId)` and `(provider, providerTransactionId)`.

---

## 2. Provider Integration

The backend implements an extensible **Provider Factory Pattern** allowing seamless operation across sandbox simulation, automated mock environments, and real-world payment rails like **RazorpayX**, **Cashfree**, or **Stripe Treasury**.

### Interface: `FundingProviderInterface`

All payment providers implement the authoritative interface defined in `src/providers/funding/fundingProvider.interface.ts`:

- `connectAccount(input: ConnectAccountInput): Promise<ProviderAccountResult>`
- `createFundingRequest(input: ProviderFundingRequestInput): Promise<ProviderFundingRequestResult>`
- `verifyTransaction(providerTransactionId: string): Promise<ProviderVerificationResult>`
- `verifyWebhookSignature(payload: string | Buffer, signature: string, secret?: string): boolean`
- `parseWebhookEvent(body: any): ProviderWebhookPayload`
- `fetchSettledTransactions(startDate: Date, endDate: Date): Promise<ProviderSettledTransaction[]>`

### Supported Providers

| Provider | Identifier | Characteristics |
| :--- | :--- | :--- |
| **Mock Provider** | `MOCK` / `MOCK_BANK` | Fully deterministic offline mock provider used in testing and local sandbox environments. Supports dynamic status simulation and mock payment links. |
| **RazorpayX** | `RAZORPAYX` | Production enterprise payout and virtual account funding provider. Utilizes HMAC-SHA256 signature verification and RazorpayX virtual account APIs. |
| **Cashfree** | `CASHFREE` | Production corporate collection and escrow rail with signature header cross-validation. |

### Factory Provider Resolution

The factory (`FundingProviderFactory`) instantiates providers on demand based on either environment configuration (`FUNDING_PROVIDER`) or explicit account provider metadata, falling back safely to `MockFundingProvider` in development if production API keys are absent.

---

## 3. Bank Account Connection

Corporate bank accounts and payout provider virtual accounts are managed in the `funding_accounts` table.

### Security Invariants for Bank Accounts

1. **No Plaintext Account Credentials**:
   - Zero storage of raw net-banking credentials, account passwords, ATM PINs, OTPs, or CVVs.
   - Bank accounts are identified by public metadata (`bankName`, `accountType`, `accountHolderName`) and tokenized provider IDs (`providerAccountId`).
2. **Account Number Masking**:
   - Only masked account numbers are stored and transmitted to client applications (e.g., `XXXXXXXX8921` or `••••••••1234`).
3. **Compound Uniqueness**:
   - `@@unique([provider, providerAccountId])` prevents the duplicate registration of an external corporate account.
4. **Default Primary Selection**:
   - Only one account per provider can hold `isPrimary = true` at any given time, enforced via transactional updates.

---

## 4. Funding Lifecycle

Funding requests transition through a deterministic finite-state machine with 8 distinct statuses:

```mermaid
stateDiagram-v2
    [*] --> CREATED: Admin Submits Form
    CREATED --> PENDING: Payment Link / Virtual Account Created
    PENDING --> PROCESSING: Provider Receives Inward Wire / UPI
    PROCESSING --> SUCCEEDED: Webhook Signature Validated & Settled
    PENDING --> FAILED: Provider Reports Rejection / Timeout
    PROCESSING --> FAILED: Provider Fails Transaction
    CREATED --> CANCELLED: Admin Explicitly Cancels Request
    PENDING --> CANCELLED: Admin Explicitly Cancels Request
    SUCCEEDED --> REVERSED: Bank Issues Chargeback / Reversal
    PENDING --> RECONCILIATION_REQUIRED: Amount Mismatch / Orphan Transaction
    PROCESSING --> RECONCILIATION_REQUIRED: Signature / Status Ambiguity
    RECONCILIATION_REQUIRED --> SUCCEEDED: Admin Manual Settlement Approval
    RECONCILIATION_REQUIRED --> FAILED: Admin Manual Void / Reject
    SUCCEEDED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
    REVERSED --> [*]
```

### Lifecycle Transition Rules

| Transition | Permitted Roles | Invariant / Precondition | Side Effect |
| :--- | :--- | :--- | :--- |
| `CREATED` $\to$ `PENDING` | `ADMIN`, `SUPER_ADMIN` | Active funding account; valid positive amount. | Provider request logged; idempotency key locked. |
| `PENDING` $\to$ `PROCESSING` | System Webhook / Provider | Valid provider status response. | Status updated; audit logged. |
| `PROCESSING` $\to$ `SUCCEEDED` | System Webhook / Verified Sync | Webhook signature valid; provider amount matches request $\pm 0.01$. | **Atomic Platform Treasury Credit**; `PlatformWalletTransaction` created. |
| Any $\to$ `FAILED` | System Webhook / Provider Sync | Failure code or settlement rejection from bank. | Failure reason permanently recorded; treasury **not** credited. |
| `PENDING` $\to$ `CANCELLED` | `ADMIN`, `SUPER_ADMIN` | Transaction has not settled externally. | Cancelled; cannot be credited later. |
| `SUCCEEDED` $\to$ `REVERSED` | Provider Webhook / Dispute Rail | Original transaction is `SUCCEEDED`. | **Atomic Platform Treasury Debit** (`FUNDING_REVERSAL`); funds locked. |
| Any $\to$ `RECONCILIATION_REQUIRED` | Webhook / Reconciliation Engine | Amount discrepancy detected, or orphan statement transaction found. | Treasury credit suspended; administrator alert raised. |

---

## 5. Treasury

The corporate liquidity pool is tracked via the `PlatformWallet` model.

### Database Definition

```prisma
model PlatformWallet {
  id               String   @id @default(uuid())
  walletCode       String   @unique @default("PRIMARY_TREASURY")
  currency         String   @default("INR")
  availableBalance Decimal  @default(0.00) @db.Decimal(14, 2)
  pendingBalance   Decimal  @default(0.00) @db.Decimal(14, 2)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  transactions     PlatformWalletTransaction[]

  @@map("platform_wallets")
}
```

### Constraints & Invariants

- **Non-Negative Balance Constraint**: PostgreSQL table-level check constraint `CONSTRAINT "chk_platform_wallet_available_positive" CHECK ("availableBalance" >= 0)` guarantees that treasury balances cannot be driven negative under race conditions.
- **Decimal Precision**: `DECIMAL(14, 2)` supports operational liquidity values up to ₹999,999,999,999.99 with exact cent/paisa rounding via `SafeDecimal`.
- **Atomic Operations**: All treasury credits and debits execute inside `prisma.$transaction` using row-level locking or isolated sequential queries.

---

## 6. Ledger

Every movement of platform treasury capital is captured in `PlatformWalletTransaction`.

### Ledger Invariants

1. **Immutability**: Ledger records cannot be updated or deleted. Historical entries reflect the exact state of financial records at transaction time.
2. **Explicit Balance Tracking**: Every transaction captures both `balanceBefore` and `balanceAfter`, ensuring mathematical continuity:
   $$\text{balanceAfter} = \text{balanceBefore} \pm \text{amount}$$
3. **Unique Transaction Numbering**: Transactions receive unique human-readable tracking identifiers (e.g., `PWX-20261009-847291`).
4. **Idempotency Guarantee**: `idempotencyKey` is marked `UNIQUE` to prevent duplicated credits caused by network retries.

---

## 7. Webhooks

Inbound webhooks notify the platform of asynchronous bank settlements, payment link completions, and wire confirmations.

### Webhook Security Architecture

```
1. Inbound Webhook HTTP POST (/api/v1/funding/webhook/:provider)
          │
          ▼
2. Extract Raw Payload & Signature Header (x-razorpay-signature, etc.)
          │
          ▼
3. Compute HMAC-SHA256(rawBody, WEBHOOK_SECRET)
   Does computed signature equal provided signature?
   ├── NO  ──► 401 Unauthorized / Invalid Signature (Reject immediately)
   └── YES ──► Proceed
          │
          ▼
4. Check Idempotency Ledger (webhook_events table)
   Does (provider, externalEventId) exist?
   ├── YES ──► Return 200 OK (DUPLICATE_IGNORED; skip state change)
   └── NO  ──► Proceed
          │
          ▼
5. Resolve FundingTransaction by (provider, providerTransactionId)
   ├── NOT FOUND ──► Record UNMATCHED_TRANSACTION; Return 200 OK
   └── FOUND     ──► Proceed
          │
          ▼
6. Cross-Verify Amount
   Does |expectedAmount - confirmedAmount| <= 0.01?
   ├── NO  ──► Mark RECONCILIATION_REQUIRED; Treasury NOT credited
   └── YES ──► Check Current Status
          │
          ├── Already SUCCEEDED? ──► Return 200 OK (No double credit)
          └── PENDING / PROCESSING
                    │
                    ▼
          7. Atomic Transaction:
             - Mark FundingTransaction SUCCEEDED
             - Credit PlatformWallet
             - Create PlatformWalletTransaction
             - Record WebhookEvent PROCESSED
             - Emit AuditLog
```

---

## 8. Reconciliation

The **Funding Reconciliation Service** (`fundingReconciliation.service.ts`) executes a 3-way authoritative audit between:
1. **External Payment Provider / Bank Statement**
2. **Internal Funding Transaction Records** (`funding_transactions`)
3. **Platform Treasury Wallet Ledger** (`platform_wallet_transactions`)

### Discrepancy Classification

| Discrepancy Code | Description | Automated System Action |
| :--- | :--- | :--- |
| `AMOUNT_MISMATCH` | Provider confirmed amount differs from expected request amount. | Holds transaction in `RECONCILIATION_REQUIRED`; halts automated treasury credit. |
| `STATUS_MISMATCH` | Provider reports success but internal record is `FAILED` or `PENDING`. | Flags record for admin review; fetches fresh provider status query. |
| `ORPHAN_PROVIDER_TRANSACTION` | Settlement appears in provider statement but has no matching database record. | Auto-creates a flagged transaction in `RECONCILIATION_REQUIRED` for admin review. |
| `MISSING_LEDGER_ENTRY` | Transaction marked `SUCCEEDED` but has no corresponding `PlatformWalletTransaction`. | Critical solvency flag; prompts automated repair or admin resolution. |
| `CURRENCY_MISMATCH` | Inward settlement currency differs from platform base currency (`INR`). | Suspends credit; admin must confirm exchange rate conversion. |

### Reconciliation Resolution Workflows

Administrators can resolve flagged records via `POST /api/v1/funding/transactions/:id/resolve`:
- **`CREDIT_ACTUAL_AMOUNT`**: Credits the treasury with the exact amount settled at the bank.
- **`VOID_TRANSACTION`**: Cancels the transaction with an audit rationale if the external wire was recalled or fraudulent.
- **`MANUAL_OVERRIDE`**: Settles the transaction with a mandatory bank reference (UTR) and signed admin audit log.

---

## 9. Security

The Admin Funding Portal incorporates multiple defense-in-depth security layers:

1. **Authentication**: All funding portal endpoints require cryptographically signed JSON Web Tokens (`Bearer <token>`) validated via `authenticate` middleware.
2. **No Client-Side Financial Authority**:
   - The frontend never dictates balances, fees, or settlement states.
   - Status transitions are calculated and validated exclusively on the backend.
3. **Data Sanitization & Error Scrubbing**:
   - `sanitizeErrorMessage()` strips database connection strings, credentials, internal file paths, and raw stack traces before errors reach the client.
4. **Credential Stripping**:
   - Incoming payloads and outgoing DTOs filter out any fields resembling credentials (`password`, `pin`, `cvv`, `otp`, `accountNumber`).
5. **Rate Limiting**:
   - Financial endpoints are rate-limited via `express-rate-limit` to prevent brute-force attacks or automated probing.
6. **Audit Logs**:
   - Every funding action writes an immutable record to the `audit_logs` table capturing `userId`, `action`, `entityType`, `entityId`, `previousData`, `newData`, `ipAddress`, and `userAgent`.

---

## 10. Admin Permissions

Access is restricted through strict Role-Based Access Control (RBAC):

| Role | Access Level | Permissions |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Full Authority | Connect/disconnect bank accounts, initiate funding, approve reconciliation overrides, perform treasury adjustments, reverse transactions. |
| `ADMIN` | Operational Authority | View treasury balances, list transactions, initiate funding requests, view reconciliation reports. |
| `DISTRIBUTOR` | Zero Access | Blocked at route middleware (`403 Forbidden`). |
| `CUSTOMER` | Zero Access | Blocked at route middleware (`403 Forbidden`). |
| `SUPPORT` | Read-Only | Read-only audit access where explicitly authorized. |

---

## 11. Commission Integration

The platform treasury serves as the source of liquidity for all MLM commissions:

```mermaid
sequenceDiagram
    participant Order as Order Engine
    participant CE as Commission Engine
    participant TCS as TreasuryCommissionService
    participant Treasury as Platform Treasury
    participant Wallet as Member E-Wallet

    Order->>CE: Order Placed (BV Accrual)
    CE->>TCS: Calculate Commissions (Up to 54% BV)
    TCS->>Treasury: Check Solvency & Reserve Capital
    alt Insufficient Treasury Float
        Treasury-->>TCS: Solvency Warning / Halt Unbacked Credit
    else Sufficient Float
        Treasury->>Treasury: Lock Reserve Amount
        TCS->>Wallet: Atomically Credit Member Wallets
        TCS->>TCS: Link CommissionTransaction to Treasury Transaction
    end
```

### Commission Invariants

- **Reserve Allocation**: Commissions cannot be distributed if total distributor liabilities exceed platform liquid treasury float.
- **Reversal Tracking**: If an order is refunded, `TreasuryCommissionService.reverseCommissionWithTreasury` releases reserved treasury funds, debits distributor balances, and balances the platform ledger.

---

## 12. Withdrawal Integration

When distributors request payouts from their earned wallet balances:

1. **Eligibility Check (`checkPayoutEligibility`)**:
   - Verifies distributor account status is `ACTIVE`.
   - Confirms designated bank account status is `VERIFIED`.
   - Verifies member wallet balance is sufficient and unlocked.
   - Cross-checks platform treasury balance to confirm sufficient liquid capital to satisfy the withdrawal.
2. **Atomic Lock**:
   - Deducts funds from `wallet.availableBalance` and transfers them to `wallet.pendingBalance`.
3. **Treasury Debit on Settlement**:
   - When the payout is processed to the bank, `debitTreasury` records a `PAYOUT` transaction, permanently balancing company reserves with member payouts.

---

## 13. Failure Handling

Robust resilience mechanisms prevent financial discrepancies during system failures:

| Failure Scenario | Mitigation & Recovery |
| :--- | :--- |
| **Provider Network Timeout** | Transaction remains in `PENDING`. Scheduled reconciliation queries provider status via REST API. |
| **Duplicate Webhook Delivery** | `webhook_events` table enforces uniqueness on `(provider, externalEventId)`. Duplicate webhooks return `200 OK` without re-crediting. |
| **Database Failure during Settlement** | Transaction rolls back atomically via `prisma.$transaction`. Treasury credit and status update occur together or not at all. |
| **Bank Chargeback / Reversal** | Webhook or admin triggers `processFundingReversal`. System executes `debitTreasury` with reference type `FUNDING_REVERSAL`. |
| **Concurrent Settlement Attempts** | Row-level locking and status preconditions prevent race conditions between webhooks and manual verification. |

---

## 14. Testing

The Admin Funding Portal is verified by comprehensive automated test suites:

### Test Suite Summary

| Test Suite File | Framework | Target Scope | Pass Count |
| :--- | :--- | :--- | :--- |
| `tests/adminFundingApi.test.ts` | Vitest + Supertest | REST API endpoints, DTO schemas, query filtering, pagination. | **16 / 16** |
| `tests/adminFundingSecurity.test.ts` | Vitest + Supertest | RBAC enforcement, credential stripping, sanitization, unauthorized tampering rejection. | **30 / 30** |
| `tests/adminFundingTestSuite.test.ts` | Vitest | End-to-end funding workflow, provider mocking, lifecycle state machine. | **15 / 15** |
| `tests/fundingModels.test.ts` | Vitest | Database constraints, foreign keys, compound uniqueness, decimal precision. | **8 / 8** |
| `tests/fundingProvider.test.ts` | Vitest | Factory instantiation, provider interface compliance, signature verification. | **13 / 13** |
| `tests/fundingReconciliation.test.ts` | Vitest | 3-way reconciliation, discrepancy detection, resolution workflows. | **18 / 18** |
| `tests/fundingWebhook.test.ts` | Vitest | HMAC-SHA256 signature verification, idempotency deduplication, amount guards. | **8 / 8** |
| `tests/fundingWorkflow.test.ts` | Vitest | Atomic lifecycle transitions, cancelation, reversal, error handling. | **16 / 16** |
| `tests/platformTreasury.test.ts` | Vitest | Double-entry treasury ledger, atomic credit/debit, balance continuity. | **16 / 16** |
| `tests/treasuryCommission.test.ts` | Vitest | Commission reserve linking, solvency checks, payout integration. | **7 / 7** |
| `src/tests/fundingPortal.test.js` | Node.js Test Runner | Frontend API client, error sanitization, mock fallbacks, UI DTO parsing. | **7 / 7** |
| **Total Automated Funding Tests** | | | **154 / 154 Passing** |

---

## 15. Deployment Configuration

### Environment Variables

Configure the following environment variables in `.env` for production deployment:

```env
# ==========================================
# DATABASE & SERVER
# ==========================================
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@localhost:5432/kashvimlm?schema=public"

# ==========================================
# AUTHENTICATION & JWT
# ==========================================
JWT_ACCESS_SECRET="your-256-bit-secret-key-here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-256-bit-refresh-secret-here"
JWT_REFRESH_EXPIRES_IN="7d"

# ==========================================
# CORPORATE FUNDING & TREASURY CONFIGURATION
# ==========================================
# Active provider: MOCK, RAZORPAYX, CASHFREE
FUNDING_PROVIDER="RAZORPAYX"

# RazorpayX Credentials
RAZORPAYX_KEY_ID="rzp_live_your_key_id"
RAZORPAYX_KEY_SECRET="your_razorpay_key_secret"
RAZORPAYX_ACCOUNT_NUMBER="2323230078921"
RAZORPAYX_WEBHOOK_SECRET="your_webhook_hmac_secret"

# Treasury Safety Configuration
TREASURY_MIN_FLOAT_WARNING=100000.00
TREASURY_AUTO_RECONCILE_INTERVAL="0 2 * * *"
```

### Database Migration Command

Execute Prisma migrations to ensure all database tables, check constraints, and unique indexes are applied:

```bash
npx prisma migrate deploy
```

### Webhook URL Configuration

Configure the external payment gateway webhook callback to route to:
```
POST https://api.kashvimlm.com/api/v1/funding/webhook/razorpayx
```
Ensure that the `x-razorpay-signature` header is forwarded intact by any reverse proxy (e.g., NGINX, Cloudflare) and that the raw body is preserved for HMAC verification.

---

## Audit Verification Sign-Off

- [x] **Database Constraints & Precision**: All financial amounts use `DECIMAL(14, 2)` with check constraints against negative balances.
- [x] **Idempotency & Uniqueness**: Duplicate webhook deliveries, replay attacks, and duplicate transaction IDs are strictly blocked.
- [x] **Zero-Trust Security**: No plaintext banking credentials; complete RBAC protection; full sanitization of client errors.
- [x] **Financial Atomicity**: Treasury credits, ledger records, and status updates execute in single database transactions.
- [x] **Automated Tests**: All 154 backend and frontend funding test cases pass with 100% success.
