# Kashvimlm Backend API Documentation

Base URL: `/api/v1`

---

## Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Standard Error Response

```json
{
  "success": false,
  "message": "Invalid credentials",
  "code": "AUTH_INVALID_CREDENTIALS",
  "errors": []
}
```

---

## Dashboard Endpoint (`/api/v1/dashboard`)

### `GET /api/v1/dashboard`
Returns aggregated data matching the frontend portal layout (Owner, volume, commission points, JumpStart tasks, priority contacts, news).

- **Authentication**: Optional Bearer token (defaults to active leader profile if unauthenticated)
- **Response**:
```json
{
  "success": true,
  "data": {
    "distributor": {
      "id": "uuid",
      "memberId": "88767139",
      "distributorCode": "DST-10001",
      "fullName": "Rahul kaushal",
      "firstName": "Rahul",
      "lastName": "kaushal",
      "displayName": "Rahul kaushal",
      "status": "ACTIVE",
      "memberSince": "2026",
      "tier": "Business Center"
    },
    "rank": {
      "currentRank": "Business Center",
      "highestRank": "Gold",
      "lifetimePV": 1500,
      "lifetimeGV": 45000
    },
    "badges": [
      {
        "id": "1",
        "code": "PACE_SETTER",
        "name": "Pacesetter",
        "icon": "⭐"
      }
    ],
    "commissionSummary": {
      "estimatedCommission": 0.00,
      "currency": "CP",
      "currencySymbol": "CP",
      "isQualified": false,
      "qualificationStatus": "Not Commission Qualified",
      "breakdown": [
        { "name": "Base Commission", "amount": 0.00, "description": "20% balanced CVP from Left and Right legs" },
        { "name": "PC Order Bonus", "amount": 0.00, "description": "Up to 10% bonus on Preferred Customer orders" },
        { "name": "Milestone Bonus", "amount": 0.00, "description": "Fast-growth team volume milestones" },
        { "name": "Frontline Bonus", "amount": 0.00, "description": "Matching bonus on sponsored brand partners" }
      ]
    },
    "qualificationStatus": {
      "isCommissionQualified": false,
      "statusText": "Not Commission Qualified",
      "personalBV": 0.00,
      "requiredPersonalBV": 100.00,
      "activeLegs": 0,
      "requiredActiveLegs": 2,
      "cycle": "1/1A",
      "cycleEndDate": "2026-09-25T23:59:59.999Z"
    },
    "businessCenters": [
      {
        "id": "bc1-uuid",
        "code": "BC 001",
        "centerCode": "DST-10001-BC1",
        "centerNumber": 1,
        "status": "ACTIVE",
        "leftVolume": 1250,
        "rightVolume": 1890,
        "estimatedCVP": 1250,
        "maxCVP": 1000
      },
      {
        "id": "bc2-uuid",
        "code": "BC 002",
        "centerCode": "DST-10001-BC2",
        "centerNumber": 2,
        "status": "ACTIVE",
        "leftVolume": 0,
        "rightVolume": 0,
        "estimatedCVP": 0,
        "maxCVP": 1000
      },
      {
        "id": "bc3-uuid",
        "code": "BC 003",
        "centerCode": "DST-10001-BC3",
        "centerNumber": 3,
        "status": "ACTIVE",
        "leftVolume": 0,
        "rightVolume": 0,
        "estimatedCVP": 0,
        "maxCVP": 1000
      }
    ],
    "quickLinks": [
      { "title": "KASHVIMLM Connect", "type": "connect" },
      { "title": "Shop", "type": "shop" },
      { "title": "Team Manager", "type": "team_manager" },
      { "title": "Forms", "type": "forms" }
    ],
    "jumpStartTasks": [
      { "key": "orientation", "title": "Complete your Associate Orientation", "time": "About 10 minutes", "completed": false },
      { "key": "website", "title": "Personalize your KASHVIMLM website", "time": "About 5 minutes", "completed": false },
      { "key": "sms", "title": "Opt in for text messages", "time": "About 2 minutes", "completed": true },
      { "key": "ethics", "title": "Complete your Ethics Certification", "time": "About 20 minutes", "completed": false },
      { "key": "app", "title": "Download the KASHVIMLM Hub App", "time": "About 5 minutes", "completed": false }
    ],
    "priorityContacts": {
      "caughtUp": true,
      "message": "You're all caught up",
      "description": "No priority contacts this week. A great moment to plan ahead — review your team activity or set a goal for next week.",
      "contacts": []
    },
    "news": [
      {
        "id": "1",
        "title": "All of Your Team Manager Reports Are Now Free",
        "summary": "Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost.",
        "isFeatured": true
      }
    ]
  },
  "message": "Dashboard data retrieved successfully."
}
```

---

## Distributor Management Endpoints (`/api/v1/distributors`)

- `GET /api/v1/distributors/me` - Profile of authenticated distributor
- `PATCH /api/v1/distributors/me` - Update profile of authenticated distributor
- `GET /api/v1/distributors/:id` - Lookup distributor by ID or code
- `GET /api/v1/distributors/:id/upline` - Sponsor and binary upline hierarchy
- `GET /api/v1/distributors/:id/downline` - Multi-tier downline team
- `GET /api/v1/distributors/:id/tree` - Binary placement tree with business centers
- `GET /api/v1/distributors/:id/team` - Direct personal enrollments list

---

## Authentication Endpoints (`/api/v1/auth`)

