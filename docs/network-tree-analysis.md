# KashviMLM — Binary MLM Network Tree Comprehensive Architectural Analysis

> **Document:** `docs/network-tree-analysis.md`  
> **Status:** Completed Phase 1 Analysis (Inspection Only — No Code or UI Modifications)  
> **Target Scope:** Enterprise-grade Binary MLM Network Tree System  

---

## 1. Executive Summary & Core Architectural Principle

In binary network marketing systems, the distinction between referral sponsorship and network tree placement is the central structural invariant of the entire business model. Conflating the two results in irreversible genealogy corruption and flawed commission calculations.

### The Fundamental Binary MLM Distinction:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SPONSOR vs PLACEMENT PARENT                           │
└─────────────────────────────────────────────────────────────────────────────┘

      SPONSOR (Unilevel Referral)              PLACEMENT PARENT (Binary Upline)
────────────────────────────────────────   ────────────────────────────────────────
• "Who referred me to the business?"       • "Where am I placed in the binary tree?"
• Unilevel relationship (1-to-many).       • Binary tree relationship (strictly 1-to-2:
• Dictates direct referral bonuses,          LEFT or RIGHT).
  matching bonuses, and leadership pools.  • Dictates dual-leg Commission Volume
• Never changes throughout member life.      Points (CVP), group volume, and spillover.
```

### Maximum 2 Children Rule:
Every distributor in the binary MLM structure can have **at most two direct downline positions**:
1. `LEFT`
2. `RIGHT`

When Distributor $A$ (e.g. Rahul, `KV-1001`) refers a 3rd member after both their direct `LEFT` (Amit) and `RIGHT` (Rohit) slots are occupied, the 3rd member **cannot** be placed directly under $A$. They must be placed under an available slot further down the tree (e.g., under Amit on the `LEFT` as **spillover**).
* **Sponsor:** $A$ (Rahul)
* **Placement Parent:** $B$ (Amit)
* **Placement Position:** `LEFT`

---

## 2. In-Depth Project Audit (16 Core Inspection Points)

### 2.1 Frontend Framework
* **Library & Runtime:** React 19.2.8 with Vite 8.2.2.
* **Routing:** `react-router-dom` v7.18.3 (`BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useSearchParams`).
* **Icons:** `lucide-react` v1.43.0.
* **Styling Architecture:** Scoped vanilla CSS sheets using BEM-like conventions.
* **Build Tooling:** Vite fast build with ES modules and HMR.

### 2.2 Backend Framework
* **Runtime & Framework:** Node.js v24+ with Express 4.19.2 written in TypeScript (`tsc`).
* **Architecture:** Layered Service-Repository architecture (`routes` &rarr; `validators` &rarr; `controllers` &rarr; `services` &rarr; `database`).
* **Security & Performance Middlewares:** `helmet`, `cors`, `morgan`, `express-rate-limit`, `zod` request body validation.

### 2.3 Database Technology
* **Engine:** PostgreSQL (configured for standard port `5432`).
* **DDL Definition:** Located in [`server/src/database/schema.sql`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/server/src/database/schema.sql).
* **Binary Tree Integrity Constraints:**
  ```sql
  CONSTRAINT uq_binary_placement UNIQUE (placement_parent_id, placement_position)
  ```
* **Audit Immutability Triggers:** PostgreSQL trigger `prevent_audit_log_tampering()` prevents `UPDATE` or `DELETE` on the `audit_logs` table.

### 2.4 ORM (Object-Relational Mapping)
* **ORM:** Prisma ORM v5.12.1 (`@prisma/client`).
* **Schema Files:**
  - Primary: [`server/prisma/schema.prisma`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/server/prisma/schema.prisma)
  - Backend: [`backend/prisma/schema.prisma`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/prisma/schema.prisma)
* **Core Models:** `User`, `DistributorProfile`, `MLMNode`, `BusinessCenter`, `AuditLog`, `Order`, `Product`, `Wallet`, `CommissionRecord`.

### 2.5 Authentication
* **Token Mechanism:** Stateless JSON Web Tokens (`jsonwebtoken`, HMAC SHA-256) with Bearer token authentication.
* **Password Hashing:** `bcryptjs` (salt rounds: 10).
* **Client Auth Storage:** Persisted in `localStorage` under key `kashvi_auth` with structure:
  ```json
  {
    "isLoggedIn": true,
    "user": {
      "memberId": "KV-1001",
      "name": "Rahul Kaushal",
      "role": "ADMIN",
      "username": "@rahul_kaushal",
      "email": "rahul.kaushal@kashvimlm.com"
    }
  }
  ```
* **Backend Guard:** [`backend/src/middleware/auth.ts`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/src/middleware/auth.ts) validates JWT signatures and injects `req.user`.

### 2.6 Existing User / Member Model
* **Database Entity:** `User`
* **Attributes:** `id` (UUID), `email`, `passwordHash`, `role` (`CUSTOMER`, `DISTRIBUTOR`, `ADMIN`, `SUPER_ADMIN`), `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`), `createdAt`, `updatedAt`.
* **Relations:** 1-to-1 with `DistributorProfile` or `CustomerProfile`.

### 2.7 Existing Distributor Model
* **Database Entity:** `DistributorProfile`
* **Attributes:**
  - `id` (UUID)
  - `userId` (FK to User)
  - `distributorCode` (Unique human ID, e.g. `KV-1001`)
  - `sponsorId` (FK to Sponsor's `DistributorProfile.id` — unilevel referral hierarchy)
  - `firstName`, `lastName`, `displayName`
  - `rank` (`ASSOCIATE`, `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`, `CROWN_AMBASSADOR`)
  - `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`)
  - `kycVerified` (Boolean)
* **Self-Referential Relation:**
  ```prisma
  sponsor   DistributorProfile?  @relation("DistributorSponsorship", fields: [sponsorId], references: [id])
  sponsored DistributorProfile[] @relation("DistributorSponsorship")
  ```

### 2.8 Existing Enrollment System
* **Frontend Portal:** [`src/components/dashboard/EnrollmentView.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/dashboard/EnrollmentView.jsx) and public join route [`src/pages/Join.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/Join.jsx).
* **5-Step Enrollment Flow:**
  1. **Personal Information:** Full Name, DOB, Gender, Email, Phone, PAN.
  2. **Address & Residence:** Street Address, City, State, Pincode, Country.
  3. **Placement & Sponsorship:** Sponsor ID validation (`GET /api/v1/sponsors/:id`), leg availability check (`LEFT` vs `RIGHT`).
  4. **Starter Pack Selection:** Basic Pack (50 BV), Professional Kit (100 BV), Elite Kit (200 BV).
  5. **Bank Verification & Password:** Bank Name, Account Number, IFSC Code, Account Password.
* **Backend Processing:**
  - Validates sponsor status.
  - Verifies placement parent availability.
  - Ensures chosen position (`LEFT` or `RIGHT`) is unoccupied.
  - Executes placement atomically inside a database transaction.

### 2.9 Existing Sponsor ID Logic
* **Validation Service:** [`backend/src/services/sponsor.service.ts`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/src/services/sponsor.service.ts).
* **API Endpoint:** `GET /api/v1/sponsors/:sponsorId`.
* **Rules Enforced:**
  - Sponsor must exist in the database.
  - Sponsor must have status `ACTIVE`.
  - Self-sponsorship is rejected (`SPONSOR_SELF_NOT_ALLOWED`).
  - Returns open placement legs (`availablePositions`: `['LEFT', 'RIGHT']`, `['LEFT']`, `['RIGHT']`, or `[]`).

### 2.10 Existing Product System
* **Wholesale Catalog Categories:**
  - Clothes & Hosiery (Hozri T-Shirts, Hoodies, Innerwear).
  - Electronics & Smart Devices (Headphones, Chargers, Appliances).
* **Dual Point Metrics:** Every product stores `price` (INR) and `bv` (Business Volume / Commission Volume points).
* **Local Persistence:** Synced to `localStorage` under `kashvi_product_catalog` with custom window event `kashvi_catalog_update`.
* **Manager View:** [`src/components/dashboard/ProductManagerView.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/dashboard/ProductManagerView.jsx).

