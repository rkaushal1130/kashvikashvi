# KashviMLM Full-Stack Backend Architectural Analysis & Specification

> **Document Path**: `/docs/backend-analysis.md`  
> **Target System**: Enterprise Multi-Level Marketing (Binary Dual-Leg Matrix) & Distributor E-Commerce Platform  
> **Author**: Antigravity Assistant  
> **Status**: Review & Alignment Phase (Pre-Implementation)

---

## 1. Executive Summary

This document performs an exhaustive audit of the existing **KashviMLM** frontend codebase and establishes the blueprint for a production-grade backend engineered with:
- **Node.js + Express.js + TypeScript**
- **PostgreSQL Database**
- **Prisma ORM** (type-safe data layer & schema migrations)
- **JWT Authentication** (stateless authorization)
- **Argon2** (cryptographically superior, memory-hard password hashing)
- **Zod** (runtime validation for bodies, query parameters, and route parameters)
- **Helmet & CORS** (hardened HTTP security headers)
- **Rate Limiting** (anti-brute force and DDoS mitigation via `express-rate-limit`)
- **Pino** (high-performance structured JSON logging with request context)
- **Swagger / OpenAPI 3.0** (interactive API documentation and contract testing)

> [!IMPORTANT]
> **Zero Frontend Regression Guarantee**: The existing frontend UI, styling, user interactions, and visual layouts will remain untouched. The backend API is reverse-engineered directly from the existing frontend state structures, forms, modals, and localStorage contracts to ensure a seamless drop-in integration.

---

## 2. Complete Existing Frontend Architecture Audit

### 2.1 Framework & Core Dependencies
| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | React 19.2.8 + Vite 8.2.2 | Single-Page Application (SPA) with fast HMR |
| **Routing** | `react-router-dom` v7.18.3 | Client-side routing with `BrowserRouter` |
| **Iconography** | `lucide-react` v1.43.0 | Consistent iconography |
| **Styling** | Vanilla CSS3 | High-fidelity responsive stylesheets (`Profile.css`, `DistributorDashboard.css`, `ShopView.css`, `ProductManagerView.css`, `EnrollmentView.css`, `Contact.css`) |
| **State Management** | React Local State (`useState`, `useMemo`, `useEffect`) | Local UI state synchronized via `localStorage` and custom window events (`kashvi_auth_change`, `kashvi_catalog_update`) |
| **API Client** | *Currently None* | No remote `fetch` or `axios` calls exist; all operations operate on client-side state and mock data |
| **Type System** | JavaScript (ESM / JSX) | Untyped client-side JavaScript with implicit object contracts |

### 2.2 Existing Routes Map (`src/App.jsx`)
| Route Path | Rendered Component | View Mode / Guard Condition |
| :--- | :--- | :--- |
| `/` | `Home.jsx` | Public Homepage (Hero catalog, categories, product showcase, testimonials, footer) |
| `/contact` | `Contact.jsx` | Public Customer Support & Compliance Portal with FAQs |
| `/profile` | `Profile.jsx` | Dynamic: Displays **Login / Register** when unauthenticated; switches to full-width **Distributor Portal** when authenticated |
| `/dashboard` | `Profile.jsx` | Alias to `/profile` (Distributor Portal when logged in) |
| `*` | `Home.jsx` | Fallback catch-all route |

### 2.3 Existing UI Components Inventory
```
src/
├── components/
│   ├── Navbar.jsx                   # Public top navigation with live kashvi_auth state sync
│   ├── Footer.jsx                   # Corporate footer with compliance, contact, and legal links
│   ├── PageContainer.jsx            # Max-width layout wrapper
│   ├── PageTitle.jsx                # Page title banner component
│   └── dashboard/                   # 4 Core Distributor Views
│       ├── DistributorDashboard.jsx # Screen A: Main distributor portal, KPI cards & navigation rail
│       ├── EnrollmentView.jsx       # Screen B: 5-step member & customer binary registration wizard
│       ├── ShopView.jsx             # Screen C: Wholesale product catalog, filtering, cart & checkout
│       └── ProductManagerView.jsx   # Screen D: ID Owner (88767139) catalog, pricing & inventory manager
├── pages/
│   ├── Home.jsx                     # Public Landing page
│   ├── Contact.jsx                  # Screen E: Official Support Desk & Grievance form
│   └── Profile.jsx                  # Auth state hub (Sign In, Register, Auth Guard)
└── data/
    └── productCatalog.js            # Initial Clothes/Hozri & Electronics placeholders & localStorage helpers
```

### 2.4 Existing Forms Audit
1. **Login Form** (`src/pages/Profile.jsx`):
   - `username`: Username or Member ID (Required)
   - `password`: Password with toggleable eye visibility (Required)
   - `sponsorId`: Sponsor ID (Compulsory: users cannot log in without a valid Sponsor ID)
   - `rememberMe`: Checkbox boolean
2. **Register Form** (`src/pages/Profile.jsx`):
   - `fullName`: Full Name (Required)
   - `email`: Email address (Required)
   - `phone`: Mobile number (Required)
   - `username`: Preferred handle (Optional/derived)
   - `password`: Created password with eye toggle (Required)
   - `confirmPassword`: Confirmation password with eye toggle (Required)
