# Kashvimlm Backend Architecture

## Overview

The Kashvimlm backend is architected following clean, layered architecture principles with separation of concerns:

```
src/
├── config/         # Environment, Logger, Database, Rate Limiting configs
├── controllers/    # HTTP handlers mapping requests to services
├── middleware/     # Auth, Roles, Request Validation, Error Handling, Logging
├── routes/         # Express routing definitions prefixed at /api/v1
├── services/       # Domain and business logic
├── repositories/   # Direct database queries & Prisma ORM interactions
├── validators/     # Reusable Zod schemas for input validation
├── utils/          # Standard response formatters, AppError, JWT, Argon2
├── types/          # TypeScript interfaces, types, and Express declarations
├── jobs/           # Background jobs, schedulers, and queue handlers
├── modules/        # Domain-driven feature packages
├── app.ts          # Express app middleware assembly
└── server.ts       # Server bootstrap, DB connection, and graceful shutdown
```

## Security & Reliability Features

1. **Centralized Error Handling**:
   - `AppError` provides typed operational error propagation.
   - Centralized handler catches and sanitizes Zod, Prisma, and JWT errors.
   - Stack traces hidden in production.

2. **Request Validation**:
   - Schema validation with Zod on request `body`, `query`, and `params`.

3. **Authentication & Authorization**:
   - JWT validation middleware extracts and verifies bearer tokens.
   - Role-based authorization middleware protects endpoints (`ADMIN`, `DISTRIBUTOR`, `USER`).
   - Argon2id for secure password hashing.

4. **Security Headers & CORS**:
   - Helmet provides HTTP header hardening.
   - CORS is restricted to frontend domains in production with credential support.

5. **Rate Limiting**:
   - Configured with `express-rate-limit` using standard HTTP headers (`draft-7`).

6. **Structured Logging**:
   - Pino logger with pretty printing in development and structured JSON in production.
   - Request-id correlation across request lifecycles.

7. **Graceful Shutdown**:
   - Handles `SIGTERM`, `SIGINT`, `uncaughtException`, and `unhandledRejection`.
   - Closes HTTP server connections before disconnecting the database.
