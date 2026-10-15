import 'server-only';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import type {
  PresignRequest,
  PresignedUpload,
  StorageDriver,
  StorageObjectMetadata,
} from './types';

/**
 * Cloudflare R2 driver, spoken over the S3 API.
 *
 * All privileged access lives here and only here: the browser never sees a
 * credential, just one short-lived URL that is valid for a single object, a
 * single method, and a fixed content type and length.
 */

/** Presigned uploads are intentionally short-lived. */
const DEFAULT_PRESIGN_EXPIRY_SECONDS = 300;
/** A browser that takes longer than this to start an upload is better restarted. */
const MAX_PRESIGN_EXPIRY_SECONDS = 3600;

interface R2ClientConfig {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
}

export function createR2StorageDriver(): StorageDriver {
  const config = createR2ClientConfig();

  return {
    name: 'r2',

    async createPresignedUpload(request: PresignRequest): Promise<PresignedUpload> {
      const expiresInSeconds = clampExpiry(request.expiresInSeconds);

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: request.key,
        ContentType: request.contentType,
        // Signing the length makes storage itself reject a body that does not
        // match, so our own check is a backstop rather than the only defence.
        ContentLength: request.sizeBytes,
      });

      const uploadUrl = await getSignedUrl(config.client, command, { expiresIn: expiresInSeconds });

      return {
        uploadUrl,
        method: 'PUT',
        key: request.key,
        publicUrl: buildPublicUrl(config.publicBaseUrl, request.key),
        expiresInSeconds,
        requiredHeaders: { 'Content-Type': request.contentType },
      };
    },

    async head(key: string): Promise<StorageObjectMetadata | null> {
      try {
        const output = await config.client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );

        return {
          key,
          contentType: output.ContentType ?? 'application/octet-stream',
          // The SDK reports this as a number of bytes. A missing length is
          // reported as 0 so verification fails closed rather than passing.
          sizeBytes: output.ContentLength ?? 0,
          publicUrl: buildPublicUrl(config.publicBaseUrl, key),
        };
      } catch (error) {
        if (isMissingObjectError(error)) return null;
        throw error;
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await config.client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      } catch (error) {
        // S3 `DELETE` is already idempotent; treat a missing object the same as
        // removing it so cleanup jobs can safely retry.
        if (isMissingObjectError(error)) return;
        throw error;
      }
    },

    publicUrl(key: string): string {
      return buildPublicUrl(config.publicBaseUrl, key);
    },
  };
}

/**
 * Resolves configuration lazily so the module can be imported (and the local
 * driver chosen) in environments with no R2 credentials at all.
 */
function createR2ClientConfig(): R2ClientConfig {
  const env = getServerEnv();

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw new ValidationError(
      'Cloudflare R2 is not configured: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are required',
    );
  }

  const endpoint =
    env.R2_ENDPOINT && env.R2_ENDPOINT.length > 0
      ? env.R2_ENDPOINT
      : env.R2_ACCOUNT_ID && env.R2_ACCOUNT_ID.length > 0
        ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : null;

  if (endpoint === null) {
    throw new ValidationError(
      'Cloudflare R2 is not configured: set R2_ENDPOINT or R2_ACCOUNT_ID to reach the bucket',
    );
  }

  return {
    client: new S3Client({
      region: 'auto',
      endpoint,
      // Credentials are read from validated server env and never leave this
      // process; they are not logged or returned by any driver method.
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    }),
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? '',
  };
}

function clampExpiry(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_PRESIGN_EXPIRY_SECONDS;
  }
  return Math.min(Math.floor(requested), MAX_PRESIGN_EXPIRY_SECONDS);
}

/**
 * Public URLs are served by the bucket's CDN domain, so the base is required at
 * call time. Failing loudly here is better than persisting a broken `src`.
 */
function buildPublicUrl(publicBaseUrl: string, key: string): string {
  if (!publicBaseUrl || publicBaseUrl.trim().length === 0) {
    throw new ValidationError(
      'R2_PUBLIC_BASE_URL is not configured, so a public media URL cannot be built',
    );
  }
  return `${publicBaseUrl.trim().replace(/\/+$/, '')}/${key}`;
}

function isMissingObjectError(error: unknown): boolean {
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