- `POST /api/v1/auth/register` - Argon2id registration
- `POST /api/v1/auth/login` - Login with rate limiting
- `POST /api/v1/auth/refresh` - Refresh token rotation
- `POST /api/v1/auth/logout` - Revoke session
- `GET /api/v1/auth/me` - Authenticated user details
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/reset-password` - Password reset confirmation

---

## Distributor & Customer Enrollment Pipeline (`/api/v1/enrollments`)

Multi-step onboarding wizard supporting 5 distinct steps, strict binary tree placement rules, sensitive financial data masking, and atomic activation.

### Enrollment Statuses
- `DRAFT` (Initial session created)
- `PENDING` (Steps in progress / awaiting submit)
- `KYC_REVIEW` (Under KYC verification)
- `APPROVED` (Approved for activation)
- `REJECTED` (Enrollment rejected)
- `COMPLETED` (Account, tree placement, and initial order activated)

### 1. Initialize Enrollment
- **`POST /api/v1/enrollments`**
- **Request Body**:
```json
{
  "sponsorId": "DST-10001",
  "prospectEmail": "alex.hamilton@example.com",
  "prospectPhone": "+15552345678",
  "enrollmentType": "DISTRIBUTOR"
}
```

### 2. Get Enrollment Session
- **`GET /api/v1/enrollments/:id`**
- Returns all 5 steps with sanitized/masked bank info and omitted PIN hashes.

### 3. Update Enrollment
- **`PATCH /api/v1/enrollments/:id`**
- Update contact details or enrollment metadata.

### 4. Step 1: Personal Info
- **`POST /api/v1/enrollments/:id/step/1`**
- **Request Body**:
```json
{
  "legalName": "Alexander Hamilton",
  "email": "alex.hamilton@example.com",
  "mobile": "+15552345678",
  "dateOfBirth": "1995-01-11"
}
```
*Enforces minimum age >= 18 and checks for self-sponsorship.*

### 5. Step 2: Address & PIN
- **`POST /api/v1/enrollments/:id/step/2`**
- **Request Body**:
```json
{
  "address": "742 Evergreen Terrace",
  "city": "Springfield",
  "state": "OR",
  "country": "USA",
  "postalCode": "97477"
}
```

### 6. Step 3: Tree Placement
- **`POST /api/v1/enrollments/:id/step/3`**
- **Request Body**:
```json
{
  "sponsor": "DST-10001",
  "placementParent": "DST-10002",
  "placementPosition": "LEFT"
}
```
*Enforces:*
- Cannot sponsor self
- Placement parent must exist in tree
- Position (`LEFT`/`RIGHT`) must not be already occupied

### 7. Step 4: Starter Kit
- **`POST /api/v1/enrollments/:id/step/4`**
- **Request Body**:
```json
{
  "productPackage": "Executive Business Enrollment Pack",
  "price": 249.99,
  "bv": 200.00
}
```

### 8. Step 5: Bank & Security
- **`POST /api/v1/enrollments/:id/step/5`**
- **Request Body**:
```json
{
  "accountHolder": "Alexander Hamilton",
  "bankName": "JPMorgan Chase",
  "accountNumber": "987654321098",
  "ifsc": "CHASUS33",
  "securityPin": "4829"
}
```
*Security measures:*
- Security PIN hashed with Argon2id (`securityPinHash`)
- Bank account number masked as `********1098` in all responses

### 9. Submit & Activate
- **`POST /api/v1/enrollments/:id/submit`**
- Validates all 5 steps are complete
- Checks for binary position collisions in atomic transaction
- Creates `User`, `DistributorProfile`, `BusinessCenter`, `MLMNode`, `SponsorRelationship`, `BankAccount`, `Wallet`, and initial starter kit `Order` + `BVLedger` accrual
- Marks enrollment `COMPLETED`

---

## Product Catalog & Categories (`/api/v1/products` & `/api/v1/categories`)

Comprehensive product catalog with database-driven categories (`CLOTHES_HOSIERY`, `ELECTRONICS_SMART_DEVICES`), multi-attribute search and filtering, pricing, BV, stock tracking, and role-protected administrative endpoints.

### Supported Product Statuses
- `DRAFT`
- `ACTIVE`
- `OUT_OF_STOCK`
- `INACTIVE`

### 1. List Products (With Filtering & Sorting)
- **`GET /api/v1/products`**
- **Query Parameters**:
  - `category`: Filter by category slug, categoryCode (`CLOTHES_HOSIERY`, `ELECTRONICS_SMART_DEVICES`), or UUID
  - `search`: Keyword search matching name, SKU, or description
  - `minPrice`: Minimum wholesale price filter
  - `maxPrice`: Maximum wholesale price filter
  - `minBV`: Minimum BV filter
  - `maxBV`: Maximum BV filter
  - `stock`: Filter by stock status (`all`, `in_stock`, `out_of_stock`, `low_stock`)
  - `status`: Filter by product status (`DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `INACTIVE`)
  - `sort`: Sorting option:
    - `featured` (default: featured products first, then newest)
    - `newest` (newest creation date)
    - `price_low` (price ascending)
    - `price_high` (price descending)
    - `BV` (business volume descending)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Sample Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "prod-uuid",
      "sku": "CLO-COMP-001",
      "name": "ActiveFit Graduated Compression Hosiery Pro",
      "slug": "activefit-graduated-compression-hosiery-pro",
      "description": "Medical-grade graduated compression hosiery.",
      "categoryId": "cat-uuid",
      "category": {
        "id": "cat-uuid",
        "categoryCode": "CLOTHES_HOSIERY",
        "name": "Clothes & Hosiery",
        "slug": "clothes-hosiery"
      },
      "wholesalePrice": 29.99,
      "mrp": 49.99,
      "bv": 25.0,
      "stock": 500,
      "lowStockThreshold": 30,
      "status": "ACTIVE",
      "isFeatured": true,
      "images": [
        {
          "id": "img-uuid",
          "url": "https://images.example.com/hosiery.jpg",
          "altText": "Front View",
          "isPrimary": true,
          "displayOrder": 0
        }
      ],
      "createdAt": "2026-09-22T05:20:00.000Z",
      "updatedAt": "2026-09-22T05:20:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "Product catalog retrieved successfully."
}
```

### 2. Get Product by Slug or ID
- **`GET /api/v1/products/:slug`**
- Returns single product with full category details, image gallery, and inventory.

### 3. Create Product (Admin Only)
- **`POST /api/v1/products`**
- **Authentication**: Bearer token with `ADMIN` or `SUPER_ADMIN` role
- **Request Body**:
```json
{
  "sku": "ELE-SCALE-002",
  "name": "Smart Bio-Impedance Body Composition Analyzer Scale",
  "categoryId": "ELECTRONICS_SMART_DEVICES",
  "wholesalePrice": 59.99,
  "mrp": 99.99,
  "bv": 45.0,
  "stock": 150,
  "lowStockThreshold": 15,
  "status": "ACTIVE",
  "isFeatured": true,
  "description": "Clinical grade dual-frequency bio-impedance Bluetooth connected scale analyzing 16 metrics.",
  "images": [
    "https://images.example.com/scale1.jpg"
  ]
}
```

### 4. Update Product (Admin Only)
- **`PATCH /api/v1/products/:id`**
- **Authentication**: Bearer token with `ADMIN` or `SUPER_ADMIN` role
- Updates pricing, stock, low stock thresholds, gallery images, or status. Automatically syncs inventory records.

### 5. Delete Product (Admin Only)
- **`DELETE /api/v1/products/:id`**
- **Authentication**: Bearer token with `ADMIN` or `SUPER_ADMIN` role
- Soft-deletes the product (`status: INACTIVE`, `deletedAt: now()`), preserving order history and BV ledgers.

### 6. List Categories
- **`GET /api/v1/categories`** or **`GET /api/v1/products/categories`**
- Returns all active database-driven categories along with active product counts.

---

## Shopping Cart (`/api/v1/cart`)

User shopping cart management with live stock verification and dynamic price and BV recalculations based on current database records.

- **`GET /api/v1/cart`**: Retrieve current user's cart, computed subtotal, and total BV
- **`POST /api/v1/cart/items`**: Add product to cart (`{ productId, quantity }`)
- **`PATCH /api/v1/cart/items/:id`**: Update cart item quantity (`{ quantity }`)
- **`DELETE /api/v1/cart/items/:id`**: Remove item from cart
- **`DELETE /api/v1/cart`**: Clear all items from cart

---

## Order Management (`/api/v1/orders`)

Full-lifecycle order management supporting 8 official statuses, 10-step atomic database transactions, stock locking, volume propagation, and qualification-gated commission processing.

### Supported Order Statuses
- `PENDING`
- `PAYMENT_PENDING`
- `PAID`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`
- `REFUNDED`