3. **Enrollment Wizard Form** (`src/components/dashboard/EnrollmentView.jsx`):
   - `enrollType`: 'distributor' (Brand Partner) | 'customer' (Preferred Customer)
   - *Step 1 (Personal)*: `fullName`, `dob`, `gender`, `email`, `phone`, `panNumber`
   - *Step 2 (Address)*: `address`, `city`, `state`, `pincode`
   - *Step 3 (Placement)*: `placementLeg` ('auto' | 'left' | 'right'), `parentBusinessCenter` ('BC 001' | 'BC 002' | 'BC 003'), `sponsorId` (`88767139`)
   - *Step 4 (Starter Kit)*: `starterKitId` ('kit_starter' 50 BV | 'kit_pro' 100 BV | 'kit_elite' 200 BV)
   - *Step 5 (Bank & Security)*: `bankName`, `accountNumber`, `ifscCode`, `password` (with eye toggle), `agreeTerms`
4. **Add Product Form** (`src/components/dashboard/ProductManagerView.jsx`):
   - `name`: Product title
   - `category`: 'Clothes & Hosiery (Hozri)' | 'Electronics & Smart Devices'
   - `distributorPrice`: Wholesale price (initialized to 0)
   - `mrp`: Maximum Retail Price (initialized to 0)
   - `volumeBV`: Commission Volume Points (initialized to 0)
   - `stock`: Inventory count (initialized to 0)
   - `status`: 'Pending Pricing' | 'In Stock' | 'Low Stock' | 'Out of Stock'
   - `servingSize`: Size / capacity specification (e.g. "Size: M / L / XL / XXL")
   - `imageSourceMode`: 'gallery' (file upload/drag-and-drop) | 'preset' | 'url'
   - `shortDesc`: Concise summary
   - `benefits`: Bullet points / comma-separated features
   - `usage`: Usage instructions
5. **Support & Contact Form** (`src/pages/Contact.jsx`):
   - `fullName`: Applicant name (Required)
   - `email`: Official email (Required)
   - `phone`: Mobile number (Optional)
   - `memberId`: Distributor ID (Optional)
   - `inquiryType`: Department selector (`General Customer & Order Support`, `Distributor Commission & BV Inquiries`, `Product Quality & Replacement`, `Grievance & Consumer Protection`, `Compliance & Legal`)
   - `subject`: Short inquiry title
   - `message`: Detailed description (Required)
   - `agreeTerms`: Privacy consent checkbox

### 2.5 Existing LocalStorage & Mock Data Contracts
| Storage Key / Event | Content & Structure | Consumers |
| :--- | :--- | :--- |
| `kashvi_auth` | `{ isLoggedIn: boolean, user: { name, memberId, sponsorId, email, phone, rank, tier, teamSize, ... } }` | `App.jsx`, `Navbar.jsx`, `Profile.jsx`, `DistributorDashboard.jsx` |
| `kashvi_auth_change` | Custom window event fired upon login, registration, or logout | Syncs `Navbar` and `AppContent` layout |
| `kashvi_product_catalog` | Array of product objects (`id`, `sku`, `name`, `category`, `distributorPrice`, `mrp`, `volumeBV`, `stock`, `status`, `image`, `benefits`, ...) | `productCatalog.js`, `ShopView.jsx`, `ProductManagerView.jsx` |
| `kashvi_catalog_update` | Custom window event fired when ID Owner adds, updates, or deletes catalog items | Re-renders `ShopView` and `DistributorDashboard` carousels |
| `kashvi_downline_team` | Array of newly registered downline distributors and preferred customers | `EnrollmentView.jsx` |

---

## 3. Deep-Dive Screen-by-Screen Specifications

### Screen A: Distributor Dashboard (`DistributorDashboard.jsx`)
- **Header & Navigation Rail**:
  - Branding: KASHVIMLM corporate logo
  - Market selector: India flag (`IN`, `INR ₹`)
  - Notification icon with unread badge counter (3 unread items)
  - User avatar with menu: Rank & Qualifications modal, Replicated site modal, Payouts & Direct Deposit modal, Switch to Retail Store, Sign Out
  - Left rail with 4 icons:
    1. `dashboard` -> Overview (Home & Training tabs)
    2. `enroll` -> Enrollment Portal (`EnrollmentView`)
    3. `shop` -> Distributor Storefront (`ShopView`)
    4. `manage_products` -> Product & Pricing Manager (`ProductManagerView`)
- **Identity & Rank Column**:
  - Full Name: **Rahul kaushal**
  - Member ID: `88767139` (ID Owner)
  - Brand Partner Since: `2026`
  - Rank: `Emerald Director` / `Business Center`
  - Badges Modal: Displays badges (Emerald Director, Top Recruiter, Pacesetter Elite, 100 BV Active Club)
- **Estimated Commission Column**:
  - Gross Amount: `₹22,400.00`
  - Hide Commission Information toggle switch
  - Qualification status: `Active & Qualified (120 / 100 PSV)`
  - Settlement cycle countdown: `Next Cutoff: Friday 11:59 PM IST`
  - Qualification modal with PSV requirements and matching volume rules
- **Bonus Breakdown Column**:
  - Base Commission: `₹14,000.00` (10% matching weaker-leg volume)
  - PC Order Bonus: `₹3,400.00` (Preferred customer wholesale markup)
  - Milestone Bonus: `₹2,500.00`
  - Frontline Bonus: `₹2,500.00`
- **Replicated Website & Sharing**:
  - Dropdown: "My KASHVIMLM Website"
  - Customer type selector: "Brand Partner / Associate", "Preferred Customer", "Retail Shopper"
  - Copy link button with clipboard feedback
- **Quick Links**:
  - "Enroll Brand Partner", "Shop Products", "Volume Report", "My Network Tree"
