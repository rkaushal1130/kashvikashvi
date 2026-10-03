# Kashvimlm Normalized Database Schema & Architecture

## Overview

The Kashvimlm database is a fully normalized relational schema modeled in PostgreSQL via Prisma ORM for an enterprise-grade Multi-Level Marketing (MLM) and distributor management platform.

---

## Key Design Principles

### 1. Separation of Sponsor vs Binary Placement
- **Sponsor (Enroller) Tree**:
  - Tracked via `DistributorProfile.sponsorId` (direct referral relationship).
  - Multi-level lineage is materialized via `SponsorRelationship` with hierarchical depth indexing for unilevel calculation.
- **Binary Placement Tree**:
  - Tracked strictly via `MLMNode` with `placementParentId` and `placementPosition` (`LEFT` | `RIGHT`).
  - Strict database constraint: `@@unique([placementParentId, placementPosition])` prevents more than one node in any binary position.
  - **`sponsorId` is NEVER used as the binary parent.**

### 2. Multi-Business Center Architecture
- Each distributor can operate multiple business centers (e.g., BC1, BC2, BC3).
- Every `BusinessCenter` has its own unique binary tree node (`MLMNode`), allowing distributors to accumulate and match volume across independent legs.
- Controlled via `BusinessCenter.centerNumber` and unique `BusinessCenter.centerCode`.

### 3. Financial Precision
- All monetary amounts use `Decimal(12, 2)`. Floating-point types are strictly forbidden.
- Business Volume (BV) and Personal Volume (PV) use `Decimal(12, 2)` to preserve fractional calculations.

### 4. Integrity & Auditability
- Append-only transactional ledgers:
  - `BVLedger`: Tracks every volume point accrual, placement leg, flush, and commission deduction.
  - `WalletTransaction`: Tracks every balance increment and deduction with before/after balances.
  - `InventoryTransaction`: Tracks stock adjustments and order fulfillment.
  - `AuditLog`: Captures sensitive user actions, status changes, and data changes.
- Soft deletion via `deletedAt` on critical entities (`User`, `DistributorProfile`, `Customer`, `Product`, `Order`, `BankAccount`).

---

## 47 Entities Summary

| # | Entity | Description |
|---|---|---|
| 1 | `User` | Authentication identity, credentials, roles, and status |
| 2 | `Role` | System roles (`ADMIN`, `DISTRIBUTOR`, `CUSTOMER`, `SUPPORT`) |
| 3 | `DistributorProfile` | Distributor core record, ranks, sponsor link, lifetime volumes |
| 4 | `DistributorStatusHistory` | Status transition logs with reasons and audit trail |
| 5 | `Customer` | Retail and preferred customers referred by distributors |
| 6 | `SponsorRelationship` | Unilevel sponsorship lineage matrix with depth |
| 7 | `BusinessCenter` | Multiple business centers per distributor (BC1, BC2, BC3) |
| 8 | `MLMNode` | Binary tree node (`LEFT`/`RIGHT`), independent of sponsor |
| 9 | `Address` | Shipping, billing, and legal addresses |
| 10 | `KYCProfile` | Identity verification documents, status, tax ID |
| 11 | `BankAccount` | Bank details for commission disbursements |
| 12 | `SecurityProfile` | 2FA state, login attempts, lockout timestamp |
| 13 | `Product` | Catalog items with SKU, retail/distributor price, BV points |
| 14 | `ProductCategory` | Hierarchical product categories |
| 15 | `ProductImage` | Product galleries with display order |
| 16 | `Inventory` | Stock levels, reserved units, reorder thresholds |
| 17 | `InventoryTransaction` | Stock in/out/adjustment ledger |
| 18 | `Cart` | User and customer active shopping cart |
| 19 | `CartItem` | Line items in cart |
| 20 | `Order` | Order header with order number, BV, addresses, status |
| 21 | `OrderItem` | Line items with unit price and unit BV |
| 22 | `Payment` | Payment transactions, methods, and gateway tracking |
| 23 | `BVLedger` | Real-time Business Volume credit/debit audit trail |
| 24 | `CommissionPeriod` | Weekly/Monthly calculation cycles (open, locked, finalized) |
| 25 | `CommissionRule` | Dynamic compensation plan rules, caps, and percentages |
| 26 | `Commission` | Calculated commission records per distributor per period |
| 27 | `Bonus` | Fast start, rank achievement, leadership pool bonuses |
| 28 | `Wallet` | E-wallet balance, pending balance, withdrawal tracking |
| 29 | `WalletTransaction` | Detailed balance ledger with running balances |
| 30 | `PayoutRequest` | Distributor payout withdrawal requests |
| 31 | `Rank` | Rank definitions, qualifications (PV/GV/Legs), and caps |
| 32 | `DistributorRankHistory` | Rank achievements timeline and qualifying volumes |
| 33 | `Badge` | Gamification badge master definitions |
| 34 | `DistributorBadge` | Badges awarded to distributors |
| 35 | `TrainingCourse` | LMS course catalogs with rank prerequisites |
| 36 | `TrainingLesson` | Individual course lessons with video and content |
| 37 | `TrainingProgress` | Distributor course completion progress |
| 38 | `DistributorWebsite` | Replicated distributor websites with unique subdomains |
| 39 | `WebsiteLink` | Referral links with click and conversion tracking |
| 40 | `News` | Platform announcements and company news |
| 41 | `SupportTicket` | Customer and distributor helpdesk tickets |
| 42 | `SupportMessage` | Threaded ticket communication |
| 43 | `Notification` | System notifications, alerts, and recognition |
| 44 | `Enrollment` | Multi-step distributor enrollment wizard |
| 45 | `EnrollmentStep` | State and payload per enrollment step |
| 46 | `AuditLog` | Comprehensive security and administrative audit log |
| 47 | `SystemSetting` | Key-value application configurations |

---

## Applying Migrations & Seeding

```bash
# 1. Run migration against PostgreSQL database
npx prisma migrate dev --name init

# Or deploy migration in production/CI
npx prisma migrate deploy

# 2. Seed database
npm run prisma:seed
```