### 10-Step Order Creation Flow
1. **Validate product**: Ensures product exists, is active, and is not discontinued.
2. **Validate stock**: Verifies requested quantities do not exceed available stock.
3. **Lock inventory**: Atomically decrements product stock and warehouse inventory inside transaction.
4. **Calculate wholesale price**: Authoritative database lookup (wholesale for distributors, retail for customers). Never trusts client input.
5. **Calculate BV**: Authoritative database lookup based on product `bv` points. Never trusts client input.
6. **Create order**: Creates immutable order header with totals and addresses.
7. **Create order items**: Persists line items with frozen unit price and unit BV.
8. **Create inventory transaction**: Records `ORDER_FULFILLMENT` inventory audit log.
9. **Create BV ledger entries**: Accrues personal volume, updates distributor `lifetimePV`, and propagates team volume up the binary placement tree.
10. **Trigger commission processing**: Evaluates qualification rules (`PAID`/`CONFIRMED`, `totalBV > 0`) and awards direct referral bonuses to sponsor.

### Endpoints
- **`POST /api/v1/orders`**: Create order from cart (`{ fromCart: true }`) or explicit items (`{ items: [{ productId, quantity }] }`)
- **`GET /api/v1/orders`**: List orders with status and date range filtering
- **`GET /api/v1/orders/:id`**: Get full order details, line items, and payment status
- **`POST /api/v1/orders/:id/cancel`**: Cancel eligible orders (`PENDING`, `PAYMENT_PENDING`, `PROCESSING`), restocks inventory, and reverses BV

---

## Business Volume (BV) Ledger (`/api/v1/bv`)

Production-grade, financial-accounting style append-only immutable ledger for tracking all Business Volume (BV).

### Core Architecture & Guarantees
1. **Append-Only Immutability**: Volume balances are **never** mutated directly (`distributor.bv = distributor.bv + 100` is strictly prohibited). Every volume change appends an immutable entry to `BVLedger`.
2. **Mandatory Reference (`sourceId`)**: Every BV transaction must carry an explicit, non-empty reference ID (e.g. `orderId`, `refundId`, `bonusId`, or compensating ticket ID).
3. **Audit Trail & Corrections**: BV entries cannot be silently edited or deleted. Corrections are recorded as compensating `REVERSAL` or `ADJUSTMENT` transactions.
4. **Binary Leg Attribution**: Records `position` (`LEFT` or `RIGHT`) to enable real-time binary team volume matching and dual-leg commission calculation.

### BVLedger Schema Fields
- `id`: Unique UUID
- `distributorId`: UUID of distributor receiving volume
- `businessCenterId`: UUID of business center (optional/multi-center)
- `sourceType`: Enum (`ORDER`, `ORDER_REFUND`, `ADJUSTMENT`, `BONUS`, `REVERSAL`)
- `sourceId`: Mandatory reference string
- `bv`: Volume delta (positive for credits, negative for debits)
- `balanceAfter`: Cumulative running total balance immediately after entry
- `position`: Placement leg attribution (`LEFT`, `RIGHT`, or `null` for personal volume)
- `createdAt`: Immutable timestamp

### BVService Methods
- `creditBV()`: Creates positive BV entry and updates `balanceAfter`
- `debitBV()`: Creates negative BV entry and updates `balanceAfter`
- `getBalance()`: Computes net balance, total credits, total debits from immutable entries
- `getPeriodBV()`: Computes total, personal, group, and left/right volumes for a commission period
- `getLeftBV()`: Aggregates net volume on the LEFT placement leg
- `getRightBV()`: Aggregates net volume on the RIGHT placement leg
- `reverseTransaction()`: Creates compensating `REVERSAL` transaction referencing original entry
- `getLedger()`: Returns paginated ledger history with filtering

### Endpoints

#### Distributor Endpoints
- **`GET /api/v1/bv/balance`**: Retrieve current BV balance and totals for authenticated distributor
- **`GET /api/v1/bv/period/:periodId`**: Retrieve personal and leg BV breakdown for a period
- **`GET /api/v1/bv/legs`**: Retrieve binary left and right leg volumes
- **`GET /api/v1/bv/ledger`**: Paginated personal BV ledger history

#### Admin Inspection & Management (Super Admin & Admin)
- **`GET /api/v1/bv/distributors/:distributorId/balance`**: Inspect BV balance for any distributor
- **`GET /api/v1/bv/distributors/:distributorId/period/:periodId`**: Inspect period volume for any distributor
- **`GET /api/v1/bv/distributors/:distributorId/legs`**: Inspect leg volumes for any distributor
- **`GET /api/v1/bv/distributors/:distributorId/ledger`**: Inspect BV ledger for any distributor
- **`POST /api/v1/bv/credit`**: Manual BV credit (body: `{ distributorId, sourceId, bv, sourceType, position?, description? }`)
- **`POST /api/v1/bv/debit`**: Manual BV debit (body: `{ distributorId, sourceId, bv, sourceType?, description? }`)
- **`POST /api/v1/bv/reverse`**: Reverse transaction via compensating entry (body: `{ originalTransactionId, reason, referenceId }`)

---

## Commission Engine (`/api/v1/commissions`)

Enterprise, database-driven commission calculation engine with strict idempotency, audit trail, and decoupled wallet payout processing.

### Core Architectural Guarantees
1. **Database-Driven Rules**: Commission rules are defined in the `CommissionRule` table with flexible `configurationJson`, priority ordering, and effective date windows.
2. **Strict Idempotency**: Double-processing of an order or weekly cycle never duplicates commissions. Every commission has an authoritative `businessReference` with a unique database index:
   - `PC_ORDER:<orderId>:<sponsorId>`
   - `BASE:<periodId>:<distributorId>:<businessCenterId>`
   - `BINARY:<periodId>:<distributorId>:<businessCenterId>`
   - `MILESTONE:<distributorId>:<milestoneKey>`
   - `FRONTLINE:<periodId>:<sponsorId>:<frontlineId>`
   - `RANK:ONETIME:<distributorId>:<rankCode>`
3. **Decoupled Wallet Accounting (Ledger First)**: Calculation engines **never** mutate wallet balances directly. They append `CALCULATED` records to the `Commission` ledger. A separate payout process (`payoutCommissions()`) handles payment authorization, wallet balance updates, and `WalletTransaction` audit entries.

### Rule Types
- `BASE`: Weekly base commission calculated on balanced CVP across business centers
- `PC_ORDER`: Cash bonus earned on orders placed by enrolled Preferred Customers
- `MILESTONE`: Fast-growth bonuses awarded for hitting team volume thresholds in initial days
- `FRONTLINE`: Leadership matching bonuses earned on commissions of frontline distributors
- `BINARY`: Dual-leg matching commission on lesser leg volume
- `RANK`: Rank advancement and maintenance awards
- `OTHER`: Extensible custom rules

### Commission Statuses
- `PENDING`: Commission scheduled or awaiting qualification verification
- `QUALIFIED`: Distributor has met volume and active frontline requirements
- `CALCULATED`: Commission calculated and locked in ledger; ready for payout
- `PAID`: Commission credited to distributor wallet
- `REVERSED`: Commission clawed back due to order refund or administrative reversal
- `CANCELLED`: Commission cancelled before payout

### CommissionService Functions
- `calculateBaseCommission(periodId, distributorId?)`: Calculates base volume matching
- `calculatePCOrderBonus(orderId)`: Calculates preferred customer order bonus
- `calculateMilestoneBonus(distributorId, milestoneKey)`: Calculates milestone incentives
- `calculateFrontlineBonus(periodId, distributorId?)`: Calculates frontline matching bonuses
- `calculateBinaryCommission(periodId, distributorId?)`: Calculates binary lesser leg matching
- `calculateRankBonus(distributorId, rankCode, periodId?)`: Calculates rank advancement awards
- `calculateWeeklyCommission(periodIdOrCode?)`: Orchestrates end-of-cycle commission run
- `payoutCommissions({ periodId?, commissionIds?, distributorId? })`: Processes wallet credits for eligible calculated commissions

