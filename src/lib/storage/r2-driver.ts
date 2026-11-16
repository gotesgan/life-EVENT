import 'server-only';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import {
  buildR2PublicUrl,
  createR2Client,
  isMissingObjectError,
  resolveR2Endpoint,
} from './r2-client';
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

interface R2DriverConfig {
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
        publicUrl: buildR2PublicUrl(config.publicBaseUrl, request.key),
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
          publicUrl: buildR2PublicUrl(config.publicBaseUrl, key),
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
      return buildR2PublicUrl(config.publicBaseUrl, key);
    },
  };
}

/**
 * Resolves configuration lazily so the module can be imported (and the local
 * driver chosen) in environments with no R2 credentials at all.
 */
function createR2ClientConfig(): R2DriverConfig {
  const env = getServerEnv();

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw new ValidationError(
      'Cloudflare R2 is not configured: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are required',
    );
  }

  const endpoint = resolveR2Endpoint({
    accountId: env.R2_ACCOUNT_ID,
    endpoint: env.R2_ENDPOINT,
  });

  if (endpoint === null) {
    throw new ValidationError(
      'Cloudflare R2 is not configured: set R2_ENDPOINT or R2_ACCOUNT_ID to reach the bucket',
    );
  }

  return {
    client: createR2Client({
      endpoint,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? '',
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