### 2.11 Existing Admin System
* **Admin Roles:** `ADMIN` and `SUPER_ADMIN`.
* **Admin Routes:** [`backend/src/routes/admin.routes.ts`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/backend/src/routes/admin.routes.ts).
* **Privileged Capabilities:**
  - View global network genealogy without downline boundary restrictions.
  - Move distributor with strict 7-parameter validation:
    `{ reason, oldParent, oldPosition, newParent, newPosition, adminId, timestamp }`.
  - Inspect immutable audit trail (`GET /api/v1/admin/audit-logs`).
* **Security Enforcement:** Non-admin users receive HTTP `403 Forbidden` (`ADMIN_FORBIDDEN`).

### 2.12 Existing Routing
* **Router Definition:** [`src/App.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/App.jsx)
  - `/` &rarr; `Home` (Public landing page)
  - `/contact` &rarr; `Contact`
  - `/profile` & `/dashboard` &rarr; `Profile` (Authenticated portal)
  - `/network-tree` &rarr; `NetworkTreePage` (Standalone binary genealogy)
  - `/admin/network-tree` &rarr; `AdminNetworkTreePage` (Admin tree inspection)
  - `/join` &rarr; `Join` (Referral onboarding with `?ref=KV-XXXX`)

### 2.13 Existing Sidebar Navigation
* **Component:** [`src/components/dashboard/DistributorDashboard.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/dashboard/DistributorDashboard.jsx)
* **Rail Buttons:**
  1. **Dashboard** (`BarChart3` icon) &rarr; Active role: `dashboard`
  2. **Enrollment** (`UserPlus` icon) &rarr; Active role: `enroll`
  3. **Shop** (`ShoppingCart` icon) &rarr; Active role: `shop`
  4. **Product Management** (`PackagePlus` icon) &rarr; Active role: `manage_products`
  5. **Network Tree** (`Network` icon) &rarr; Active role: `network_tree`

