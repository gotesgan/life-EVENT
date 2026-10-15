import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getServerEnv } from '@/lib/env';

/**
 * Prisma 7 uses driver adapters, so the connection is created from an explicit
 * connection string rather than from a URL in schema.prisma.
 *
 * One client per process: each instance owns a connection pool, and creating a
 * new client per request would exhaust Neon's connection limit.
 */
export type PrismaClientLike = PrismaClient;

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });
}

const globalForPrisma = globalThis as unknown as {
  __liveEnvtPrisma?: PrismaClient;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.__liveEnvtPrisma) {
    globalForPrisma.__liveEnvtPrisma = createPrismaClient(getServerEnv().DATABASE_URL);
  }
  return globalForPrisma.__liveEnvtPrisma;
}

/**
 * Lazy proxy so importing this module does not open a connection (important for
 * `next build`, which imports route modules without serving requests).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});
