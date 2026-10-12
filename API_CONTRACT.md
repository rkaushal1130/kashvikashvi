# KASHVI MLM — SYSTEM API CONTRACT SPECIFICATION

**Version:** 1.0.0  
**Status:** PRODUCTION READY  
**Protocol:** HTTPS / JSON  
**Base URL:** `/api` (or `/api/v1`)  

---

## 1. Global Standards & Conventions

### 1.1 Headers
| Header | Description | Required |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Required for POST, PUT, PATCH |
| `Accept` | `application/json` | Required for all requests |
| `Authorization` | `Bearer <accessToken>` | Required for authenticated endpoints |

### 1.2 Standard Success Response Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 1.3 Standard Error Response Format
```json
{
  "success": false,
  "message": "Human-readable description of error",
  "code": "ERROR_CODE_IDENTIFIER",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be greater than zero",
      "code": "too_small"
    }
  ]
}
```
*Note: Error responses are strictly sanitized. Server stack traces, raw SQL queries, and database connection strings are never exposed in production responses.*

---

## 2. Authentication & Session Endpoints (`/api/auth`)

### 2.1 User Login
- **Method:** `POST`
- **Route:** `/api/auth/login`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "distributor@example.com",
    "password": "Distributor@123",
    "rememberMe": true
  }
  ```
- **Responses:**
  - `200 OK`: Login successful.
    ```json
    {
      "success": true,
      "message": "Login successful",
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "data": {
        "user": {
          "id": "usr-1002",
          "email": "distributor@example.com",
          "role": "DISTRIBUTOR",
          "status": "ACTIVE",
          "distributorId": "KV-1002",
          "fullName": "Amit Patel"
        },
        "accessToken": "eyJhbGciOi..."
      }
    }
    ```
  - `401 Unauthorized`: Invalid credentials.

### 2.2 User Registration
- **Method:** `POST`
- **Route:** `/api/auth/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePassword@123",
    "phone": "+91 9876543210",
    "sponsorCode": "KV-1001",
    "placementPosition": "LEFT"
  }
  ```
- **Responses:**
  - `201 Created`: Account created. Returns token and user profile.
  - `400 / 422`: Validation error or duplicate email/sponsor.

### 2.3 Token Refresh
- **Method:** `POST`
- **Route:** `/api/auth/refresh`
- **Auth:** Refresh Cookie or Body Token
- **Request Body:** `{ "refreshToken": "eyJhbGci..." }`
- **Responses:**
  - `200 OK`: `{ "success": true, "accessToken": "eyJhbGci..." }`
  - `401 Unauthorized`: Expired or revoked token.

### 2.4 Logout
- **Method:** `POST`
- **Route:** `/api/auth/logout`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`: Session terminated, tokens invalidated.

---

## 3. Distributor Back-Office Endpoints (`/api/distributors`)

### 3.1 Get Current Distributor Profile
- **Method:** `GET`
- **Route:** `/api/distributors/me`
- **Auth:** Bearer Token (DISTRIBUTOR, ADMIN)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "distributorId": "KV-1002",
        "memberId": "KV-1002",
        "name": "Amit Patel",
        "email": "distributor@example.com",
        "phone": "+91 9876543210",
        "status": "ACTIVE",
        "currentRank": "Gold",
        "lifetimePV": 1500,
        "lifetimeGV": 45000,
        "sponsorId": "KV-1001"
      }
    }
    ```

### 3.2 Update Current Distributor Profile
- **Method:** `PATCH` / `PUT`
- **Route:** `/api/distributors/me`
- **Auth:** Bearer Token (DISTRIBUTOR, ADMIN)
- **Request Body:**
  ```json
  {
    "name": "Amit Patel Updated",
    "phone": "+91 9998887776"
  }
  ```
- **Responses:**
  - `200 OK`: Updated profile data.

### 3.3 Get Authenticated Business Volume Summary
- **Method:** `GET`
- **Route:** `/api/distributors/me/business-volume`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "personalBv": 1200,
        "leftTeamBv": 14500,
        "rightTeamBv": 11200,
        "totalVolume": 26900,
        "accumulatedBv": 52000,
        "carryForwardLeft": 3300,
        "carryForwardRight": 0
      }
    }
    ```

### 3.4 Get Authenticated Commissions
- **Method:** `GET`
- **Route:** `/api/distributors/me/commissions`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`: Array of commission payout ledger items.

### 3.5 Get Authenticated Binary Network
- **Method:** `GET`
- **Route:** `/api/distributors/me/network?depth=3`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`: Binary tree starting at authenticated member's node.

---

## 4. Binary MLM Tree Endpoints (`/api/tree`)