### Endpoints

#### Distributor & User Endpoints
- **`GET /api/v1/commissions/current`**: Current active open commission period and authenticated distributor's real-time qualification & estimated earnings
- **`GET /api/v1/commissions/history`**: Paginated historical commission periods with distributor's earnings summary
- **`GET /api/v1/commissions/:id`**: Retrieve specific commission details or commission period details by ID
- **`GET /api/v1/commissions/me`**: Paginated personal commission ledger with status and type filters
- **`GET /api/v1/commissions/rules`**: List active database commission rules

#### Admin Management & Controlled Jobs (`SUPER_ADMIN`, `ADMIN`)
*Strict Authorization Enforced*: Admin calculation endpoints are protected by `authenticate` and `authorizeRoles('SUPER_ADMIN', 'ADMIN')`.
- **`POST /api/v1/admin/commission-periods`**: Create a new commission period (`startDate`, `endDate`, `status?`)
- **`POST /api/v1/admin/commission-periods/:id/calculate`**: Run controlled calculation service/job (`OPEN` -> `PROCESSING` -> `CALCULATED`, stamps `processedAt`)
- **`POST /api/v1/admin/commission-periods/:id/approve`**: Approve calculated period (`CALCULATED` -> `APPROVED`, qualifies child commissions)
- **`POST /api/v1/admin/commission-periods/:id/close`**: Finalize and lock period (`APPROVED`/`PAID` -> `CLOSED`)
- **`POST /api/v1/commissions/rules`**: Create a new database-driven commission rule
- **`PATCH /api/v1/commissions/rules/:id`**: Update an existing rule's configuration or active window
- **`POST /api/v1/commissions/calculate-weekly`**: Trigger weekly commission cycle run
- **`POST /api/v1/commissions/process-pc-order`**: Trigger idempotent PC order bonus calculation
- **`POST /api/v1/commissions/calculate/milestone`**: Trigger milestone bonus evaluation
- **`POST /api/v1/commissions/calculate/rank`**: Trigger rank bonus evaluation
- **`POST /api/v1/commissions/payout`**: Authorize and credit calculated commissions to distributor wallets

---

## Distributor Wallet (`/api/v1/wallet` & `/api/v1/admin/wallet`)

### Wallet Model
- `id`: Unique identifier (UUID)
- `distributorId`: Linked distributor profile ID
- `availableBalance`: Available funds for withdrawal, purchases, or transfers
- `pendingBalance`: Pending or held funds
- `lifetimeEarned`: Total cumulative funds credited to the wallet
- `lifetimePaid`: Total cumulative funds disbursed or paid out
- `currency`: Default `USD`
- `isLocked`: Boolean indicating if the wallet is administratively locked

### WalletTransaction Types
- `CREDIT`: General credit adjustment
- `DEBIT`: General debit adjustment
- `COMMISSION`: Payable commission earnings payout
- `PAYOUT`: Bank account payout withdrawal
- `REFUND`: Order refund or clawback
- `ADJUSTMENT`: Administrative balance correction
- `REVERSAL`: Erroneous transaction reversal

### Security Guarantees & Non-Mutation Rules
1. **Direct Mutation Prohibited**: Frontend users can NEVER directly modify wallet balances. Direct POST, PUT, PATCH, or DELETE operations on `/api/v1/wallet` are explicitly rejected with `403 Forbidden` (`WALLET_MUTATION_PROHIBITED`). Balance mutations occur strictly via:
   - System commission payouts (`WalletService.processPayableCommissions`)
   - Order refunds / reversals
   - Bank payout processing
   - Super Admin / Admin controlled adjustments
2. **Mandatory Audit Logging**: All administrative adjustments trigger an `AuditLog` record (`action: 'WALLET_ADMIN_ADJUSTMENT'`, `entityType: 'Wallet'`) tracking `adminUserId`, `previousData`, `newData`, adjustment `reason`, `referenceId`, IP address, and user agent.

### Endpoints

#### 1. Retrieve Authenticated Distributor Wallet
- **`GET /api/v1/wallet`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "e4b2d187-2e63-4b68-963a-8610eb675c91",
    "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
    "availableBalance": 1250.00,
    "pendingBalance": 0.00,
    "lifetimeEarned": 5400.00,
    "lifetimePaid": 4150.00,
    "currency": "USD",
    "isLocked": false,
    "createdAt": "2026-09-01T00:00:00.000Z",
    "updatedAt": "2026-09-22T06:00:00.000Z"
  },
  "message": "Wallet retrieved successfully"
}
```

#### 2. Retrieve Wallet Transactions Ledger
- **`GET /api/v1/wallet/transactions`**
- **Auth**: Bearer token required
- **Query Parameters**:
  - `type`: Filter by transaction type (`CREDIT`, `DEBIT`, `COMMISSION`, `PAYOUT`, `REFUND`, `ADJUSTMENT`, `REVERSAL`)
  - `page`: Page number (default `1`)
  - `limit`: Items per page (default `20`, max `100`)
  - `startDate`: ISO date filter (`>= startDate`)
  - `endDate`: ISO date filter (`<= endDate`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "3bb609b5-41e9-4171-bc01-f2f24a1bfa44",
        "walletId": "e4b2d187-2e63-4b68-963a-8610eb675c91",
        "transactionNumber": "WTX-202609-1002",
        "type": "COMMISSION",
        "status": "COMPLETED",
        "amount": 250.00,
        "feeAmount": 0.00,
        "netAmount": 250.00,
        "balanceBefore": 1000.00,
        "balanceAfter": 1250.00,
        "referenceId": "comm-uuid-1234",
        "description": "BINARY Commission payout (COM-10001)",
        "createdAt": "2026-09-22T06:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Wallet transactions retrieved successfully"
}
```

#### 3. Administrative Wallet Adjustment (Admin Only)
- **`POST /api/v1/admin/wallet/adjust`** or **`POST /api/v1/wallet/adjust`**
- **Auth**: Bearer token required (`SUPER_ADMIN` or `ADMIN` role)
- **Request Body**:
```json
{
  "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
  "type": "CREDIT",
  "amount": 100.00,
  "reason": "Customer service resolution credit",
  "referenceId": "CS-TICKET-8921"
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "e4b2d187-2e63-4b68-963a-8610eb675c91",
      "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
      "availableBalance": 1350.00,
      "pendingBalance": 0.00,
      "lifetimeEarned": 5500.00,
      "lifetimePaid": 4150.00,
      "currency": "USD",
      "isLocked": false,
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-22T06:30:00.000Z"
    },
    "transaction": {
      "id": "7bc299e4-8cf1-4560-843c-66289b5c2da8",
      "walletId": "e4b2d187-2e63-4b68-963a-8610eb675c91",
      "transactionNumber": "WTX-202609-1003",
      "type": "CREDIT",
      "status": "COMPLETED",
      "amount": 100.00,
      "feeAmount": 0.00,
      "netAmount": 100.00,
      "balanceBefore": 1250.00,
      "balanceAfter": 1350.00,
      "referenceId": "CS-TICKET-8921",
      "description": "Admin adjustment: Customer service resolution credit",
      "createdAt": "2026-09-22T06:30:00.000Z"
    },
    "auditLogId": "a9103cde-f1a2-4a00-9988-bb3344556677"
  },
  "message": "Wallet balance adjusted successfully and recorded in audit log."
}
```