### 2.14 Existing API Structure
* **Central Frontend Client:** [`src/services/api.js`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/services/api.js).
* **Backend Express Routers:**
  - `/api/v1/auth/*`
  - `/api/v1/distributor/*`
  - `/api/v1/enrollment/*`
  - `/api/v1/tree/*`
  - `/api/v1/sponsors/*`
  - `/api/v1/admin/*`
* **Offline Resilience:** All frontend API calls feature graceful fallback structures ensuring continuous development without crashing when database connections are pending.

### 2.15 Existing State Management
* **Component-Level:** React state hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
* **Session Persistence:** `localStorage` for authentication tokens, catalog data, and cached downlines.
* **Inter-Component Event Bus:** DOM custom events (`kashvi_auth_change`, `kashvi_catalog_update`).

### 2.16 Existing Mock / Static Data & Canonical Tree
* **Canonical 3-Tier Binary Hierarchy:**
  ```
                            RAHUL KAUSHAL
                               KV-1001
                              /       \
                           LEFT       RIGHT
                            /           \
                         AMIT          ROHIT
                       KV-1002        KV-1003
                       /    \          /    \
                    NEHA   POOJA     KARAN  ANKIT
                   KV-1006 KV-1007   KV-1008 KV-1009
  ```

---

## 3. Required Database Changes & Model Design

To maintain strict binary tree integrity in PostgreSQL, the following entity relationships must be preserved:

```sql
-- MLM Binary Tree Node Table
CREATE TABLE mlm_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL UNIQUE REFERENCES distributor_profiles(id) ON DELETE RESTRICT,
    placement_parent_id UUID REFERENCES mlm_nodes(id) ON DELETE RESTRICT,
    placement_position VARCHAR(10) CHECK (placement_position IN ('LEFT', 'RIGHT')),
    depth INTEGER NOT NULL DEFAULT 0,
    tree_path VARCHAR(2048) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parent_position UNIQUE (placement_parent_id, placement_position)
);
```

### Critical Database Constraints:
1. `UNIQUE (placement_parent_id, placement_position)`: Guarantees at the database level that no placement parent can ever have more than one `LEFT` child and one `RIGHT` child.
2. `CHECK (placement_position IN ('LEFT', 'RIGHT'))`: Restricts positions strictly to binary legs.
3. `tree_path`: Materialized ancestry path (`/KV-1001/KV-1002/KV-1006`) enabling instant ancestor and subtree queries without recursive stack overflows.

---

## 4. Required Backend Services & APIs