- **Home vs. Training Tabs**:
  - `home`: JumpStart 5 tasks (Orientation, Replicated Site, SMS Alerts, Ethics, App Download), Priority Contact CRM with filter pills (`All`, `Follow Up`, `Preferred Customers`, `Team Leads`), Binary Tree Volume (BC 001/002/003), News feed & 2026 Activity Contest banner with opt-in, The Spotlight product carousel.
  - `training`: 4 curriculum modules (Compensation Plan Masterclass, Compliant Direct Selling DSMR 2021, Connect & Share, Product Science).

### Screen B: Enrollment (`EnrollmentView.jsx`)
- **Types**: Brand Partner / Associate vs Preferred Customer
- **Sponsor Lock**: Auto-bound to logged-in user (Rahul kaushal, ID `88767139`)
- **5-Step Wizard**:
  - Step 1: Personal (Name, DOB, Gender, Email, Mobile, PAN)
  - Step 2: Address (Street, City, State, Pincode)
  - Step 3: Binary Placement (Auto-balanced, Left Leg BC 002, Right Leg BC 003)
  - Step 4: Starter Pack (Starter 50 BV, Pro Builder 100 BV, Executive Elite 200 BV)
  - Step 5: Bank details (Bank Name, Account Number, IFSC) + Portal Password + DSMR 2021 Terms
- **Post-Submission**:
  - Issues official Member ID (e.g. `186xxxxx`)
  - Auto-places node in dual-leg binary matrix
  - Credits personal sales volume (PSV) to applicant and leg BV to upline chain

### Screen C: Product Store (`ShopView.jsx`)
- **Filters**: "All Categories", "Clothes & Hosiery (Hozri)", "Electronics & Smart Devices"
- **Search & Sort**: Real-time substring filter; sorting by Price (Low/High) and BV (High/Low)
- **Product Card**: Image, Title, Category Badge, Wholesale DP, MRP, BV Points, Stock status, Add-to-Cart
- **Sliding Cart Drawer**:
  - Dynamic item quantity adjustment
  - Subtotals: Wholesale Total, MRP Total, Total BV, and Savings Breakdown
- **Checkout Modal**:
  - Shipping address selection
  - Payment method confirmation
  - Generates Order ID (`KASH-ORD-xxxxxx`), updates inventory, records BV transactions

### Screen D: Product & Pricing Management (`ProductManagerView.jsx`)
- **Access Control**: Strict ID Owner protection (`88767139` / Rahul kaushal)
- **Tabs**: "Add Product" vs "Catalog & Price Manager"
- **Add Product Form**:
  - Supports image upload from computer/phone gallery (base64 data URL preview with drag-and-drop), preset library, or external URL
  - Fields for Title, Category, MRP, DP, BV, Stock, Status, Size/Capacity, Short Desc, Benefits, Usage
- **Inventory & Pricing Table**:
  - Checkboxes for selecting individual products and "Select All" header
  - **One-Click Bulk Deletion**: Deletes all selected products simultaneously
  - **Delete All**: Resets catalog to 0 items
  - **Load Placeholders**: Populates 8 Hozri & Electronics items with all numeric fields set to 0
  - Inline table editing for Wholesale Price, MRP, BV, Stock quantity, and Stock status

### Screen E: Support Desk (`Contact.jsx`)
- **Helpline & Direct Channels**:
  - Phone: `+91 70156 43886` and Toll-Free `1800-202-9900`
  - Email: `kashvicustomercare@gmail.com`
  - Pan-India Head Office: Mumbai, Maharashtra
- **Ticket Submission**:
  - Captures Name, Email, Mobile, Member ID, Category, Subject, Message, Consent
  - Generates tracking ticket ID (`KV-TKT-xxxxxx`) with 24-48 business hour SLA
- **FAQ Accordion**:
  - 6 comprehensive sections addressing logistics, Sunday midnight cycle calculations, grievances, and KYC updates

---

## 4. Proposed Modern Backend Architecture

### 4.1 Technology Stack Selection
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KashviMLM REST API Server                          │
│                Node.js + Express.js + TypeScript (ESM)                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       ▼                             ▼                             ▼
Security & Ingress           Runtime Validation            Observability
- Helmet (Security headers)  - Zod (Strict schemas)        - Pino + Pino-HTTP
- CORS (Origin control)      - Auth guards (JWT + Argon2)  - Request ID correlation
- Express-Rate-Limit         - Admin & ID Owner checks     - Swagger / OpenAPI UI
       │                             │                             │
       └─────────────────────────────┼─────────────────────────────┘
                                     │
                                     ▼
                        14 Modular Feature Services
  Auth | Distributor | Enrollment | Products | Orders | MLM Tree | BV Engine
  Commissions | Wallet | Payouts | Training | Support | Notifications | Admin
                                     │
                                     ▼
                         Prisma ORM (Data Access)
                     Type-Safe Queries & Migrations
                                     │
                                     ▼
                            PostgreSQL Database