---

## Payout System (`/api/v1/payouts` & `/api/v1/admin/payouts`)

### PayoutRequest Model
- `id`: Unique identifier (UUID)
- `payoutNumber`: Unique human-readable identifier (e.g., `POR-123456-7890`)
- `distributorId`: UUID of requesting distributor
- `amount`: Payout amount requested
- `fee`: Processing fee (default `0.00`)
- `netAmount`: Net disbursement amount (`amount - fee`)
- `bankAccountId`: Destination verified bank account UUID
- `status`: Lifecycle state
- `requestedAt`: Timestamp when payout was requested
- `processedAt`: Timestamp when payout was processed, paid, or rejected
- `failureReason`: Rejection or failure reason notes
- `adminNotes`: Internal administrative notes
- `referenceNumber`: External payment gateway / bank transfer UTR reference

### Payout Statuses
- `REQUESTED`: Payout submitted by distributor; funds reserved in wallet `pendingBalance`
- `UNDER_REVIEW`: Payout queued for compliance or KYC review
- `APPROVED`: Payout approved by administrator; queued for banking disbursement
- `PROCESSING`: Payout batch sent to bank / payment provider
- `PAID`: Funds successfully transferred; `pendingBalance` deducted, `lifetimePaid` incremented, immutable `PAYOUT` transaction created
- `REJECTED`: Payout rejected by administrator; held funds restored to `availableBalance`, immutable `REVERSAL` transaction logged
- `FAILED`: Bank transfer failed; held funds restored to distributor wallet

### Security & Masking Guarantees
1. **Never Expose Full Bank Details**: Account numbers and routing/IFSC numbers are automatically masked in normal frontend responses (e.g., `********1098` and `SBIN*****34`).
2. **Double-Spending Prevention**: Payout requests immediately place the requested amount on hold by moving it from `availableBalance` to `pendingBalance`.
3. **Audit Trail**: Payout approvals, rejections, and payments create immutable `AuditLog` entries recording administrator ID, IP, user-agent, and status transitions.

### Endpoints

#### 1. Submit Payout Request
- **`POST /api/v1/payouts`**
- **Auth**: Bearer token required (Distributor)
- **Request Body**:
```json
{
  "amount": 250.00,
  "bankAccountId": "4a716446-e29b-41d4-a716-446655440000",
  "notes": "Weekly withdrawal"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "c8a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
    "payoutNumber": "POR-202609-1001",
    "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
    "amount": 250.00,
    "fee": 0.00,
    "netAmount": 250.00,
    "bankAccountId": "4a716446-e29b-41d4-a716-446655440000",
    "status": "REQUESTED",
    "requestedAt": "2026-09-22T06:40:00.000Z",
    "processedAt": null,
    "failureReason": null,
    "bankAccount": {
      "id": "4a716446-e29b-41d4-a716-446655440000",
      "bankName": "HDFC Bank",
      "accountHolderName": "Rahul Kaushal",
      "accountNumber": "********4321",
      "routingNumber": "HDFC*****01",
      "branchName": "Connaught Place",
      "status": "VERIFIED"
    }
  },
  "message": "Payout request submitted successfully."
}
```

#### 2. List Distributor's Payout Requests
- **`GET /api/v1/payouts`**
- **Auth**: Bearer token required
- **Query Parameters**: `status`, `page`, `limit`, `startDate`, `endDate`

#### 3. Get Payout Request Details
- **`GET /api/v1/payouts/:id`**
- **Auth**: Bearer token required

#### 4. List All Payout Requests (Admin Only)
- **`GET /api/v1/admin/payouts`**
- **Auth**: Bearer token required (`SUPER_ADMIN`, `ADMIN`)
- **Query Parameters**: `status`, `distributorId`, `page`, `limit`, `startDate`, `endDate`

#### 5. Approve Payout Request (Admin Only)
- **`POST /api/v1/admin/payouts/:id/approve`**
- **Auth**: Bearer token required (`SUPER_ADMIN`, `ADMIN`)
- **Request Body**:
```json
{
  "adminNotes": "KYC verified and approved for disbursement"
}
```

#### 6. Reject Payout Request (Admin Only)
- **`POST /api/v1/admin/payouts/:id/reject`**
- **Auth**: Bearer token required (`SUPER_ADMIN`, `ADMIN`)
- **Request Body**:
```json
{
  "reason": "Name mismatch between KYC and bank account",
  "adminNotes": "Please upload an updated bank statement"
}
```

#### 7. Mark Payout as Paid (Admin Only)
- **`POST /api/v1/admin/payouts/:id/mark-paid`**
- **Auth**: Bearer token required (`SUPER_ADMIN`, `ADMIN`)
- **Request Body**:
```json
{
  "referenceNumber": "UTR-20260922-9812739",
  "adminNotes": "Disbursed via bank NEFT/RTGS transfer"
}
```

---

## Multi-Center Business Architecture (`/api/v1/business-centers`)

### BusinessCenter Model
- `id`: Unique identifier (UUID)
- `distributorId`: Foreign key to `DistributorProfile`
- `centerNumber`: Integer representing center index (e.g. `1` for BC1, `2` for BC2, `3` for BC3)
- `centerCode`: Unique human-readable code (e.g. `DST-10001-BC1`)
- `status`: Center status (`ACTIVE`, `INACTIVE`, `SUSPENDED`)
- `openedAt`: Timestamp when center was activated/opened
- `closedAt`: Optional timestamp when center was terminated/closed
- `leftVolume`: Current active left-leg volume
- `rightVolume`: Current active right-leg volume
- `accumulatedLeftVolume`: Cumulative lifetime left-leg volume
- `accumulatedRightVolume`: Cumulative lifetime right-leg volume

### Tree Isolation Guarantee
- **Strict Tree Isolation**: Each Business Center has an **independent placement tree**.
- **No Cross-Contamination**: Tree queries rooted at a specific center (e.g., `GET /api/v1/business-centers/:id/tree`) strictly traverse only nodes placed downstream of that specific business center's binary root. Subtrees of sibling centers (e.g., BC2 vs BC3) never cross-mix.

### Endpoints

