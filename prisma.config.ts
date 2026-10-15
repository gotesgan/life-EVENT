import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 keeps the connection configuration here rather than in
 * schema.prisma.
 *
 * IMPORTANT: `datasource.url` is what the Prisma CLI and the migration engine
 * use, so it must point at the **direct** (non-pooled) endpoint. The running
 * application connects separately through the `@prisma/adapter-pg` driver
 * adapter using the pooled `DATABASE_URL` — see src/lib/db.ts.
 *
 * Prisma 7's datasource config type has no `directUrl` key (that was a Prisma 6
 * schema attribute); passing one is silently ignored, so the direct URL is
 * selected here at the source instead.
 */
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: directUrl,
  },
});