```

---

## 5. Required Database Entities (Prisma Schema Design)

Below is the entity-relationship design implemented in Prisma ORM matching all existing frontend screens:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  DISTRIBUTOR
  ADMIN
  CUSTOMER
}

enum QualificationStatus {
  ACTIVE
  GRACE_PERIOD
  INACTIVE
}

enum ProductStatus {
  IN_STOCK
  LOW_STOCK
  OUT_OF_STOCK
  PENDING_PRICING
}

enum PlacementLeg {
  LEFT
  RIGHT
  AUTO
}

enum OrderStatus {
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

// 1. Users (Authentication & Identity)
model User {
  id           String        @id @default(uuid())
  email        String        @unique
  phone        String        @unique
  username     String        @unique
  passwordHash String        @map("password_hash")
  role         Role          @default(DISTRIBUTOR)
  isActive     Boolean       @default(true) @map("is_active")
  lastLoginAt  DateTime?     @map("last_login_at")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  distributor  Distributor?
  auditLogs    AuditLog[]

  @@map("users")
}

// 2. Distributors (MLM Identity & Profile)
model Distributor {
  id                  String              @id @default(uuid())
  userId              String              @unique @map("user_id")
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  memberId            String              @unique @map("member_id") // e.g. 88767139 (Rahul kaushal)
  fullName            String              @map("full_name")
  sponsorId           String              @map("sponsor_id")
  parentId            String?             @map("parent_id")
  placementLeg        PlacementLeg        @default(AUTO) @map("placement_leg")
  rank                String              @default("Business Center")
  qualificationStatus QualificationStatus @default(ACTIVE) @map("qualification_status")
  currentPsv          Decimal             @default(0.00) @map("current_psv") @db.Decimal(10, 2)
  lifetimeBv          Decimal             @default(0.00) @map("lifetime_bv") @db.Decimal(12, 2)
  teamSize            Int                 @default(0) @map("team_size")
  dob                 DateTime?
  gender              String?
  panNumber           String?             @map("pan_number")
  bankName            String?             @map("bank_name")
  accountNumber       String?             @map("account_number")
  ifscCode            String?             @map("ifsc_code")
  address             String?
  city                String?
  state               String?
  pincode             String?
  country             String              @default("India")
  joinedAt            DateTime            @default(now()) @map("joined_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")

  wallet              Wallet?
  orders              Order[]
  bvLedgers           BvLedger[]
  commissionLedgers   CommissionLedger[]
  payouts             Payout[]
  supportTickets      SupportTicket[]
  notifications       Notification[]
  trainingProgress    TrainingProgress[]
  mlmTreeNodes        MlmTreeNode[]

  @@index([memberId])
  @@index([sponsorId])
  @@map("distributors")
}

// 3. Products (Wholesale Store & Catalog Management)
model Product {
  id               String        @id @default(uuid())
  sku              String        @unique
  name             String
  category         String        // 'Clothes & Hosiery (Hozri)' | 'Electronics & Smart Devices'
  distributorPrice Decimal       @default(0.00) @map("distributor_price") @db.Decimal(10, 2)
  mrp              Decimal       @default(0.00) @db.Decimal(10, 2)
  volumeBv         Decimal       @default(0.00) @map("volume_bv") @db.Decimal(10, 2)
  stockQuantity    Int           @default(0) @map("stock_quantity")
  status           ProductStatus @default(PENDING_PRICING)
  imageUrl         String?       @map("image_url") @db.Text
  sizeSpec         String?       @map("size_spec")
  shortDesc        String?       @map("short_desc") @db.Text
  benefits         Json          @default("[]")
  usage            String?       @db.Text
  isActive         Boolean       @default(true) @map("is_active")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")
  orderItems       OrderItem[]

  @@index([category])
  @@map("products")
}

// 4. Orders & Order Items (Wholesale Store Purchases)
model Order {
  id              String        @id @default(uuid())
  orderNumber     String        @unique @map("order_number") // e.g. KASH-ORD-781923
  distributorId   String        @map("distributor_id")
  distributor     Distributor   @relation(fields: [distributorId], references: [id])
  totalAmount     Decimal       @map("total_amount") @db.Decimal(12, 2)
  totalBv         Decimal       @map("total_bv") @db.Decimal(10, 2)
  totalMrp        Decimal       @map("total_mrp") @db.Decimal(12, 2)
  savingsAmount   Decimal       @default(0.00) @map("savings_amount") @db.Decimal(12, 2)
  paymentMethod   String        @default("Online Payment") @map("payment_method")
  paymentStatus   PaymentStatus @default(PAID) @map("payment_status")
  orderStatus     OrderStatus   @default(PROCESSING) @map("order_status")
  shippingAddress String        @map("shipping_address") @db.Text
  trackingNumber  String?       @map("tracking_number")
  deliveryEta     String        @default("2-4 Business Days via Bluedart Express") @map("delivery_eta")
  placedAt        DateTime      @default(now()) @map("placed_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  items           OrderItem[]
  bvLedgers       BvLedger[]

  @@index([distributorId])
  @@map("orders")
}

model OrderItem {
  id                   String   @id @default(uuid())
  orderId              String   @map("order_id")
  order                Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId            String   @map("product_id")
  product              Product  @relation(fields: [productId], references: [id])
  quantity             Int      @default(1)
  unitDistributorPrice Decimal  @map("unit_distributor_price") @db.Decimal(10, 2)
  unitMrp              Decimal  @map("unit_mrp") @db.Decimal(10, 2)
  unitBv               Decimal  @map("unit_bv") @db.Decimal(10, 2)
  totalPrice           Decimal  @map("total_price") @db.Decimal(10, 2)
  totalBv              Decimal  @map("total_bv") @db.Decimal(10, 2)

  @@map("order_items")
}

// 5. MLM Tree (Dual-Leg Binary Topology)
model MlmTreeNode {
  id                  String       @id @default(uuid())
  distributorId       String       @map("distributor_id")
  distributor         Distributor  @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  businessCenterCode  String       @default("BC 001") @map("business_center_code")
  parentDistributorId String?      @map("parent_distributor_id")
  leftChildId         String?      @map("left_child_id")
  rightChildId        String?      @map("right_child_id")
  legPosition         PlacementLeg @default(AUTO) @map("leg_position")
  depth               Int          @default(0)
  treePath            String?      @map("tree_path")
  createdAt           DateTime     @default(now()) @map("created_at")

  @@index([distributorId])
  @@map("mlm_tree")
}

// 6. BV Ledger (Volume Accumulation & Leg Totals)
model BvLedger {
  id             String      @id @default(uuid())
  distributorId  String      @map("distributor_id")
  distributor    Distributor @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  sourceOrderId  String?     @map("source_order_id")
  order          Order?      @relation(fields: [sourceOrderId], references: [id])
  type           String      // 'Personal_Order' | 'Downline_Left' | 'Downline_Right' | 'Cycle_Match'
  legAffected    String?     @map("leg_affected")
  amountBv       Decimal     @map("amount_bv") @db.Decimal(10, 2)
  leftLegTotal   Decimal     @default(0.00) @map("left_leg_total") @db.Decimal(12, 2)
  rightLegTotal  Decimal     @default(0.00) @map("right_leg_total") @db.Decimal(12, 2)
  carryoverLeft  Decimal     @default(0.00) @map("carryover_left") @db.Decimal(12, 2)
  carryoverRight Decimal     @default(0.00) @map("carryover_right") @db.Decimal(12, 2)
  cycleWeek      Int         @map("cycle_week")
  cycleYear      Int         @default(2026) @map("cycle_year")
  createdAt      DateTime    @default(now()) @map("created_at")

  @@index([distributorId])
  @@map("bv_ledger")
}

// 7. Commission Ledger (Weekly 10% Binary Matching Bonus, TDS, Admin Fees)
model CommissionLedger {
  id                  String      @id @default(uuid())
  distributorId       String      @map("distributor_id")
  distributor         Distributor @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  cycleWeek           Int         @map("cycle_week")
  cycleYear           Int         @default(2026) @map("cycle_year")
  leftLegVolume       Decimal     @map("left_leg_volume") @db.Decimal(12, 2)
  rightLegVolume      Decimal     @map("right_leg_volume") @db.Decimal(12, 2)
  matchedVolume       Decimal     @map("matched_volume") @db.Decimal(12, 2)
  binaryMatchingBonus Decimal     @map("binary_matching_bonus") @db.Decimal(12, 2)
  directSponsorBonus  Decimal     @default(0.00) @map("direct_sponsor_bonus") @db.Decimal(12, 2)
  leadershipBonus     Decimal     @default(0.00) @map("leadership_bonus") @db.Decimal(12, 2)
  grossCommission     Decimal     @map("gross_commission") @db.Decimal(12, 2)
  tdsDeduction        Decimal     @map("tds_deduction") @db.Decimal(10, 2) // 5% TDS
  adminCharge         Decimal     @map("admin_charge") @db.Decimal(10, 2)  // 5% Admin
  netPayout           Decimal     @map("net_payout") @db.Decimal(12, 2)
  status              String      @default("Calculated") // 'Calculated' | 'Approved' | 'Settled'
  calculatedAt        DateTime    @default(now()) @map("calculated_at")
  payouts             Payout[]

  @@index([distributorId])
  @@map("commission_ledger")
}

// 8. Wallet & Wallet Transactions (Balances & Statements)
model Wallet {
  id                  String              @id @default(uuid())
  distributorId       String              @unique @map("distributor_id")
  distributor         Distributor         @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  availableBalance    Decimal             @default(0.00) @map("available_balance") @db.Decimal(12, 2)
  pendingBalance      Decimal             @default(0.00) @map("pending_balance") @db.Decimal(12, 2)
  lifetimeEarnings    Decimal             @default(0.00) @map("lifetime_earnings") @db.Decimal(12, 2)
  lifetimeWithdrawals Decimal             @default(0.00) @map("lifetime_withdrawals") @db.Decimal(12, 2)
  updatedAt           DateTime            @updatedAt @map("updated_at")
  transactions        WalletTransaction[]

  @@map("wallets")
}

model WalletTransaction {
  id            String   @id @default(uuid())
  walletId      String   @map("wallet_id")
  wallet        Wallet   @relation(fields: [walletId], references: [id], onDelete: Cascade)
  type          String   // 'COMMISSION_CREDIT' | 'WITHDRAWAL_DEBIT' | 'ORDER_PAYMENT'
  amount        Decimal  @db.Decimal(12, 2)
  balanceBefore Decimal  @map("balance_before") @db.Decimal(12, 2)
  balanceAfter  Decimal  @map("balance_after") @db.Decimal(12, 2)
  referenceId   String?  @map("reference_id")
  remarks       String?
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([walletId])
  @@map("wallet_transactions")
}

// 9. Payouts (Bank Settlement Batches)
model Payout {
  id                 String            @id @default(uuid())
  payoutBatchCode    String            @map("payout_batch_code")
  distributorId      String            @map("distributor_id")
  distributor        Distributor       @relation(fields: [distributorId], references: [id])
  commissionLedgerId String?           @map("commission_ledger_id")
  commissionLedger   CommissionLedger? @relation(fields: [commissionLedgerId], references: [id])
  amount             Decimal           @db.Decimal(12, 2)
  bankName           String            @map("bank_name")
  accountNumber      String            @map("account_number")
  ifscCode           String            @map("ifsc_code")
  utrReference       String?           @map("utr_reference")
  status             String            @default("Queued")
  processedAt        DateTime?         @map("processed_at")
  createdAt          DateTime          @default(now()) @map("created_at")

  @@index([distributorId])
  @@map("payouts")
}

// 10. Training Progress (Curriculum & JumpStart)
model TrainingProgress {
  id            String      @id @default(uuid())
  distributorId String      @map("distributor_id")
  distributor   Distributor @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  moduleCode    String      @map("module_code")
  moduleTitle   String      @map("module_title")
  isCompleted   Boolean     @default(false) @map("is_completed")
  completedAt   DateTime?   @map("completed_at")

  @@unique([distributorId, moduleCode])
  @@map("training_progress")
}

// 11. Support Tickets (Screen E)
model SupportTicket {
  id            String         @id @default(uuid())
  ticketNumber  String         @unique @map("ticket_number") // e.g. KV-TKT-781290
  distributorId String?        @map("distributor_id")
  distributor   Distributor?   @relation(fields: [distributorId], references: [id])
  fullName      String         @map("full_name")
  email         String
  phone         String?
  category      String         // 'General Support' | 'Commission & BV' | 'Grievance' | ...
  subject       String
  message       String         @db.Text
  priority      TicketPriority @default(MEDIUM)
  status        TicketStatus   @default(OPEN)
  adminResponse String?        @map("admin_response") @db.Text
  createdAt     DateTime       @default(now()) @map("created_at")
  resolvedAt    DateTime?      @map("resolved_at")

  @@index([ticketNumber])
  @@map("support_tickets")
}

// 12. Notifications (Screen A Alerts)
model Notification {
  id            String      @id @default(uuid())
  distributorId String      @map("distributor_id")
  distributor   Distributor @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  title         String
  message       String      @db.Text
  type          String      @default("GENERAL") // 'COMMISSION' | 'ENROLLMENT' | 'ORDER' | 'SYSTEM'
  isRead        Boolean     @default(false) @map("is_read")
  actionUrl     String?     @map("action_url")
  createdAt     DateTime    @default(now()) @map("created_at")

  @@index([distributorId])
  @@map("notifications")
}

// 13. Audit Logs (Enterprise Compliance)
model AuditLog {
  id           String   @id @default(uuid())
  actorId      String?  @map("actor_id")
  user         User?    @relation(fields: [actorId], references: [id])
  actorRole    String?  @map("actor_role")
  action       String   // 'PRODUCT_CREATED' | 'COMMISSION_CALCULATED' | 'PAYOUT_SETTLED'
  resourceType String   @map("resource_type")
  resourceId   String   @map("resource_id")
  ipAddress    String?  @map("ip_address")
  metadata     Json     @default("{}")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([action])
  @@map("audit_logs")
}
```

