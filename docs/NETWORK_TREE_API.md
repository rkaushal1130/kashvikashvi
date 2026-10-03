# KashviMLM — Binary MLM Network Tree REST API Specification

## 1. Overview
The Binary MLM Network Tree module provides high-performance, strictly validated, and secure REST endpoints to traverse, search, inspect, and manage binary network hierarchies. Placements strictly enforce a maximum of 1 LEFT child and 1 RIGHT child per parent node, preventing self-parenting, circular placement cycles, and concurrent slot over-allocation.

All responses adhere to standardized JSON formats with security hardening against sensitive data leakage (passwords, tokens, bank details, and internal secrets are scrubbed).

---

## 2. Authentication & Authorization Model

| Level | Middleware / Mechanism | Description |
| :--- | :--- | :--- |
| **Public / Guest** | Open (Rate Limited) | Read-only public statistics or referral discovery |
| **Authenticated Distributor** | `authenticateToken` | Access to distributor's own node, direct downline, and referral link |
| **Network Ownership Check** | `canAccessDistributorNetwork` | Prevents IDOR. A distributor can only view their own downline; lateral or upward traversal is rejected with `403 Forbidden` |
| **Admin Only** | `requireAdmin` | Full topological inspection, manual repositioning (`/move`), audit log retrieval, and root resets |

---

## 3. Endpoints

### 3.1 Get Current Distributor's Binary Tree
Retrieves the binary tree structure for the currently authenticated distributor based strictly on JWT credentials.

- **Method**: `GET`
- **Route**: `/api/distributors/me/network` (also available via `/api/tree`)
- **Authentication**: Required (`Bearer <JWT>`)
- **Query Parameters**:
  - `depth` *(optional, integer, default: 3, max: 10)*: Tree traversal depth
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "distributorId": "KV-1001",
    "name": "Rahul Kaushal",
    "position": "ROOT",
    "rank": "Executive Director",
    "status": "ACTIVE",
    "level": 0,
    "personalBv": 5000,
    "leftTeamBv": 25000,
    "rightTeamBv": 20000,
    "left": {
      "distributorId": "KV-1002",
      "name": "Amit Sharma",
      "position": "LEFT",
      "level": 1,
      "left": null,
      "right": null
    },
    "right": {
      "distributorId": "KV-1003",
      "name": "Rohit Verma",
      "position": "RIGHT",
      "level": 1,
      "left": null,
      "right": null
    }
  }
}
```
- **Error Codes**:
  - `401 Unauthorized`: Missing, invalid, or expired JWT.

---

### 3.2 Get Complete Binary Tree by Distributor ID
Traverses the binary hierarchy rooted at `:distributorId`.

- **Method**: `GET`
- **Route**: `/api/tree/:distributorId`
- **Authentication**: Optional for public roots, enforced with ownership check for downline members.
- **Path Parameters**:
  - `distributorId` *(required, string)*: Target distributor ID (e.g. `KV-1001`)
- **Query Parameters**:
  - `depth` *(optional, integer, default: 5, max: 10)*: Number of binary tree levels to return
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "distributorId": "KV-1001",
    "name": "Rahul Kaushal",
    "position": "ROOT",
    "rank": "Executive Director",
    "status": "ACTIVE",
    "level": 0,
    "left": { ... },
    "right": { ... },
    "root": { ... }
  },
  "message": "Tree retrieved successfully"
}
```
- **Error Codes**:
  - `400 Bad Request`: Invalid or malformed distributor ID.
  - `403 Forbidden`: Authenticated user is not an admin and `:distributorId` is not in their downline.
  - `404 Not Found`: Distributor does not exist in system.

---

### 3.3 Get Direct Children (LEFT & RIGHT)
Fetches immediate binary children of a distributor.

