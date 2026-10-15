import 'server-only';
import { getServerEnv, isR2Configured } from '@/lib/env';
import { createLocalStorageDriver } from './local-driver';
import { createR2StorageDriver } from './r2-driver';
import type { StorageDriver } from './types';

/**
 * Storage entry point.
 *
 * The driver is chosen from the environment and memoised: an `S3Client` holds a
 * connection pool, so constructing one per request would be wasteful, and the
 * decision cannot change while the process is running (server env is cached).
 */

let cached: StorageDriver | null = null;

/**
 * True when the local filesystem driver is the active store.
 *
 * The development upload and serve routes are gated on this rather than on
 * `NODE_ENV` — the wrong predicate. What decides whether those routes are usable
 * is *which driver is in use*: a production-mode build with the local driver
 * (a container with a mounted volume, or CI) legitimately needs them, while a
 * real R2 deploy must 404 them. Gating on `NODE_ENV` broke the first case and
 * told us nothing about the second.
 */
export function isLocalStorageActive(): boolean {
  if (isR2Configured()) return false;
  return getServerEnv().ALLOW_LOCAL_MEDIA_STORAGE || getServerEnv().NODE_ENV !== 'production';
}

export function getStorageDriver(): StorageDriver {
  if (cached) return cached;

  if (isR2Configured()) {
    cached = createR2StorageDriver();
    return cached;
  }

  // Falling back to the filesystem in production used to happen silently: an
  // operator who left the R2 variables blank got a healthy-looking deploy that
  // wrote media to an ephemeral disk and served 404s for every image. Fail
  // loudly instead, unless the environment explicitly opts in.
  const env = getServerEnv();
  if (env.NODE_ENV === 'production' && !env.ALLOW_LOCAL_MEDIA_STORAGE) {
    throw new Error(
      'Cloudflare R2 is not configured. Production media storage cannot fall back to the local filesystem. ' +
        'Set the R2_* variables, or set ALLOW_LOCAL_MEDIA_STORAGE=true if this environment genuinely has a persistent disk.',
    );
  }

  cached = createLocalStorageDriver();
  return cached;
}

/** Test-only helper so a suite can point storage at a temp directory. */
export function resetStorageDriverForTests(): void {
  cached = null;
}

export * from './types';
export * from './validation';
export {
  createLocalStorageDriver,
  readLocalObject,
  writeLocalObject,
  type LocalObjectContents,
} from './local-driver';
export { createR2StorageDriver } from './r2-driver';