---

## 6. Required REST API Endpoints

All endpoints are hosted under `/api/v1/*` with full Swagger/OpenAPI documentation served at `/api/docs`.

### 6.1 Authentication (`/api/v1/auth`)
| Method | Path | Request Body / Zod Schema | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `{ username, password, sponsorId, rememberMe? }` | No (Rate Limited) | Validates credentials via Argon2; returns signed JWT token + user profile |
| `POST` | `/api/v1/auth/register` | `{ fullName, email, phone, username?, password, confirmPassword }` | No (Rate Limited) | Hashes password with Argon2; creates User, Distributor (`88767139` default sponsor), and Wallet |
| `GET` | `/api/v1/auth/me` | None | Yes (`Bearer`) | Returns current authenticated user profile & roles |
| `POST` | `/api/v1/auth/logout` | None | Yes (`Bearer`) | Invalidates session / confirms client logout |

### 6.2 Distributor Management (`/api/v1/distributors`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/distributors/profile/:memberId?` | None | Yes | Retrieves full distributor summary (Rank, PSV, team size, balances) |
| `GET` | `/api/v1/distributors/business-centers/:memberId?` | None | Yes | Returns BC 001, BC 002, BC 003 volumes and carryovers |
| `PUT` | `/api/v1/distributors/kyc-bank` | `{ bankName, accountNumber, ifscCode, panNumber }` | Yes | Updates bank disbursement details and PAN |
| `GET` | `/api/v1/distributors/:memberId/downlines` | Query: `limit`, `page` | Yes | Retrieves paginated direct downlines |