- **Method**: `GET`
- **Route**: `/api/tree/:distributorId/children`
- **Path Parameters**:
  - `distributorId` *(required, string)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "left": {
      "distributorId": "KV-1002",
      "name": "Amit Sharma",
      "position": "LEFT",
      "rank": "Associate",
      "status": "ACTIVE"
    },
    "right": {
      "distributorId": "KV-1003",
      "name": "Rohit Verma",
      "position": "RIGHT",
      "rank": "Associate",
      "status": "ACTIVE"
    }
  },
  "message": "Direct children retrieved successfully"
}
```

---

### 3.4 Get Complete Downline
Fetches a flattened, paginated list of all distributors underneath `:distributorId`.

- **Method**: `GET`
- **Route**: `/api/tree/:distributorId/downline`
- **Query Parameters**:
  - `page` *(optional, integer, default: 1)*
  - `limit` *(optional, integer, default: 20)*
  - `depth` *(optional, integer, default: 10)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "distributors": [ ... ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 3.5 Get Subtree Teams (LEFT or RIGHT)
- **Routes**:
  - `GET /api/tree/:distributorId/left`
  - `GET /api/tree/:distributorId/right`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "team": "LEFT",
    "members": [ ... ],
    "totalCount": 21,
    "totalBv": 25000
  }
}
```

---

### 3.6 Downline Member Search
Enables searching within a distributor's network by ID, name, email, or phone. Strictly isolates results to the distributor's sub-tree to prevent horizontal information disclosure.

- **Method**: `GET`
- **Route**: `/api/v1/network-tree/search` or `/api/tree/:distributorId/search`
- **Query Parameters**:
  - `query` *(required, string)*: Search keyword
  - `distributorId` *(optional, string)*: Target root subtree (defaults to current user)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "total": 1,
    "data": [
      {
        "distributorId": "KV-1004",
        "name": "Priya Singh",
        "position": "LEFT",
        "level": 2,
        "status": "ACTIVE"
      }
    ]
  }
}
```

---

### 3.7 Admin: Place Member in Binary Tree
Enforces strict binary slot availability and concurrency controls.

- **Method**: `POST`
- **Route**: `/api/v1/tree/place`
- **Authentication**: Required (`ADMIN` or Authorized Sponsor)
- **Request Body**:
```json
{
  "parentId": "KV-1002",
  "position": "LEFT",
  "distributorId": "KV-1005"
}
```
- **Error Codes**:
  - `400 Bad Request`:
    - Invalid position (must be `LEFT` or `RIGHT`).
    - Position is already occupied (`Position LEFT under parent KV-1002 is already occupied`).
    - Self-parenting attempt (`Distributor cannot be their own parent`).
    - Circular ancestor-under-descendant placement.
  - `404 Not Found`: Parent or member does not exist.

---

### 3.8 Admin: Move Member in Binary Tree
Re-parents a distributor with comprehensive audit logging and circularity prevention.

- **Method**: `POST`
- **Route**: `/api/v1/tree/move`
- **Authentication**: Required (`ADMIN` role)
- **Request Body**:
```json
{
  "adminId": "KV-1001",
  "memberId": "KV-1005",
  "oldParent": "KV-1002",
  "oldPosition": "LEFT",
  "newParent": "KV-1003",
  "newPosition": "RIGHT",
  "reason": "Team restructuring approved by management"
}
```
- **Validation Rules**:
  - `reason` is required.
  - `newPosition` must be `LEFT` or `RIGHT`.
  - Target slot must be unoccupied.
  - Circular hierarchy checks verify `newParent` is NOT a descendant of `memberId`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Distributor KV-1005 moved successfully",
  "auditLogId": "audit-tree-001"
}
```

---

## 4. Error Handling & Data Sanitization

1. **Production Error Format**:
```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "error": "ERROR_CODE"
}
```
2. **Stack Trace Suppression**:
In production mode, internal database exceptions, stack traces, and SQL parameters are never emitted to client consumers.
3. **Data Scrubbing**:
Every node payload returned by tree APIs strips out:
- `passwordHash`
- `refreshToken`
- `panNumber` / `taxId`
- `bankAccountNumber` / `ifscCode`
- Sensitive internal flags
