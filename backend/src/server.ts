import { createServer } from 'http';
import app from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

const server = createServer(app);

async function startServer(): Promise<void> {
  try {
    // Attempt database connection (logs warning in development if DB is not yet running)
    try {
      await connectDatabase();
    } catch (dbError) {
      if (env.NODE_ENV === 'production') {
        throw dbError;
      }
      logger.warn('⚠️ Database connection could not be established. Ensure PostgreSQL is running.');
    }

    server.listen(env.PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      logger.info(`👉 Health Check: http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful Shutdown Handler
let isShuttingDown = false;

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process termination.');
    process.exit(1);
  }, 10000);

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
    } else {
      logger.info('HTTP server closed successfully');
    }

    try {
      await disconnectDatabase();
    } catch (dbErr) {
      logger.error({ dbErr }, 'Error disconnecting database');
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ error }, 'Uncaught Exception detected');
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any) => {
  logger.fatal({ reason }, 'Unhandled Rejection detected');
  handleShutdown('unhandledRejection');
});

startServer();
