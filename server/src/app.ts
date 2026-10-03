import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/logging.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { csrfProtection } from './middleware/csrf.js';
import { setupSwagger } from './config/swagger.js';
import { config } from './config/env.js';

// Module Route Imports
import authRoutes from './modules/auth/auth.routes.js';
import distributorRoutes from './modules/distributor/distributor.routes.js';
import enrollmentRoutes from './modules/enrollment/enrollment.routes.js';
import productRoutes from './modules/products/product.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import { EnrollmentController } from './modules/enrollment/enrollment.controller.js';
import mlmTreeRoutes from './modules/mlmTree/mlmTree.routes.js';
import businessVolumeRoutes from './modules/bvEngine/businessVolume.routes.js';
import commissionRoutes from './modules/commissionEngine/commission.routes.js';
import bvEngineRoutes from './modules/bvEngine/bvEngine.routes.js';
import commissionEngineRoutes from './modules/commissionEngine/commissionEngine.routes.js';
import walletRoutes from './modules/wallet/wallet.routes.js';
import payoutRoutes from './modules/payouts/payout.routes.js';
import { trainingRoutes } from './modules/training/training.routes.js';
import { supportRoutes } from './modules/support/support.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import newsRoutes from './modules/news/news.routes.js';
import websiteRoutes from './modules/website/website.routes.js';

export const app: Express = express();

// 1. Request Correlation ID (Unique request UUID tracking)
app.use(requestIdMiddleware);

// 2. Cookie Parser for HTTP-Only Secure Cookies & Refresh Tokens
app.use(cookieParser());

// 3. Hardened HTTP Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI and local preview assets
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
  })
);

// 4. Strict Cross-Origin Resource Sharing (CORS Whitelist)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        config.corsAllowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin ${origin} not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
  })
);

// 5. High-Performance Pino Structured HTTP Request Logging with PII Redaction
app.use(httpLogger);

// 6. Rate Limiting for DoS Protection
app.use('/api/', globalLimiter);

// 7. Payload Parsers (Bounded to 10MB to prevent memory exhaustion DoS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 8. CSRF Protection for Cookie-Authenticated Requests
app.use(csrfProtection);

// 9. Interactive OpenAPI / Swagger UI
setupSwagger(app);

// 7. Health Check & Root Route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'KashviMLM Enterprise REST API',
    version: '1.0.0',
    status: 'ONLINE',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
    endpoints: {
      swagger: '/api/docs',
      auth: '/api/v1/auth',
      distributors: '/api/v1/distributors',
      enrollment: '/api/v1/enrollment',
      products: '/api/v1/products',
      cart: '/api/v1/cart',
      orders: '/api/v1/orders',
      mlmTree: '/api/v1/tree',
      bvEngine: '/api/v1/bv',
      commissionEngine: '/api/v1/commissions',
      wallet: '/api/v1/wallet',
      payouts: '/api/v1/payouts',
      training: '/api/v1/training',
      website: '/api/v1/website',
      news: '/api/v1/news',
      support: '/api/v1/support',
      notifications: '/api/v1/notifications',
      admin: '/api/v1/admin',
    },
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Prompt 3, 4, 5, 6 REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/tree', mlmTreeRoutes);
app.use('/api/business-volume', businessVolumeRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/admin', adminRoutes);

// API v1 Routing Table (14 Modules)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/distributors', distributorRoutes);
app.use('/api/v1/enrollment', enrollmentRoutes);
app.get('/api/v1/sponsors/:sponsorId', EnrollmentController.verifySponsor);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/tree', mlmTreeRoutes);
app.use('/api/v1/network-tree', mlmTreeRoutes);

app.use('/api/v1/bv', bvEngineRoutes);
app.use('/api/v1/business-volume', businessVolumeRoutes);
app.use('/api/v1/commissions', commissionEngineRoutes);
app.use('/api/v1/commission', commissionRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/payouts', payoutRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/website', websiteRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);

// 9. 404 Catch-All Route
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found on KashviMLM REST API server. Refer to /api/docs for API specification.',
  });
});

// 10. Global Centralized Error Handler Middleware
app.use(errorHandler);