### 6.3 Enrollment (`/api/v1/enrollment`)
| Method | Path | Request Body (Zod Validated) | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/enrollment/enroll` | `{ enrollType, fullName, dob, gender, email, phone, panNumber, address, city, state, pincode, placementLeg, parentBusinessCenter, starterKitId, bankName, accountNumber, ifscCode, password }` | Yes | Creates new Brand Partner/Customer, hashes password with Argon2, places in binary tree, credits starter kit BV |
| `GET` | `/api/v1/enrollment/validate-sponsor/:sponsorId` | None | No | Checks if sponsor ID exists and returns placement eligibility |

### 6.4 Products & Wholesale Store (`/api/v1/products`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Query: `category`, `search`, `sortBy` | No | Retrieves active product catalog with DP, MRP, and BV points |
| `GET` | `/api/v1/products/:id` | None | No | Retrieves single product details |
| `POST` | `/api/v1/products` | `{ name, category, distributorPrice, mrp, volumeBv, stockQuantity, status, imageUrl, sizeSpec, shortDesc, benefits, usage }` | Yes (ID Owner / Admin) | Adds new product (supports 50MB gallery uploads) |
| `PUT` | `/api/v1/products/:id` | Partial Product fields | Yes (ID Owner / Admin) | Updates product pricing, BV, stock, or details |
| `DELETE` | `/api/v1/products/:id` | None | Yes (ID Owner / Admin) | Deletes a single product item |
| `POST` | `/api/v1/products/bulk-delete` | `{ ids: string[] }` | Yes (ID Owner / Admin) | One-Click bulk deletion of selected items |
| `POST` | `/api/v1/products/reset-zero` | None | Yes (ID Owner / Admin) | Wipes all catalog data to 0 |
| `POST` | `/api/v1/products/load-placeholders`| None | Yes (ID Owner / Admin) | Loads the 8 Hozri & Electronics items initialized to 0 |

### 6.5 Orders & Cart Checkout (`/api/v1/orders`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orders` | Query: `status`, `limit` | Yes | List distributor wholesale order history |
| `GET` | `/api/v1/orders/:orderNumber` | None | Yes | Get specific order invoice & delivery status |
| `POST` | `/api/v1/orders/checkout` | `{ items: [{ productId, quantity }], shippingAddress, paymentMethod }` | Yes | Verifies stock, creates order, credits PSV to member and leg BV to uplines |

