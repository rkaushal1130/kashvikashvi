# KashviMLM Enterprise REST API Backend

A production-grade, modular Node.js, Express, and TypeScript backend for the **KashviMLM** dual-leg binary multi-level marketing platform.

---

## 🏛️ System Architecture

```
Frontend
React / Next.js
       │
       ▼
REST API
Node.js + Express + TypeScript
       │
       ├── Authentication
       ├── Distributor Management
       ├── Enrollment
       ├── Products
       ├── Orders
       ├── MLM Tree
       ├── BV Engine
       ├── Commission Engine
       ├── Wallet
       ├── Payouts
       ├── Training
       ├── Support
       ├── Notifications
       └── Admin
       │
       ▼
PostgreSQL
       │
       ├── Users
       ├── Distributors
       ├── Products
       ├── Orders
       ├── MLM Tree
       ├── BV Ledger
       ├── Commission Ledger
       ├── Wallet
       └── Audit Logs
```

---

## 📁 Directory Structure

```
server/
├── .env.example                       # Environment configuration template
├── package.json                       # Backend dependencies and scripts
├── tsconfig.json                      # ES2022 NodeNext TypeScript configuration
├── README.md                          # Backend architecture & API documentation
└── src/
    ├── app.ts                         # Express app assembly & middleware setup
    ├── server.ts                      # Server bootstrap, DB check & port listener
    ├── config/
    │   ├── db.ts                      # PostgreSQL pool with error resilient fallback
    │   └── env.ts                     # Strongly typed environment configuration
    ├── database/
    │   ├── schema.sql                 # 13 PostgreSQL tables, indexes & constraints
    │   └── seed.sql                   # Initial seed data (ID Owner 88767139, products, wallet)
    ├── middleware/
    │   ├── auth.ts                    # JWT token authentication & role guards
    │   └── errorHandler.ts            # Centralized API error response handler
    └── modules/                       # 14 Modular feature packages
        ├── auth/                      # Login, registration, token verification
        ├── distributor/               # Profile, sponsor downlines, KYC
        ├── enrollment/                # Registration placement under sponsor & BC
        ├── products/                  # Wholesale catalog, MRP, BV & ID Owner pricing
        ├── orders/                    # Order checkout, BV volume attribution & tracking
        ├── mlmTree/                   # Binary tree topology, left/right placement
        ├── bvEngine/                  # Personal/Leg volume accumulation & carryover
        ├── commissionEngine/          # Weekly matching bonus (10%), TDS & admin fees
        ├── wallet/                    # Distributor wallet balances & ledger movements
        ├── payouts/                   # Weekly settlement batching, NEFT/RTGS payouts
        ├── training/                  # Training modules & progress certification
        ├── support/                   # Help desk tickets, inquiries & resolutions
        ├── notifications/             # Member notifications & alerts
        └── admin/                     # System analytics, manual calculation & audit logs
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your PostgreSQL credentials:
```bash
cp .env.example .env
```

### 3. Initialize PostgreSQL Database
Execute the schema DDL and initial seed data:
```bash
psql -U postgres -d kashvimlm -f src/database/schema.sql
psql -U postgres -d kashvimlm -f src/database/seed.sql
```

### 4. Run Development Server
```bash
npm run dev
```
The REST API server will start at `http://localhost:5000`.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 📡 REST API Module Reference

All endpoints are prefixed with `/api/v1`.

### 1. Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user + distributor account |
| `POST` | `/api/v1/auth/login` | Distributor/Admin login; returns JWT token |
| `GET` | `/api/v1/auth/me` | Retrieve profile of authenticated user |

### 2. Distributor Management (`/api/v1/distributors`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/distributors/profile/:memberId` | Retrieve distributor details, rank, PSV & team size |
| `PUT` | `/api/v1/distributors/profile/:memberId` | Update profile, address, or banking information |
| `GET` | `/api/v1/distributors/:memberId/downlines` | List direct downline partners sponsored by member |

### 3. Enrollment (`/api/v1/enrollment`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/enrollment/enroll` | Enroll a new distributor with sponsor validation & auto-placement |
| `GET` | `/api/v1/enrollment/validate-sponsor/:sponsorId` | Check validity and placement capacity of sponsor ID |

