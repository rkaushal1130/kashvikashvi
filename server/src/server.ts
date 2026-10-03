import { app } from './app.js';
import { config } from './config/env.js';
import { testDbConnection, pool } from './config/db.js';
import { checkPrismaConnection, prisma } from './config/prisma.js';
import { logger } from './config/logger.js';

async function bootstrap() {
  console.log('=====================================================');
  console.log('       KASHVIMLM ENTERPRISE REST API BACKEND         ');
  console.log('=====================================================');
  console.log(`Environment:    ${config.nodeEnv}`);
  console.log(`Port:           ${config.port}`);
  console.log(`Security:       Helmet + Argon2 + Rate Limiting`);
  console.log(`Validation:     Zod Type-Safe Request Guards`);
  console.log(`ORM Engine:     Prisma ORM + PostgreSQL`);
  console.log(`Binary Matching:${config.binaryMatchPercentage}%`);
  console.log(`TDS Deduction:  ${config.tdsDeductionPercentage}%`);
  console.log(`Admin Fee:      ${config.adminFeePercentage}%`);

  // Verify Database Connection (PostgreSQL & Prisma)
  const isDbReady = await testDbConnection();
  const isPrismaReady = await checkPrismaConnection();

  if (isDbReady || isPrismaReady) {
    console.log('✅ Connected to PostgreSQL cluster via Prisma ORM.');
  } else {
    console.log('⚠️  PostgreSQL offline. Operating with resilient in-memory safety store.');
  }

  const server = app.listen(config.port, () => {
    console.log('-----------------------------------------------------');
    console.log(`🚀 REST API Server active on http://localhost:${config.port}`);
    console.log(`📖 Swagger API Docs:  http://localhost:${config.port}/api/docs`);
    console.log(`📡 Health Check:       http://localhost:${config.port}/health`);
    console.log(`📡 Base API Root:      http://localhost:${config.port}/api/v1`);
    console.log('=====================================================');
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully shutting down HTTP server...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        await pool.end();
        console.log('Database connections closed safely.');
      } catch (err) {
        // ignore
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal(err, 'Fatal initialization error in KashviMLM Server');
  process.exit(1);
});