| Module / Service | Responsibilities | Key API Endpoints |
| :--- | :--- | :--- |
| **`TreePlacementService`** | Atomic placement, circular placement detection (`isBinaryAncestor`), max 2 children enforcement, concurrent placement race-condition locks. | `POST /api/v1/tree/place` |
| **`NetworkTreeService`** | Recursive BFS tree compilation, depth bounding (levels 2–5), downline security scoping, volume point aggregation. | `GET /api/v1/tree/genealogy/:id`<br>`GET /api/v1/tree/summary/:id` |
| **`SponsorService`** | Sponsor existence verification, active status check, open binary leg discovery. | `GET /api/v1/sponsors/:id` |
| **`AuditService`** | Append-only logging for 6 key tree events (`SPONSOR_ASSIGNED`, `DISTRIBUTOR_CREATED`, `TREE_MEMBER_PLACED`, `TREE_MEMBER_MOVED`, `TREE_MEMBER_REMOVED`, `TREE_POSITION_CHANGED`). | `GET /api/v1/admin/audit-logs`<br>`POST /api/v1/tree/move` |

---

## 5. Required Frontend Components & Architecture

* **[`NetworkTreePage.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/NetworkTreePage.jsx)**: Dedicated tree page featuring zoom, pan, real-time member search, breadcrumb lineage navigation, lazy loading, and audit log modals.
* **[`NetworkTree.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/NetworkTree.jsx)**: Controlled SVG/CSS canvas rendering the recursive binary tree.
* **[`TreeNode.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/TreeNode.jsx)**: Node card displaying Name, ID, Rank, Status, Left/Right BV metrics, and "+ Available" slots.
* **[`MemberDetailsPanel.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/MemberDetailsPanel.jsx)**: Slide-out drawer with 11 sanitized distributor metrics, "View Network" (re-rooting), and admin action triggers.
* **[`MemberHoverCard.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/MemberHoverCard.jsx)**: Floating tooltip card displaying quick member summaries on hover.
* **[`TreeControls.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/TreeControls.jsx)**: Top canvas toolbar with icon-only Zoom In/Out, Center, Reset, Expand, Collapse, and Refresh buttons.
* **[`TreeSearch.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/components/networkTree/TreeSearch.jsx)**: Debounced search component highlighting matching distributors.

---

## 6. Potential Architectural Conflicts & Mitigations

1. **Sponsor Conflation Risk:**
   - *Conflict:* Developers frequently assign `placementParentId = sponsorId` by default.
   - *Mitigation:* Explicit separation of `sponsorId` and `placementParentId` across all schemas, APIs, and UI forms.
2. **Race Conditions on Simultaneous Placements:**
   - *Conflict:* Two applicants registering concurrently choosing `LEFT` under the same parent.
   - *Mitigation:* Database-level unique constraint `(placement_parent_id, placement_position)` and PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
3. **Circular Placement Recursion:**
   - *Conflict:* Moving an upline leader under one of their own downline members creates an infinite loop.
   - *Mitigation:* `isBinaryAncestor()` validation before executing any placement or move operation.
4. **Data Leakage in Public Genealogy:**
   - *Conflict:* Leaking sensitive distributor attributes (passwords, bank details, PAN numbers).
   - *Mitigation:* Strict sanitization layer in `NetworkTreeService` returning only public fields (`displayName`, `distributorCode`, `rank`, `status`, `volumes`).

---

## 7. Recommended Implementation Order

1. **Database Schema & Constraints**: Verify unique binary index and audit triggers.
2. **Sponsor Validation Service**: Verify `GET /api/v1/sponsors/:id` and leg availability.
3. **Binary Placement Service**: Enforce max 2 children and circular protection.
4. **Enrollment Integration**: Connect 5-step enrollment to atomic binary placement.
5. **Genealogy Tree API**: Implement recursive BFS retrieval with depth bounding.
6. **Sidebar Navigation**: Ensure seamless routing between Dashboard, Enrollment, Shop, Products, and Network Tree.
7. **Tree Visualization & UI**: Maintain pure CSS connecting lines, icon-only zoom, and node details drawer.
8. **Security & Authorization**: Guarantee regular distributors cannot inspect unauthorized uplines or access admin endpoints.
9. **Audit Logging & Verification**: Confirm all 16 prompt tests pass green.

---

> [!NOTE]
> **Status:** Analysis is complete. No application or UI code was modified during this audit. Awaiting approval or next prompt instruction to proceed.