### 4.1 Get Binary Tree by Root ID
- **Method:** `GET`
- **Route:** `/api/tree/:distributorId?depth=3`
- **Auth:** Optional / Bearer Token (Enforces downline-only access for members)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "distributorId": "KV-1001",
        "name": "Rahul Kaushal",
        "position": "ROOT",
        "status": "ACTIVE",
        "rank": "Diamond",
        "left": {
          "distributorId": "KV-1002",
          "name": "Amit Patel",
          "position": "LEFT",
          "status": "ACTIVE"
        },
        "right": {
          "distributorId": "KV-1003",
          "name": "Rohit Sharma",
          "position": "RIGHT",
          "status": "ACTIVE"
        }
      }
    }
    ```
  - `403 Forbidden`: Lateral IDOR attempt to view non-downline tree.
  - `404 Not Found`: Distributor does not exist.

### 4.2 Get Direct Children
- **Method:** `GET`
- **Routes:** `/api/tree/children/:distributorId` or `/api/tree/:distributorId/children`
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "left": { ... }, "right": { ... } } }`
  - *(Empty positions return `null` explicitly).*

### 4.3 Place Distributor in Binary Tree
- **Method:** `POST`
- **Route:** `/api/v1/tree/place` or `/api/tree/place`
- **Auth:** Bearer Token (Admin or authorized sponsor)
- **Request Body:**
  ```json
  {
    "parentId": "KV-1002",
    "position": "LEFT",
    "distributorId": "KV-1005"
  }
  ```
- **Responses:**
  - `200 OK` / `201 Created`: Placement successful.
  - `400 Bad Request`:
    - Invalid position (not LEFT or RIGHT)
    - Self-parenting attempt
    - Target position already occupied
    - Proposed parent not in network

### 4.4 Move Distributor Node (Admin Reorganization)
- **Method:** `POST`
- **Route:** `/api/v1/tree/move` or `/api/tree/move`
- **Auth:** Bearer Token (ADMIN only)
- **Request Body:**
  ```json
  {
    "memberId": "KV-1004",
    "newParent": "KV-1003",
    "newPosition": "RIGHT",
    "reason": "Administrative realignment"
  }
  ```
- **Responses:**
  - `200 OK`: Tree node successfully relocated.
  - `400 Bad Request`: Circular relationship violation (ancestor under descendant).

---

## 5. Administrative Control Panel (`/api/admin`)

*All administrative endpoints require `Authorization: Bearer <accessToken>` with role `ADMIN` or `SUPER_ADMIN`. Normal distributors receive `403 Forbidden`.*

### 5.1 Executive Dashboard Metrics
- **Method:** `GET`
- **Route:** `/api/admin/dashboard`
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "totalDistributors": 1105,
        "activeDistributors": 1105,
        "totalUsers": 1420,
        "totalMembers": 1420,
        "totalSalesRevenue": 485000.0,
        "totalBusinessVolume": 320000.0,
        "totalCommission": 124500.0,
        "pendingPayouts": 8200.0,
        "systemHealth": "HEALTHY"
      }
    }
    ```

### 5.2 Distributor Directory
- **Method:** `GET`
- **Route:** `/api/admin/distributors?search=KV-1002&status=ACTIVE&position=LEFT&page=1&limit=20`
- **Responses:**
  - `200 OK`: Returns filtered array of distributors with pagination metadata.

### 5.3 Distributor Profile Lookup
- **Method:** `GET`
- **Route:** `/api/admin/distributors/:id`
- **Responses:**
  - `200 OK`: Full distributor record including `sponsorId`, `parentId`, and contact info.

### 5.4 Update Distributor Status
- **Method:** `PATCH`
- **Route:** `/api/admin/distributors/:id/status`
- **Request Body:** `{ "status": "SUSPENDED" }` or `{ "status": "ACTIVE" }`
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "distributorId": "KV-1002", "status": "SUSPENDED" } }`

### 5.5 Update Distributor Details
- **Method:** `PATCH` / `PUT`
- **Route:** `/api/admin/distributors/:id`
- **Request Body:** `{ "phone": "+91 9887766554" }`
- **Responses:**
  - `200 OK`: Updated distributor record.

### 5.6 View Network by Admin
- **Method:** `GET`
- **Route:** `/api/admin/network/:distributorId?depth=3`
- **Responses:**
  - `200 OK`: Complete binary tree for any requested distributor.

### 5.7 System Business Volume Overview
- **Method:** `GET`
- **Route:** `/api/admin/business-volume`
- **Responses:**
  - `200 OK`: System BV turnover summary and volume ledger entries.

### 5.8 Manual Business Volume Adjustment
- **Method:** `POST`
- **Route:** `/api/admin/business-volume/adjust`
- **Request Body:**
  ```json
  {
    "distributorId": "KV-1002",
    "leg": "LEFT",
    "amount": 500,
    "reason": "Administrative test volume adjustment"
  }
  ```
- **Responses:**
  - `200 OK`: Volume adjustment recorded in audit ledger.
  - `400 Bad Request`: Missing mandatory `reason`.

### 5.9 Trigger Weekly Commission Calculation Cycle
- **Method:** `POST`
- **Route:** `/api/admin/calculate-commissions`
- **Request Body:** `{ "cycleWeek": 38, "cycleYear": 2026 }`
- **Responses:**
  - `200 OK`: Commission calculation cycle processed.