### 6.6 Binary MLM Tree (`/api/v1/tree`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/tree/structure/:memberId?` | Query: `depth` (default 3) | Yes | Returns binary tree hierarchy (Left/Right nodes, volumes, member details) |
| `GET` | `/api/v1/tree/placement-suggest` | Query: `sponsorId` | Yes | Auto-balances weaker leg suggestion for optimal matching |

### 6.7 BV Engine (`/api/v1/bv`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/bv/summary/:memberId?` | None | Yes | Current cycle volumes (BC 001/002/003, Left, Right, Carryover) |
| `GET` | `/api/v1/bv/ledger/:memberId?` | Query: `cycleWeek`, `year` | Yes | Comprehensive ledger trail of all volume movements |
| `POST` | `/api/v1/bv/record` | `{ sourceOrderId, distributorId, amountBv, leg }` | Yes (Internal/Admin) | Credits BV downline purchase volume |

### 6.8 Commission Engine (`/api/v1/commissions`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/commissions/history/:memberId?` | None | Yes | Past weekly commission statements (Matching, TDS 5%, Admin 5%, Net) |
| `POST` | `/api/v1/commissions/calculate-cycle` | `{ cycleWeek, cycleYear }` | Yes (Admin) | Executes Sunday midnight 10% weaker-leg matching bonus batch |

### 6.9 Wallet (`/api/v1/wallet`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/wallet/balance/:memberId?` | None | Yes | Available, pending, and lifetime earnings |
| `GET` | `/api/v1/wallet/transactions/:memberId?`| Query: `limit`, `type` | Yes | Statement ledger of all credits and debits |
| `POST` | `/api/v1/wallet/withdraw` | `{ amount, bankAccountId }` | Yes | Requests withdrawal transfer to registered bank |

### 6.10 Payouts (`/api/v1/payouts`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payouts/member/:memberId?` | None | Yes | Past bank settlement transfers & UTR numbers |
| `POST` | `/api/v1/payouts/create-batch` | `{ cycleWeek, cycleYear }` | Yes (Admin) | Compiles weekly payout batch for bank NEFT/RTGS |
| `POST` | `/api/v1/payouts/settle-batch` | `{ batchCode, utrPrefix? }` | Yes (Admin) | Marks batch settled and confirms disbursements |

### 6.11 Training & Progress (`/api/v1/training`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/training/modules` | None | Yes | 4 core modules + JumpStart 5 tasks completion state |
| `POST` | `/api/v1/training/complete` | `{ moduleCode }` | Yes | Marks module complete |

### 6.12 Support & Grievances (`/api/v1/support`)
| Method | Path | Request Body (Zod Validated) | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/support` | Query: `status` | Yes | List tickets (distributor views own; admin views all) |
| `POST` | `/api/v1/support` | `{ fullName, email, phone?, memberId?, category, subject, message }` | No (Rate Limited) | Creates ticket (`KV-TKT-xxxxxx`) & logs audit event |
| `PATCH` | `/api/v1/support/:ticketId/status` | `{ status, adminResponse }` | Yes (Admin) | Updates ticket status and records formal response |

### 6.13 Notifications (`/api/v1/notifications`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | None | Yes | Unread count & notification items |
| `PATCH` | `/api/v1/notifications/:id/read` | None | Yes | Marks individual notification as read |
| `POST` | `/api/v1/notifications/read-all` | None | Yes | Marks all notifications as read |

### 6.14 Admin & Audit Logs (`/api/v1/admin`)
| Method | Path | Request Body | Protected | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/metrics` | None | Yes (Admin) | Total distributors, gross sales, BV turnover, pool |
| `GET` | `/api/v1/admin/audit-logs` | Query: `limit`, `action` | Yes (Admin) | Security, financial, and catalog change audit trail |
| `PATCH` | `/api/v1/admin/distributors/:memberId/status` | `{ status }` | Yes (Admin) | Activate, suspend, or set Grace Period |

---

## 7. Security, Validation & Infrastructure Hardening

### 7.1 Argon2 Password Security
All passwords stored in PostgreSQL will use **Argon2id** (winner of the Password Hashing Competition) with recommended cryptographic parameters:
- `memoryCost`: 65536 KB (64 MB)
- `timeCost`: 3 iterations
- `parallelism`: 4 threads
- `type`: `argon2id` (resistant to both side-channel and GPU cracking)

