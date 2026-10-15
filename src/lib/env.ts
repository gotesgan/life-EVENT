import 'server-only';
import { z } from 'zod';

/**
 * Server-side environment validation.
 *
 * Validated once, lazily, at the first server-side access. Every service that
 * needs configuration goes through this module, so a missing or malformed
 * variable fails loudly at the boundary instead of surfacing as `undefined`
 * deep inside a request.
 *
 * Nothing here is prefixed `NEXT_PUBLIC_`, so none of it can be inlined into a
 * client bundle.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters'),
  BETTER_AUTH_URL: z.string().min(1).optional(),

  NEXT_PUBLIC_APP_URL: z.string().min(1).default('http://localhost:3000'),

  // Media. All optional: when R2 is not configured the local filesystem driver
  // is used, so development and tests need no cloud credentials.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  /**
   * Explicit opt-in to the local filesystem storage driver in a production
   * build. Without it, a production deploy missing its R2 credentials fails
   * loudly instead of silently writing media to an ephemeral filesystem and
   * serving 404s. Set it only where a persistent local disk genuinely exists (a
   * container with a mounted volume, or CI).
   */
  ALLOW_LOCAL_MEDIA_STORAGE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((value) => value === 'true'),

  IP_HASH_SALT: z.string().default('dev-only-ip-salt'),

  /**
   * How many proxies in front of the application we control.
   *
   * `x-forwarded-for` is a chain a client can prepend to, so the client address
   * is counted from the *end*, not the start. 1 matches a single managed platform
   * proxy (Vercel's edge) whose appended entry is the address it observed. Raise
   * it if you add your own proxy in front; lower it to 0 only when nothing
   * appends address information and `x-real-ip` is the sole source.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

  RATE_LIMIT_ENQUIRY_PER_IP: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_ENQUIRY_PER_EMAIL: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_AUTH_PER_IP: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const PLACEHOLDER_SECRET_PATTERN = /replace-with|changeme|dev-only|secret-here|example/i;

/**
 * Production hardening.
 *
 * `BETTER_AUTH_SECRET` already had a minimum length, but a copied
 * `.env.example` satisfies that, and `IP_HASH_SALT` used to default silently —
 * so a deploy could run with a published salt and a placeholder secret and look
 * perfectly healthy. These checks turn that into a startup failure, which is the
 * only failure mode an operator will actually notice.
 */
const hardenedEnvSchema = serverEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  // `next build` collects page data with NODE_ENV=production, so these deployment
  // checks would run on a build machine that legitimately has no production
  // secrets — breaking `pnpm build` from a clean checkout, which is how the
  // regression that added this guard first showed up. The build is not a
  // deployment: nothing is served, and no request can be handled with a bad
  // salt. A real server has NEXT_PHASE unset, so it still fails closed on the
  // first request, which is the failure an operator actually needs to see.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  if (PLACEHOLDER_SECRET_PATTERN.test(env.BETTER_AUTH_SECRET)) {
    ctx.addIssue({
      code: 'custom',
      path: ['BETTER_AUTH_SECRET'],
      message:
        'BETTER_AUTH_SECRET is a placeholder value. Generate one with `openssl rand -base64 32`.',
    });
  }
  if (env.BETTER_AUTH_SECRET.length < 32) {
    ctx.addIssue({
      code: 'custom',
      path: ['BETTER_AUTH_SECRET'],
      message: 'BETTER_AUTH_SECRET must be at least 32 characters in production.',
    });
  }
  if (env.IP_HASH_SALT === 'dev-only-ip-salt' || env.IP_HASH_SALT.length < 16) {
    ctx.addIssue({
      code: 'custom',
      path: ['IP_HASH_SALT'],
      message:
        'IP_HASH_SALT must be set to a unique random value of at least 16 characters in production. It is the only thing protecting stored IP hashes from reversal.',
    });
  }
  if (!env.ALLOW_LOCAL_MEDIA_STORAGE) {
    const missing = (
      ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'] as const
    ).filter((key) => !env[key]);
    if (missing.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['R2_BUCKET'],
        message: `Media storage is not configured in production (missing ${missing.join(', ')}), and the local filesystem driver is not an acceptable production store. Configure Cloudflare R2, or set ALLOW_LOCAL_MEDIA_STORAGE=true if this environment really has a persistent disk.`,
      });
    }
  }
});

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = hardenedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test-only helper so a suite can re-read env after overriding variables. */
export function resetServerEnvCache(): void {
  cached = null;
}

/** True when Cloudflare R2 credentials are present. */
export function isR2Configured(): boolean {
  const env = getServerEnv();
  return Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

/**
 * Public base URL of the app, used for canonical URLs, sitemap entries and
 * auth callback URLs.
 */
export function getAppUrl(): string {
  return getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}
