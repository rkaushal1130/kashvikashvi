import { Prisma, PrismaClient } from '@prisma/client';
import { isDev } from './env';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const devLogs: Prisma.LogDefinition[] = [
  { emit: 'event', level: 'query' },
  { emit: 'stdout', level: 'error' },
  { emit: 'stdout', level: 'info' },
  { emit: 'stdout', level: 'warn' },
];

const prodLogs: Prisma.LogDefinition[] = [
  { emit: 'stdout', level: 'error' },
  { emit: 'stdout', level: 'warn' },
];

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: isDev ? devLogs : prodLogs,
  });

if (isDev) {
  global.prisma = prisma;

  // Query event logging in development
  (prisma as any).$on?.('query', (e: any) => {
    logger.debug(
      { query: e.query, params: e.params, duration: `${e.duration}ms` },
      'Prisma Query'
    );
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to the database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed cleanly');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting database');
  }
}