### 7.2 Zod Schema Validation Pipeline
A dedicated middleware (`validateRequest`) will intercept all incoming HTTP requests before reaching controllers:
- Validates request body, query parameters, and route parameters against strict Zod definitions.
- Disallows unknown keys where appropriate.
- Formats validation errors into standard structured JSON responses:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      { "field": "email", "message": "Invalid email address format" },
      { "field": "password", "message": "Password must contain at least 8 characters" }
    ]
  }
  ```

### 7.3 Helmet & CORS
- **Helmet**: Sets secure HTTP response headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`).
- **CORS**: Configured with strict origin whitelisting (`http://localhost:5173`, production domains) and authorized HTTP headers.

### 7.4 Rate Limiting
- **Global API Limiter**: 300 requests per 15-minute window per IP.
- **Strict Auth Limiter**: 15 requests per 15-minute window on `/api/v1/auth/login`, `/api/v1/auth/register`, and `/api/v1/support` to prevent brute-force attacks and spam.

### 7.5 Pino Structured Logging
- High-performance, low-overhead JSON logging.
- Uses `pino-http` middleware to automatically log `req.id`, `method`, `url`, `statusCode`, and `responseTimeMs`.
- Development mode activates `pino-pretty` for human-readable colorized terminal output.

### 7.6 Swagger / OpenAPI 3.0 Documentation
- Interactive Swagger UI available at `/api/docs` and `/api/v1/docs`.
- Full endpoint specifications, request payloads, response samples, and interactive "Try it out" testing with Bearer JWT token injection.

---

## 8. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Public / Guest | Distributor Member | ID Owner (`88767139`) | Platform Admin |
| :--- | :---: | :---: | :---: | :---: |
| Browse Wholesale Products (`GET /products`) | ✅ | ✅ | ✅ | ✅ |
| Submit Support Ticket (`POST /support`) | ✅ | ✅ | ✅ | ✅ |
| User Authentication (`POST /auth/login`) | ✅ | ✅ | ✅ | ✅ |
| View Personal Dashboard (`GET /distributors/profile`) | ❌ | ✅ | ✅ | ✅ |
| Enroll Downlines (`POST /enrollment/enroll`) | ❌ | ✅ | ✅ | ✅ |
| View Binary MLM Tree (`GET /tree/structure`) | ❌ | ✅ | ✅ | ✅ |
| View Personal Wallet & Withdraw (`/wallet/*`) | ❌ | ✅ | ✅ | ✅ |
| Add / Edit Products & Pricing (`POST/PUT /products`) | ❌ | ❌ | ✅ | ✅ |
| One-Click Bulk Delete Products (`POST /products/bulk-delete`) | ❌ | ❌ | ✅ | ✅ |
| Trigger Weekly Commission Calculations (`/admin/calculate-commissions`) | ❌ | ❌ | ❌ | ✅ |
| Settle Payout Batches (`/admin/settle-payouts`) | ❌ | ❌ | ❌ | ✅ |
| Inspect System Audit Logs (`/admin/audit-logs`) | ❌ | ❌ | ❌ | ✅ |

---

## 9. Recommended Implementation Order

To maintain 100% stability with zero regression on the existing frontend, the backend will be implemented in the following chronological phases:

1. **Phase 1: Foundation & Tooling**
   - Initialize Prisma schema (`prisma/schema.prisma`) with all 13 PostgreSQL models and relations.
   - Configure Prisma client singleton (`src/config/prisma.ts`).
   - Implement Argon2 hashing and verification utilities (`src/utils/security.ts`).
   - Implement Zod validation middleware (`src/middleware/validate.ts`) and schemas.
   - Configure Pino structured logger (`src/config/logger.ts`) and HTTP request logger middleware.
   - Configure Helmet, CORS, and Rate Limiters (`src/middleware/rateLimiter.ts`).
   - Configure OpenAPI / Swagger documentation (`src/config/swagger.ts`).

2. **Phase 2: Auth, Distributor & ID Owner Catalog**
   - Refactor `auth` module with Argon2 + Zod + Prisma.
   - Refactor `distributor` profile & business centers module with Prisma.
   - Upgrade `products` module with ID Owner (`88767139`) guard, Zod schemas, bulk delete, and Prisma.

3. **Phase 3: Binary MLM Engine & Orders**
   - Refactor `enrollment` module with sponsor auto-placement and Prisma.
   - Refactor `orders` module with wholesale cart checkout, volume calculation, and stock decrement.
   - Refactor `mlmTree` module with recursive binary visual node builder.
   - Refactor `bvEngine` with 100 PSV qualification checking and leg accumulation.

4. **Phase 4: Commission, Wallet, Payouts & Administration**
   - Refactor `commissionEngine` with 10% weaker-leg matching bonus, 5% TDS, and 5% admin charges.
   - Refactor `wallet` module with ledger audit and withdrawal requests.
   - Refactor `payouts` module with batch generation and UTR settlements.
   - Refactor `support` module (Screen E) with ticket generation and FAQ handling.
   - Refactor `training` and `notifications` modules.
   - Mount Swagger UI at `/api/docs` and verify with end-to-end integration tests.

5. **Phase 5: Seamless Frontend Connector Hookup**
   - Wire the frontend views (`Profile.jsx`, `ShopView.jsx`, `ProductManagerView.jsx`, `EnrollmentView.jsx`, `Contact.jsx`) to consume the REST API endpoints via lightweight API service helpers, maintaining local state fallbacks so the UI remains 100% responsive even if network requests are pending.

---

> [!NOTE]
> **Awaiting User Instruction**: This specification is complete and saved to `/docs/backend-analysis.md`. No implementation code has been written yet per instructions. Ready for your review and next command.