### 4. Products Catalog (`/api/v1/products`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Retrieve active wholesale product catalog |
| `GET` | `/api/v1/products/:id` | Get single product detail |
| `POST` | `/api/v1/products` | Create product (Restricted to ID Owner `88767139` / Admin) |
| `PUT` | `/api/v1/products/:id` | Update product price/BV (ID Owner / Admin only) |
| `DELETE` | `/api/v1/products/:id` | Delete product item (ID Owner / Admin only) |

### 5. Orders (`/api/v1/orders`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/orders` | List order history for member |
| `GET` | `/api/v1/orders/:orderNumber` | Get specific order invoice & shipping status |
| `POST` | `/api/v1/orders/checkout` | Create order, deduct stock, and credit BV to legs |

### 6. MLM Binary Tree (`/api/v1/tree`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/tree/node/:memberId` | Get binary tree hierarchy (Left/Right nodes & volumes) |
| `GET` | `/api/v1/tree/stats/:memberId` | Get network summary (total members, active branches) |

### 7. BV Engine (`/api/v1/bv`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/bv/summary/:memberId` | Current cycle volume (Left Leg, Right Leg, Carryover) |
| `GET` | `/api/v1/bv/ledger/:memberId` | Audit ledger of all BV transactions |
| `POST` | `/api/v1/bv/record` | Credit BV from downline orders into binary tree |

### 8. Commission Engine (`/api/v1/commissions`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/commissions/history/:memberId` | Weekly matching bonus statements, TDS & Net payout |
| `POST` | `/api/v1/commissions/calculate-cycle` | Execute weekly 10% weaker-leg matching bonus batch |

### 9. Wallet (`/api/v1/wallet`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/wallet/balance/:memberId` | Available, pending balance & lifetime earnings |
| `GET` | `/api/v1/wallet/transactions/:memberId` | Wallet statement & transaction history |
| `POST` | `/api/v1/wallet/withdraw` | Request bank withdrawal from e-Wallet |

### 10. Payouts (`/api/v1/payouts`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/payouts/member/:memberId` | Bank transfer payout records & UTR reference numbers |
| `POST` | `/api/v1/payouts/create-batch` | Create weekly payout batch from calculated commissions |
| `POST` | `/api/v1/payouts/settle-batch` | Settle batch and mark bank transfers complete |

### 11. Training (`/api/v1/training`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/training/modules` | List distributor training modules & completion status |
| `POST` | `/api/v1/training/complete` | Mark a training module as completed |

### 12. Support (`/api/v1/support`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/support` | List support tickets for user |
| `POST` | `/api/v1/support` | Submit a new help desk support ticket |
| `PATCH` | `/api/v1/support/:ticketId/status` | Update ticket status or add admin resolution |

### 13. Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Unread count & notification feed |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark single notification as read |
| `POST` | `/api/v1/notifications/read-all` | Mark all notifications as read |

### 14. Admin (`/api/v1/admin`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/metrics` | System overview (total members, sales, BV turnover, pool) |
| `GET` | `/api/v1/admin/audit-logs` | Comprehensive security & financial event audit trail |
| `POST` | `/api/v1/admin/calculate-commissions` | Trigger commission calculation cycle |
| `POST` | `/api/v1/admin/settle-payouts` | Approve & disburse pending weekly bank payout batch |
| `PATCH` | `/api/v1/admin/distributors/:memberId/status` | Activate/Deactivate distributor account |

---

## 🛡️ Security & Resilience
- **Password Hashing**: `bcryptjs` with salt factor 10.
- **Stateless Authentication**: Signed JSON Web Tokens (`jsonwebtoken`).
- **Input Sanitization**: Parameterized queries through `pg.Pool` avoiding SQL injection.
- **Failover Mode**: Resilient in-memory fallback handlers allow developers to run, test, and preview API interactions even when a live PostgreSQL instance is not yet connected.
- **Role-Based Access Control**: ID Owner (`88767139`) and `admin` guards on catalog editing, price changes, and payout settlements.