### 5.10 Approve Commissions Batch
- **Method:** `POST`
- **Route:** `/api/admin/commissions/approve`
- **Request Body:** `{ "status": "ALL_PENDING" }`
- **Responses:**
  - `200 OK`: Pending commissions transitioned to approved for payout.

### 5.11 Settle Payouts
- **Method:** `POST`
- **Route:** `/api/admin/settle-payouts`
- **Request Body:** `{ "batchCode": "BATCH-2026-W38" }`
- **Responses:**
  - `200 OK`: Approved payouts settled and cleared from liabilities.

### 5.12 Reverse Commission
- **Method:** `POST`
- **Routes:** `/api/admin/commissions/reverse` or `/api/admin/commissions/:id/reverse`
- **Request Body:**
  ```json
  {
    "commissionId": "COMM-9812",
    "distributorId": "KV-1001",
    "reason": "Administrative reversal for returned order"
  }
  ```
- **Responses:**
  - `200 OK`: Reversal entry posted with compensatory debit ledger.
  - `400 Bad Request`: Reversal reason is mandatory.

### 5.13 System Settings
- **Method:** `GET` / `PUT`
- **Route:** `/api/admin/settings`
- **Request Body (PUT):**
  ```json
  {
    "binaryMatchPercentage": 10,
    "directSponsorPercentage": 5,
    "cappingLimit": 100000,
    "tdsRate": 5,
    "adminFeeRate": 5
  }
  ```
- **Responses:**
  - `200 OK`: Configuration updated and persisted.

### 5.14 Audit Logs (Immutable)
- **Method:** `GET` / `DELETE`
- **Route:** `/api/admin/audit-logs`
- **Responses:**
  - `GET`: `200 OK` with pagination and entity filters.
  - `DELETE`: `403 Forbidden` *(Audit logs are strictly immutable and cannot be deleted or truncated).*

---

## 6. Corporate Admin Funding Portal & Treasury (`/api/admin/funding` & `/api/admin/treasury`)

### 6.1 Treasury Overview Dashboard
- **Method:** `GET`
- **Route:** `/api/admin/funding/dashboard`
- **Auth:** Bearer Token (ADMIN only)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "treasuryBalance": 250000.0,
        "pendingFundingAmount": 15000.0,
        "totalSuccessfullyFunded": 500000.0,
        "totalPayoutsSettled": 235000.0,
        "connectedBank": {
          "status": "CONNECTED",
          "provider": "HDFC Corporate Banking / RazorpayX",
          "maskedAccount": "••••••••4829",
          "accountHolder": "Kashvi MLM Corporate Treasury",
          "connectedAt": "2026-09-15T10:30:00Z"
        }
      }
    }
    ```

### 6.2 Connect Bank Account
- **Method:** `POST`
- **Route:** `/api/admin/funding/bank/connect`
- **Auth:** Bearer Token (ADMIN only)
- **Request Body:** `{ "provider": "RAZORPAYX", "accountNumber": "001234567890", "ifsc": "HDFC0001234" }`
- **Responses:**
  - `200 OK`: Provider verified; connection established with masked details.

### 6.3 Disconnect Bank Account
- **Method:** `POST`
- **Route:** `/api/admin/funding/bank/disconnect`
- **Auth:** Bearer Token (ADMIN only)
- **Responses:**
  - `200 OK`: Account disconnected.

### 6.4 Initiate Funding Transaction
- **Method:** `POST`
- **Route:** `/api/admin/funding/initiate`
- **Auth:** Bearer Token (ADMIN only)
- **Request Body:**
  ```json
  {
    "amount": 50000.0,
    "currency": "INR",
    "fundingAccountId": "acc-hdfc-01",
    "description": "Quarterly operational treasury liquidity replenishment"
  }
  ```
- **Responses:**
  - `201 Created`: Transaction created in `PENDING` status.
    ```json
    {
      "success": true,
      "data": {
        "transactionId": "TXN-FUND-98214",
        "amount": 50000.0,
        "currency": "INR",
        "status": "PENDING",
        "providerReference": "PGW-REQ-109283",
        "initiatedAt": "2026-10-12T12:00:00Z"
      }
    }
    ```
  - `400 / 422`: Validation error (amount <= 0 or invalid currency).

### 6.5 Reconcile Funding Transaction
- **Method:** `POST`
- **Route:** `/api/admin/funding/reconcile/:transactionId`
- **Auth:** Bearer Token (ADMIN only)
- **Request Body:** `{ "providerStatus": "SETTLED" }`
- **Responses:**
  - `200 OK`: Transaction transitions to `SUCCEEDED` and increments Available Treasury Balance.

### 6.6 List Funding Transactions
- **Method:** `GET`
- **Route:** `/api/admin/funding/transactions?search=TXN&status=SUCCEEDED&page=1&limit=20`
- **Auth:** Bearer Token (ADMIN only)
- **Responses:**
  - `200 OK`: Paginated transactions with audit timeline and provider references.

### 6.7 Treasury Ledger
- **Method:** `GET`
- **Route:** `/api/admin/treasury/transactions`
- **Auth:** Bearer Token (ADMIN only)
- **Responses:**
  - `200 OK`: Double-entry corporate treasury movements.