#### 1. Retrieve All Business Centers
- **`GET /api/v1/business-centers`**
- **Auth**: Bearer token required
- **Query Parameters**: `status`, `distributorId` (admin only)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "7ab12c34-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
      "centerNumber": 1,
      "centerCode": "DST-10001-BC1",
      "status": "ACTIVE",
      "openedAt": "2026-01-01T00:00:00.000Z",
      "closedAt": null,
      "leftVolume": 1500.00,
      "rightVolume": 2400.00,
      "accumulatedLeftVolume": 10500.00,
      "accumulatedRightVolume": 15200.00,
      "nodeId": "node-uuid-1",
      "placementParentId": null,
      "placementPosition": null,
      "depth": 0
    },
    {
      "id": "8bc23d45-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
      "distributorId": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
      "centerNumber": 2,
      "centerCode": "DST-10001-BC2",
      "status": "ACTIVE",
      "openedAt": "2026-01-01T00:00:00.000Z",
      "closedAt": null,
      "leftVolume": 800.00,
      "rightVolume": 1200.00,
      "accumulatedLeftVolume": 4500.00,
      "accumulatedRightVolume": 6200.00,
      "nodeId": "node-uuid-2",
      "placementParentId": "node-uuid-1",
      "placementPosition": "LEFT",
      "depth": 1
    }
  ],
  "message": "Business centers retrieved successfully."
}
```

#### 2. Retrieve Specific Business Center
- **`GET /api/v1/business-centers/:id`**
- **Auth**: Bearer token required (`id` can be UUID or `centerCode` e.g., `DST-10001-BC1`)

#### 3. Retrieve Independent Binary Tree
- **`GET /api/v1/business-centers/:id/tree`**
- **Auth**: Bearer token required
- **Query Parameters**:
  - `depth`: Depth of subtree to fetch (default `3`, min `1`, max `10`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "businessCenter": {
      "id": "7ab12c34-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "centerCode": "DST-10001-BC1",
      "centerNumber": 1,
      "status": "ACTIVE"
    },
    "tree": {
      "nodeId": "node-uuid-1",
      "businessCenterId": "7ab12c34-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "centerNumber": 1,
      "centerCode": "DST-10001-BC1",
      "relativeDepth": 1,
      "position": null,
      "status": "ACTIVE",
      "leftVolume": 1500.00,
      "rightVolume": 2400.00,
      "distributor": {
        "id": "8bf121ae-bbad-4a11-b0db-8d9e79435b69",
        "distributorCode": "DST-10001",
        "displayName": "Rahul Kaushal",
        "rankName": "Gold"
      },
      "leftChild": {
        "nodeId": "node-uuid-2",
        "centerCode": "DST-10001-BC2",
        "relativeDepth": 2,
        "position": "LEFT",
        "leftChild": null,
        "rightChild": null
      },
      "rightChild": {
        "nodeId": "node-uuid-3",
        "centerCode": "DST-10001-BC3",
        "relativeDepth": 2,
        "position": "RIGHT",
        "leftChild": null,
        "rightChild": null
      }
    }
  },
  "message": "Business center tree retrieved successfully."
}
```

#### 4. Retrieve Business Center Summary
- **`GET /api/v1/business-centers/:id/summary`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "center": {
      "id": "7ab12c34-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "centerNumber": 1,
      "centerCode": "DST-10001-BC1",
      "status": "ACTIVE",
      "openedAt": "2026-01-01T00:00:00.000Z",
      "closedAt": null
    },
    "volumes": {
      "leftVolume": 1500.00,
      "rightVolume": 2400.00,
      "totalVolume": 3900.00,
      "accumulatedLeftVolume": 10500.00,
      "accumulatedRightVolume": 15200.00,
      "lesserLegVolume": 1500.00,
      "strongerLegVolume": 2400.00,
      "payLeg": "LEFT",
      "carryoverVolume": 900.00
    },
    "team": {
      "totalDownlineNodes": 14,
      "leftLegNodeCount": 6,
      "rightLegNodeCount": 8
    },
    "recentBVTransactions": [
      {
        "id": "bv-uuid-1",
        "sourceType": "ORDER",
        "sourceId": "ord-uuid-101",
        "bv": 100.00,
        "position": "LEFT",
        "balanceAfter": 1500.00,
        "createdAt": "2026-09-22T06:00:00.000Z"
      }
    ]
  },
  "message": "Business center summary retrieved successfully."
}
```

---

## Training System & Progress Tracking (`/api/v1/training`)

### Course Categories
- `ORIENTATION`: Associate on-boarding, business center basics, binary compensation model
- `BUSINESS_SETUP`: Replicated digital website, security PIN, notifications, back-office tour
- `PRODUCT`: Apparel & smart electronics catalog knowledge, retail pricing, BV value scripts
- `ETHICS`: Direct selling compliance, honest advertising, refund policy, earnings claim restrictions
- `MARKETING`: Social media prospecting, digital sales funnels, storytelling
- `TOOLS`: Team Manager portal, tree navigation, order management, reports

### Models
- **`TrainingCourse`**:
  - `id`: Unique identifier (UUID)
  - `slug`: Human-readable slug (e.g., `associate-orientation`)
  - `title`, `description`, `category`
  - `thumbnailUrl`, `isMandatory`, `displayOrder`
- **`TrainingLesson`**:
  - `id`: UUID
  - `courseId`: Foreign key to `TrainingCourse`
  - `title`, `content`, `videoUrl`, `durationMinutes`, `displayOrder`
- **`TrainingProgress`**:
  - `distributorId`, `lessonId`
  - `isCompleted`: Boolean
  - `startedAt`, `completedAt`

### Progress Metrics
Dashboard and Training endpoints dynamically compute:
- `completedTasks`: Number of finished lessons / mandatory courses
- `remainingTasks`: Number of pending lessons / mandatory courses
- `progressPercentage`: `Math.round((completedTasks / totalTasks) * 100)`
- `categories`: Full breakdown per course category

### Endpoints

#### 1. Retrieve Training Progress Summary
- **`GET /api/v1/training/progress`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "totalTasks": 10,
    "completedTasks": 3,
    "remainingTasks": 7,
    "progressPercentage": 30,
    "completedCoursesCount": 1,
    "totalCoursesCount": 6,
    "categories": {
      "ORIENTATION": {
        "totalTasks": 2,
        "completedTasks": 2,
        "remainingTasks": 0,
        "progressPercentage": 100,
        "isCompleted": true
      },
      "BUSINESS_SETUP": {
        "totalTasks": 2,
        "completedTasks": 1,
        "remainingTasks": 1,
        "progressPercentage": 50,
        "isCompleted": false
      },
      "PRODUCT": { "totalTasks": 2, "completedTasks": 0, "remainingTasks": 2, "progressPercentage": 0, "isCompleted": false },
      "ETHICS": { "totalTasks": 2, "completedTasks": 0, "remainingTasks": 2, "progressPercentage": 0, "isCompleted": false },
      "MARKETING": { "totalTasks": 1, "completedTasks": 0, "remainingTasks": 1, "progressPercentage": 0, "isCompleted": false },
      "TOOLS": { "totalTasks": 1, "completedTasks": 0, "remainingTasks": 1, "progressPercentage": 0, "isCompleted": false }
    }
  },
  "message": "Overall training progress retrieved successfully."
}
```

