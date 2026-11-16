import { S3Client } from '@aws-sdk/client-s3';
import { ValidationError } from '@/lib/errors';

/**
 * R2 connection primitives, deliberately free of `server-only`.
 *
 * The application driver reads validated server env (`src/lib/env.ts`, which is
 * `server-only`); the deploy scripts read `process.env` directly because they
 * run outside Next. Both build the client and the public URL from here, so the
 * two paths cannot drift — and the scripts can import this module without
 * tripping the `server-only` guard.
 */

export interface R2ClientConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/**
 * Resolves the S3 endpoint from an explicit override or the account id.
 * Returns null when neither is present, so the caller can fail with its own
 * message.
 */
export function resolveR2Endpoint(input: { accountId?: string; endpoint?: string }): string | null {
  if (input.endpoint && input.endpoint.length > 0) return input.endpoint;
  if (input.accountId && input.accountId.length > 0) {
    return `https://${input.accountId}.r2.cloudflarestorage.com`;
  }
  return null;
}

export function createR2Client(config: R2ClientConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    // Credentials are read from validated server env and never leave this
    // process; they are not logged or returned by any driver method.
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Public URLs are served by the bucket's CDN domain, so the base is required at
 * call time. Failing loudly here is better than persisting a broken `src`.
 */
export function buildR2PublicUrl(publicBaseUrl: string, key: string): string {
  if (!publicBaseUrl || publicBaseUrl.trim().length === 0) {
    throw new ValidationError(
      'R2_PUBLIC_BASE_URL is not configured, so a public media URL cannot be built',
    );
  }
  return `${publicBaseUrl.trim().replace(/\/+$/, '')}/${key}`;
}

export function isMissingObjectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };

  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
