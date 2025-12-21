import { PrismaClient } from '@prisma/client';

// Global Prisma client singleton
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Create or reuse Prisma client instance
 * Uses global singleton in development to prevent hot-reload issues
 */
export function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }

  return globalThis.prisma;
}

/**
 * Default Prisma client instance
 */
export const prisma = createPrismaClient();

/**
 * Graceful shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