#### 2. Retrieve All Courses
- **`GET /api/v1/training`**
- **Auth**: Bearer token required
- **Query Parameters**:
  - `category`: Filter by category (`ORIENTATION`, `BUSINESS_SETUP`, `PRODUCT`, `ETHICS`, `MARKETING`, `TOOLS`)
  - `isMandatory`: Filter mandatory courses (`true` / `false`)
  - `search`: Case-insensitive title / description search
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "slug": "associate-orientation",
      "title": "New Associate Orientation & Binary Plan Fundamentals",
      "category": "ORIENTATION",
      "isMandatory": true,
      "totalLessons": 2,
      "completedLessons": 2,
      "progressPercentage": 100,
      "isCompleted": true
    }
  ],
  "message": "Training courses retrieved successfully."
}
```

#### 3. Retrieve Course Details & Lessons
- **`GET /api/v1/training/:courseId`**
- **Auth**: Bearer token required (`courseId` can be UUID or `slug`)
- **Response (`200 OK`)**: Includes course metadata and lessons list with individual lesson `status` (`COMPLETED`, `IN_PROGRESS`, `NOT_STARTED`).

#### 4. Mark Lesson Started
- **`POST /api/v1/training/:courseId/lessons/:lessonId/start`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**: Marks lesson in-progress and returns updated course completion percentage.

#### 5. Mark Lesson Completed
- **`POST /api/v1/training/:courseId/lessons/:lessonId/complete`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "Lesson completed successfully.",
    "lesson": {
      "id": "l-uuid-1",
      "courseId": "c-uuid-1",
      "title": "Welcome to KASHVIMLM & The Binary Advantage",
      "status": "COMPLETED",
      "completedAt": "2026-09-22T07:00:00.000Z"
    },
    "courseProgress": 100,
    "isCourseCompleted": true
  },
  "message": "Lesson completed successfully."
}
```

---

## 13. Replicated Distributor Websites (`/api/v1/my-website`)

The replicated storefront system gives each distributor their own personalized, branded public website and customizable navigation links for lead capture, direct retail ordering, and prospective associate enrollment.

### Models & Schema Fields

#### `DistributorWebsite`
- `id` (UUID, Primary Key)
- `distributorId` (UUID, Unique foreign key to Distributor)
- `slug` (String, Unique, URL slug e.g. `rahul-kaushal`)
- `subdomain` (String, Unique, subdomain prefix e.g. `rahul`)
- `title` (String, Public storefront title)
- `description` (String, Storefront tagline or bio)
- `theme` (String, Theme identifier e.g. `EMERALD_LUXURY`, `DEFAULT`)
- `logo` (String | null, URL to custom branding logo image)
- `isPublished` (Boolean, Indicates if website is publicly active)
- `createdAt`, `updatedAt` (DateTime)

#### `WebsiteLink`
- `id` (UUID, Primary Key)
- `websiteId` (UUID, Foreign key to DistributorWebsite)
- `label` (String, Display text for link e.g. `Shop Products`, `Join My Team`)
- `url` (String, Destination URL)
- `type` (String, e.g. `CUSTOM`, `SHOP`, `ENROLL`, `CONTACT`, `SOCIAL`)
- `sortOrder` (Integer, Display priority)
- `enabled` (Boolean, Whether the link is currently visible)
- `createdAt`, `updatedAt` (DateTime)

---

### Endpoints

#### 1. Retrieve / Auto-Provision Website
- **`GET /api/v1/my-website`**
- **Auth**: Bearer token required
- **Description**: Returns the authenticated distributor's website and links. If one does not yet exist, it is auto-provisioned with default branding and starter links.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "distributorId": "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "slug": "rahul-kaushal",
    "subdomain": "rahul",
    "title": "Rahul Kaushal - Official Wellness Store",
    "description": "Welcome to my official storefront. Empowering your lifestyle with premium products.",
    "theme": "EMERALD_LUXURY",
    "logo": "https://assets.kashvimlm.com/logos/rahul.png",
    "isPublished": true,
    "links": [
      {
        "id": "l1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "websiteId": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "label": "Shop Products",
        "url": "/products?ref=rahul",
        "type": "SHOP",
        "sortOrder": 1,
        "enabled": true
      },
      {
        "id": "l2a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "websiteId": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "label": "Join My Team",
        "url": "/enroll?sponsor=DST-10001",
        "type": "ENROLL",
        "sortOrder": 2,
        "enabled": true
      }
    ],
    "distributor": {
      "id": "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "distributorCode": "DST-10001",
      "fullName": "Rahul Kaushal",
      "email": "rahul@example.com"
    }
  },
  "message": "Distributor website retrieved successfully."
}
```

#### 2. Update Website Settings
- **`PATCH /api/v1/my-website`**
- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "title": "Rahul Kaushal - Health & Living",
  "description": "Discover curated health, nutrition, and home essentials.",
  "theme": "SAPPHIRE_MODERN",
  "logo": "https://cdn.example.com/rahul-logo.png",
  "slug": "rahul-kaushal-official",
  "subdomain": "rahul-official",
  "isPublished": true
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "slug": "rahul-kaushal-official",
    "subdomain": "rahul-official",
    "title": "Rahul Kaushal - Health & Living",
    "description": "Discover curated health, nutrition, and home essentials.",
    "theme": "SAPPHIRE_MODERN",
    "logo": "https://cdn.example.com/rahul-logo.png",
    "isPublished": true,
    "updatedAt": "2026-09-22T07:15:00.000Z"
  },
  "message": "Distributor website updated successfully."
}
```

#### 3. Retrieve All Website Links
- **`GET /api/v1/my-website/links`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "l1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "label": "Shop Products",
      "url": "/products?ref=rahul",
      "type": "SHOP",
      "sortOrder": 1,
      "enabled": true
    },
    {
      "id": "l2a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "label": "Join My Team",
      "url": "/enroll?sponsor=DST-10001",
      "type": "ENROLL",
      "sortOrder": 2,
      "enabled": true
    }
  ],
  "message": "Website navigation links retrieved successfully."
}
```

#### 4. Create Navigation Link
- **`POST /api/v1/my-website/links`**
- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "label": "Follow My Instagram",
  "url": "https://instagram.com/rahul_wellness",
  "type": "SOCIAL",
  "sortOrder": 3,
  "enabled": true
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "l3a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "websiteId": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "label": "Follow My Instagram",
    "url": "https://instagram.com/rahul_wellness",
    "type": "SOCIAL",
    "sortOrder": 3,
    "enabled": true,
    "createdAt": "2026-09-22T07:20:00.000Z"
  },
  "message": "Navigation link created successfully."
}
```

#### 5. Update Navigation Link
- **`PATCH /api/v1/my-website/links/:id`**
- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "label": "Connect on Instagram",
  "sortOrder": 1,
  "enabled": true
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "l3a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "label": "Connect on Instagram",
    "sortOrder": 1,
    "enabled": true,
    "updatedAt": "2026-09-22T07:25:00.000Z"
  },
  "message": "Navigation link updated successfully."
}
```

#### 6. Delete Navigation Link
- **`DELETE /api/v1/my-website/links/:id`**
- **Auth**: Bearer token required
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "l3a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c"
  },
  "message": "Navigation link deleted successfully."
}
```

#### 7. Retrieve Public Distributor Storefront
- **`GET /api/v1/public/distributor/:slug`**
- **Auth**: None (Public unauthenticated endpoint)
- **Parameters**:
  - `slug` (path parameter, required): Replicated website slug, subdomain, or distributor code (e.g. `rahul-kaushal`, `DST-10001`)
