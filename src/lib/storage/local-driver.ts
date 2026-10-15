import 'server-only';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ValidationError } from '@/lib/errors';
import type {
  PresignRequest,
  PresignedUpload,
  StorageDriver,
  StorageObjectMetadata,
} from './types';

/**
 * Filesystem driver used in development and tests.
 *
 * It exists so the upload flow can be exercised end-to-end without cloud
 * credentials — including the completion-time `head()` re-check, which is why
 * the real byte length comes from `stat()` and the content type is persisted
 * alongside the bytes instead of being assumed.
 */

const DEFAULT_ROOT = '.local-storage';
const METADATA_DIR = '.metadata';
const DEV_UPLOAD_EXPIRY_SECONDS = 300;

export interface LocalObjectContents {
  bytes: Buffer;
  contentType: string;
}

export function createLocalStorageDriver(): StorageDriver {
  return {
    name: 'local',

    async createPresignedUpload(request: PresignRequest): Promise<PresignedUpload> {
      // No signing is possible or needed: the dev route handler is the only
      // actor that can write, and it re-validates the key and content type.
      return {
        uploadUrl: `/api/dev-media-upload?key=${encodeURIComponent(request.key)}`,
        method: 'PUT',
        key: request.key,
        publicUrl: localPublicUrl(request.key),
        expiresInSeconds: DEV_UPLOAD_EXPIRY_SECONDS,
        requiredHeaders: { 'Content-Type': request.contentType },
      };
    },

    async head(key: string): Promise<StorageObjectMetadata | null> {
      const objectPath = resolveObjectPath(key);

      const stats = await statFile(objectPath);
      if (stats === null || !stats.isFile()) return null;

      const metadata = await readMetadata(key);

      // `stat()` is typed as `Stats | BigIntStats`; the size is only ever a
      // bigint when explicitly requested, but narrow it to keep the contract.
      const sizeBytes = typeof stats.size === 'bigint' ? Number(stats.size) : stats.size;

      return {
        key,
        contentType: metadata?.contentType ?? 'application/octet-stream',
        // Read from disk rather than from the metadata record so verification
        // compares the declared size with the bytes that were really written.
        sizeBytes,
        publicUrl: localPublicUrl(key),
      };
    },

    async delete(key: string): Promise<void> {
      const objectPath = resolveObjectPath(key);
      const metadataPath = resolveMetadataPath(key);

      // `force` makes deleting an already-deleted key a no-op, matching S3.
      await rm(objectPath, { force: true });
      await rm(metadataPath, { force: true });
    },

    publicUrl(key: string): string {
      return localPublicUrl(key);
    },
  };
}

/** Writes bytes plus a sidecar metadata record. Used by the dev upload route. */
export async function writeLocalObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const objectPath = resolveObjectPath(key);
  const metadataPath = resolveMetadataPath(key);

  await mkdir(path.dirname(objectPath), { recursive: true });
  await mkdir(path.dirname(metadataPath), { recursive: true });

  await writeFile(objectPath, bytes);
  await writeFile(
    metadataPath,
    JSON.stringify({ contentType, sizeBytes: bytes.byteLength }),
    'utf8',
  );
}

export async function readLocalObject(key: string): Promise<LocalObjectContents | null> {
  const objectPath = resolveObjectPath(key);

  let bytes: Buffer;
  try {
    bytes = await readFile(objectPath);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }

  const metadata = await readMetadata(key);

  return {
    bytes,
    contentType: metadata?.contentType ?? 'application/octet-stream',
  };
}

interface LocalObjectMetadata {
  contentType: string;
  sizeBytes: number;
}

/**
 * Root is resolved per call so a test can point the driver at a new temp dir.
 *
 * `turbopackIgnore` is deliberate: this driver only ever runs in development and
 * tests (production uses the R2 driver), and the path is genuinely dynamic, so
 * the bundler cannot analyse it. Without the opt-out, Turbopack traces the whole
 * project into the server output "just in case" — inflating the deployment
 * bundle to guard a code path that production never executes.
 */
function getStorageRoot(): string {
  const configured = process.env.LOCAL_STORAGE_DIR?.trim();
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    configured && configured.length > 0 ? configured : DEFAULT_ROOT,
  );
}

function resolveObjectPath(key: string): string {
  const root = getStorageRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, key);

  assertSafeKey(key, root, resolved);
  return resolved;
}

function resolveMetadataPath(key: string): string {
  const root = getStorageRoot();
  const resolved = path.resolve(root, METADATA_DIR, `${key}.json`);

  assertSafeKey(key, root, resolved);
  return resolved;
}

/**
 * Keys ultimately come from a request body, so a key that escapes the storage
 * root (or is absolute) is treated as hostile rather than merely invalid.
 */
function assertSafeKey(key: string, root: string, resolved: string): void {
  if (key.length === 0) {
    throw new ValidationError('Storage keys must not be empty');
  }
  if (key.includes('..') || key.startsWith('/') || path.isAbsolute(key) || key.includes('\\')) {
    throw new ValidationError('Storage keys must be relative paths without ".." segments', { key });
  }

  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) {
    throw new ValidationError('Storage key resolves outside the storage root', { key });
  }
}

function localPublicUrl(key: string): string {
  return `/local-media/${key}`;
}

async function readMetadata(key: string): Promise<LocalObjectMetadata | null> {
  try {
    const raw = await readFile(resolveMetadataPath(key), 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { contentType?: unknown }).contentType === 'string'
    ) {
      return parsed as LocalObjectMetadata;
    }
    return null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    // Corrupt metadata must not fail an upload check silently into a pass; the
    // caller falls back to an unknown content type instead.
    return null;
  }
}

async function statFile(target: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(target);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
