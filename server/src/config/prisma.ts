import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function checkPrismaConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err: any) {
    logger.warn('[Prisma] Database connection offline or initializing. Operating with resilient safety layer.');
    return false;
  }
}