- **Description**: Returns the public-facing storefront settings, active navigation links (only `enabled: true`), distributor public profile, and referral/shopping URLs. If the distributor's website is unpublished or inactive, returns a 404 error.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "distributorId": "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "slug": "rahul-kaushal",
    "subdomain": "rahul",
    "title": "Rahul Kaushal - Official Wellness Store",
    "description": "Welcome to my official storefront. Empowering your lifestyle with premium products.",
    "theme": "EMERALD_LUXURY",
    "logo": "https://assets.kashvimlm.com/logos/rahul.png",
    "bannerUrl": "https://assets.kashvimlm.com/logos/rahul.png",
    "isPublished": true,
    "contactEmail": "rahul@example.com",
    "contactPhone": "+1-555-0100",
    "socialLinks": null,
    "createdAt": "2026-09-22T07:00:00.000Z",
    "updatedAt": "2026-09-22T07:15:00.000Z",
    "distributor": {
      "id": "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "distributorCode": "DST-10001",
      "displayName": "Rahul Kaushal",
      "firstName": "Rahul",
      "lastName": "Kaushal",
      "status": "ACTIVE",
      "memberSince": "2026",
      "rank": {
        "name": "Emerald Director",
        "displayName": "Emerald Director",
        "badgeIcon": "https://assets.kashvimlm.com/ranks/emerald.svg"
      }
    },
    "links": [
      {
        "id": "l1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "websiteId": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "label": "Shop Products",
        "url": "/products?ref=rahul-kaushal",
        "type": "SHOP",
        "sortOrder": 1,
        "enabled": true,
        "createdAt": "2026-09-22T07:00:00.000Z",
        "updatedAt": "2026-09-22T07:00:00.000Z"
      },
      {
        "id": "l2a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "websiteId": "w1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "label": "Join My Team",
        "url": "/enroll?sponsor=DST-10001",
        "type": "ENROLL",
        "sortOrder": 2,
        "enabled": true,
        "createdAt": "2026-09-22T07:00:00.000Z",
        "updatedAt": "2026-09-22T07:00:00.000Z"
      }
    ],
    "storefrontUrls": {
      "referralLink": "/enroll?sponsor=DST-10001",
      "enrollmentLink": "/enroll?sponsor=DST-10001",
      "shopLink": "/products?ref=rahul-kaushal",
      "contactLink": "/contact?distributor=DST-10001"
    }
  },
  "message": "Public distributor website retrieved successfully."
}
```

---

## 14. News & Announcements Management (`/api/v1/news` & `/api/v1/admin/news`)

The News subsystem manages corporate announcements, leadership updates, event bulletins, and product releases. Supports public viewing for associates and visitors, and administrative CMS authoring.

### News Model Fields
- `title` (String, required): Headline title (3-200 characters)
- `slug` (String, unique): URL-friendly slug (auto-generated if omitted)
- `summary` (String, required): Brief preview / summary excerpt (5-1000 characters)
- `content` (String, required): Full article content markdown or text
- `image` (String | null): Article header image URL
- `status` (Enum: `DRAFT`, `PUBLISHED`, `ARCHIVED`): Article publication status
- `publishedAt` (DateTime | null): Timestamp of public release
- `authorId` (UUID | null): Reference to creating user / administrator
- `targetAudience` (String, default `ALL`): Audience visibility targeting

---

### Public Endpoints

#### 1. List Published News Articles
- **`GET /api/v1/news`**
- **Auth**: None (Public access)
- **Query Parameters**:
  - `search` (string): Full-text search across title, summary, content
  - `targetAudience` (string): Filter by audience (e.g. `ALL`, `DISTRIBUTOR`)
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `sort` (string, `newest`, `oldest`, `title_asc`, `title_desc`, default: `newest`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "n1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "title": "All of Your Team Manager Reports Are Now Free",
      "slug": "all-team-manager-reports-are-now-free",
      "summary": "Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost.",
      "content": "We are thrilled to announce that all 40+ Team Manager Reports are now unlocked...",
      "image": "https://images.unsplash.com/photo-1551836022-d5d88e9218df",
      "status": "PUBLISHED",
      "publishedAt": "2026-03-01T08:00:00.000Z",
      "authorId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "targetAudience": "ALL",
      "createdAt": "2026-03-01T08:00:00.000Z",
      "updatedAt": "2026-03-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "message": "News articles retrieved successfully."
}
```

#### 2. Retrieve Published News Article by Slug
- **`GET /api/v1/news/:slug`**
- **Auth**: None (Public access)
- **Parameters**:
  - `slug` (path parameter, required): Article slug or UUID
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "n1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "title": "All of Your Team Manager Reports Are Now Free",
    "slug": "all-team-manager-reports-are-now-free",
    "summary": "Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost.",
    "content": "We are thrilled to announce that all 40+ Team Manager Reports are now unlocked...",
    "image": "https://images.unsplash.com/photo-1551836022-d5d88e9218df",
    "status": "PUBLISHED",
    "publishedAt": "2026-03-01T08:00:00.000Z",
    "authorId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "author": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "email": "admin@kashvimlm.com",
      "displayName": "Corporate Admin"
    },
    "targetAudience": "ALL",
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-01T08:00:00.000Z"
  },
  "message": "News article retrieved successfully."
}
```

---

### Admin Endpoints

#### 3. List All News (Admin)
- **`GET /api/v1/admin/news`**
- **Auth**: Bearer token required (Roles: `SUPER_ADMIN`, `ADMIN`)
- **Query Parameters**:
  - `status`: Filter by status (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
  - `search`, `page`, `limit`, `sort`
- **Response (`200 OK`)**: Array of articles matching query with pagination metadata.

#### 4. Create News Article
- **`POST /api/v1/admin/news`**
- **Auth**: Bearer token required (Roles: `SUPER_ADMIN`, `ADMIN`)
- **Request Body**:
```json
{
  "title": "Annual Leadership Cruise 2026 Announced",
  "slug": "annual-leadership-cruise-2026",
  "summary": "Set sail with our top leaders in the Caribbean! Review BV qualification milestones.",
  "content": "Complete contest rules, qualification criteria, double BV promotional windows, and itinerary...",
  "image": "https://images.example.com/cruise.jpg",
  "status": "PUBLISHED",
  "publishedAt": "2026-03-22T10:00:00.000Z",
  "targetAudience": "ALL"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "n2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d",
    "title": "Annual Leadership Cruise 2026 Announced",
    "slug": "annual-leadership-cruise-2026",
    "summary": "Set sail with our top leaders in the Caribbean! Review BV qualification milestones.",
    "content": "Complete contest rules, qualification criteria, double BV promotional windows, and itinerary...",
    "image": "https://images.example.com/cruise.jpg",
    "status": "PUBLISHED",
    "publishedAt": "2026-03-22T10:00:00.000Z",
    "authorId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "targetAudience": "ALL",
    "createdAt": "2026-09-22T07:20:00.000Z",
    "updatedAt": "2026-09-22T07:20:00.000Z"
  },
  "message": "News article created successfully."
}
```

#### 5. Update News Article
- **`PATCH /api/v1/admin/news/:id`**
- **Auth**: Bearer token required (Roles: `SUPER_ADMIN`, `ADMIN`)
- **Request Body**:
```json
{
  "summary": "Updated qualification deadline: April 30, 2026.",
  "status": "PUBLISHED"
}
```
- **Response (`200 OK`)**: Updated news article record.

#### 6. Delete News Article
- **`DELETE /api/v1/admin/news/:id`**
- **Auth**: Bearer token required (Roles: `SUPER_ADMIN`, `ADMIN`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "n2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d"
  },
  "message": "News article deleted successfully."
}
```

---

## Health Check Endpoint

### `GET /api/v1/health`

- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "API is healthy"
}
```



