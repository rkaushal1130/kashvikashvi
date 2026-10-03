# Kashvimlm Backend Foundation

Enterprise backend foundation for the Kashvimlm platform built with Node.js, Express, TypeScript, PostgreSQL, Prisma, Zod, JWT, Argon2, Helmet, CORS, Rate Limiting, and Pino logger.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Validation**: Zod
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: Argon2 (argon2id)
- **Security**: Helmet & CORS
- **Rate Limiting**: express-rate-limit
- **Logging**: Pino & pino-http (pretty printing in dev, JSON in prod)

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Environment, database, logger, rate limiter configs
│   ├── controllers/     # HTTP route controllers
│   ├── middleware/      # Auth, Role, Validation, Logging, Error handling
│   ├── routes/          # Express route definitions (/api/v1 prefix)
│   ├── services/        # Business logic layer (ready for domain implementation)
│   ├── repositories/    # Database query layer (Prisma data access)
│   ├── validators/      # Zod validation schemas
│   ├── utils/           # ApiResponse, AppError, JWT, Argon2 helpers
│   ├── types/           # TypeScript type definitions and Express extensions
│   ├── jobs/            # Background jobs & schedulers
│   ├── modules/         # Feature modules
│   ├── app.ts           # Express application setup
│   └── server.ts        # Server entry point & graceful shutdown
│
├── prisma/
│   ├── schema.prisma    # Database schema definition
│   └── seed.ts          # Database seed script
│
├── tests/               # Test suites
├── docs/                # Architecture and API documentation
├── .env.example         # Environment template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # Documentation
```

---

## ⚙️ Environment Variables

Create a `.env` file in `backend/` copied from `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Application server port | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `FRONTEND_URL` | Allowed origin for CORS | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens | Required |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | Required |
| `JWT_ACCESS_EXPIRES_IN` | Lifespan of access tokens | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Lifespan of refresh tokens | `7d` |

> **Security Notice**: Never commit `.env` files to source control.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Migrations & Seed (When PostgreSQL is connected)

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5000` with hot-reload enabled via `tsx`.

---

## 🩺 Health Check Endpoint

- **Endpoint**: `GET /api/v1/health`
- **Response**:

```json
{
  "success": true,
  "message": "API is healthy"
}
```

---

## 🔒 Built-in Architecture & Security Features

- **Centralized Error Handling**: Unified `AppError` and custom middleware catching Zod, Prisma, and JWT exceptions.
- **Request Validation**: Automatic schema validation with Zod on body, query, and params.
- **Authentication & Roles**: Bearer token verification and role-based access control (`ADMIN`, `DISTRIBUTOR`, `USER`).
- **Standardized Responses**: Helpers `sendSuccess` and `sendError` ensuring uniform JSON contracts.
- **Structured Request Logging**: Pino HTTP request correlation with generated or forwarded request IDs.
- **Security Headers**: Hardened with Helmet HTTP headers.
- **Rate Limiting**: Protection against brute force and DDoS attacks.
- **Graceful Shutdown**: Intercepts `SIGTERM`, `SIGINT`, and uncaught exceptions to safely close open server connections and disconnect Prisma cleanly.
