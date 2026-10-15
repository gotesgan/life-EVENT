import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/env';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  EXTENSION_BY_MIME_TYPE,
  buildListingMediaKey,
  createLocalStorageDriver,
  createR2StorageDriver,
  getStorageDriver,
  readLocalObject,
  resetStorageDriverForTests,
  sanitizeAltText,
  validateUploadRequest,
  verifyUploadedObject,
  writeLocalObject,
} from '@/lib/storage';
import {
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '@/lib/errors';
import type { StorageObjectMetadata } from '@/lib/storage/types';

const TEST_MAX_BYTES = 1024;
const TEST_KEY = 'listings/listing-1/media-1/photo-ab12cd34.png';
const TEST_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Keys that isolate each driver test from the process-wide memoised driver. */
let storageDir: string;

beforeAll(() => {
  // getServerEnv() validates the whole schema, so the unrelated required
  // variables must exist even though this suite only touches media settings.
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/liveenvt_test';
  process.env.BETTER_AUTH_SECRET ??= 'unit-test-secret-value';
});

beforeEach(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'liveenvt-storage-'));
  process.env.LOCAL_STORAGE_DIR = storageDir;
  process.env.MEDIA_MAX_UPLOAD_BYTES = String(TEST_MAX_BYTES);
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET;
  delete process.env.R2_PUBLIC_BASE_URL;
  delete process.env.R2_ENDPOINT;
  resetServerEnvCache();
  resetStorageDriverForTests();
});

afterEach(async () => {
  resetStorageDriverForTests();
  resetServerEnvCache();
  await rm(storageDir, { recursive: true, force: true });
});

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the callback to throw, but it returned normally');
}

function configureR2(overrides: Record<string, string | undefined> = {}): void {
  process.env.R2_ACCESS_KEY_ID = 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.R2_BUCKET = 'liveenvt-test-bucket';
  process.env.R2_ACCOUNT_ID = 'test-account';
  process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com';

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  resetServerEnvCache();
  resetStorageDriverForTests();
}

describe('validateUploadRequest', () => {
  it('accepts every allow-listed image type and derives its extension', () => {
    for (const contentType of ALLOWED_IMAGE_MIME_TYPES) {
      const result = validateUploadRequest({
        filename: 'anything.bin',
        contentType,
        sizeBytes: 128,
      });

      expect(result.contentType).toBe(contentType);
      expect(result.extension).toBe(EXTENSION_BY_MIME_TYPE[contentType]);
    }
  });

  it('normalises a case-insensitive content type', () => {
    const result = validateUploadRequest({
      filename: 'photo.JPG',
      contentType: 'IMAGE/JPEG',
      sizeBytes: 10,
    });

    expect(result.contentType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
  });

  it('rejects a disallowed content type and lists the allowed types', () => {
    const error = captureError(() =>
      validateUploadRequest({ filename: 'anim.gif', contentType: 'image/gif', sizeBytes: 10 }),
    );

    expect(error).toBeInstanceOf(UnsupportedMediaTypeError);
    expect((error as UnsupportedMediaTypeError).details).toEqual({
      allowedContentTypes: [...ALLOWED_IMAGE_MIME_TYPES],
      contentType: 'image/gif',
    });
  });

  it('rejects a zero or negative size as too large', () => {
    for (const sizeBytes of [0, -1]) {
      const error = captureError(() =>
        validateUploadRequest({ filename: 'photo.png', contentType: 'image/png', sizeBytes }),
      );

      expect(error).toBeInstanceOf(PayloadTooLargeError);
      expect((error as PayloadTooLargeError).details).toMatchObject({ maxBytes: TEST_MAX_BYTES });
    }
  });

  it('accepts the cap exactly and rejects one byte over it', () => {
    expect(
      validateUploadRequest({
        filename: 'photo.png',
        contentType: 'image/png',
        sizeBytes: TEST_MAX_BYTES,
      }).sizeBytes,
    ).toBe(TEST_MAX_BYTES);

    const error = captureError(() =>
      validateUploadRequest({
        filename: 'photo.png',
        contentType: 'image/png',
        sizeBytes: TEST_MAX_BYTES + 1,
      }),
    );

    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect((error as PayloadTooLargeError).details).toEqual({
      maxBytes: TEST_MAX_BYTES,
      sizeBytes: TEST_MAX_BYTES + 1,
    });
  });

  it('rejects a non-integer size', () => {
    const error = captureError(() =>
      validateUploadRequest({ filename: 'photo.png', contentType: 'image/png', sizeBytes: 1.5 }),
    );

    expect(error).toBeInstanceOf(PayloadTooLargeError);
  });
});

describe('buildListingMediaKey', () => {
  const input = {
    listingId: 'listing-1',
    mediaId: 'media-1',
    filename: 'My Great Photo.png',
    contentType: 'image/png',
    sizeBytes: 2048,
  };

  it('derives the extension from the content type, not the filename', () => {
    const key = buildListingMediaKey({ ...input, filename: 'evil.php' });

    expect(key).toMatch(/^listings\/listing-1\/media-1\/evil-[0-9a-f]{8}\.png$/);
    expect(key.endsWith('.php')).toBe(false);
  });

  it('is deterministic for identical input', () => {
    expect(buildListingMediaKey(input)).toBe(buildListingMediaKey(input));
  });

  it('produces a different key when the media id, size or content type changes', () => {
    const base = buildListingMediaKey(input);

    expect(buildListingMediaKey({ ...input, mediaId: 'media-2' })).not.toBe(base);
    expect(buildListingMediaKey({ ...input, sizeBytes: 2049 })).not.toBe(base);
    expect(buildListingMediaKey({ ...input, contentType: 'image/webp' })).not.toBe(base);
  });

  it('hashes listing, media, content type and size into the key', () => {
    const expectedSha8 = createHash('sha256')
      .update(`listing-1:media-1:image/png:2048`)
      .digest('hex')
      .slice(0, 8);

    expect(buildListingMediaKey(input)).toBe(
      `listings/listing-1/media-1/my-great-photo-${expectedSha8}.png`,
    );
  });

  it('keeps the slug short and URL-safe', () => {
    const key = buildListingMediaKey({
      ...input,
      filename: `${'A'.repeat(20)} ${'B/'.repeat(40)} final image.jpeg`,
      contentType: 'image/jpeg',
      sizeBytes: 10,
    });

    const slug = key.split('/')[3]?.replace(/-[0-9a-f]{8}\.jpg$/, '') ?? '';

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(key).toMatch(/^listings\/listing-1\/media-1\/[a-z0-9-]+-[0-9a-f]{8}\.jpg$/);
  });
});

describe('sanitizeAltText', () => {
  it('collapses whitespace and trims', () => {
    expect(sanitizeAltText('  Bright \n\t living   room  ')).toBe('Bright living room');
  });

  it('caps the value at 200 characters', () => {
    const result = sanitizeAltText(`${'a'.repeat(150)} ${'b'.repeat(150)}`);

    expect(result).toHaveLength(200);
    expect(result.endsWith(' ')).toBe(false);
  });

  it('rejects blank input', () => {
    for (const input of ['', '   ', '\n\t ']) {
      expect(() => sanitizeAltText(input)).toThrow(ValidationError);
    }
  });
});

describe('verifyUploadedObject', () => {
  const metadata: StorageObjectMetadata = {
    key: TEST_KEY,
    contentType: 'image/png',
    sizeBytes: TEST_BYTES.byteLength,
    publicUrl: `https://cdn.example.com/${TEST_KEY}`,
  };

  it('returns the verified metadata when everything matches', () => {
    const result = verifyUploadedObject({
      declaredContentType: 'image/png',
      declaredSizeBytes: TEST_BYTES.byteLength,
      actual: metadata,
    });

    expect(result).toEqual(metadata);
  });

  it('tolerates parameters on the stored content type', () => {
    const result = verifyUploadedObject({
      declaredContentType: 'image/png',
      declaredSizeBytes: TEST_BYTES.byteLength,
      actual: { ...metadata, contentType: 'image/png; charset=binary' },
    });

    expect(result.key).toBe(TEST_KEY);
  });

  it('throws NotFoundError when the object is missing from storage', () => {
    expect(() =>
      verifyUploadedObject({
        declaredContentType: 'image/png',
        declaredSizeBytes: 10,
        actual: null,
      }),
    ).toThrow(NotFoundError);
  });

  it('throws UnsupportedMediaTypeError when the stored type was not declared', () => {
    const error = captureError(() =>
      verifyUploadedObject({
        declaredContentType: 'image/png',
        declaredSizeBytes: TEST_BYTES.byteLength,
        actual: { ...metadata, contentType: 'image/jpeg' },
      }),
    );

    expect(error).toBeInstanceOf(UnsupportedMediaTypeError);
    expect((error as UnsupportedMediaTypeError).message).toMatch(/did not match/i);
  });

  it('throws ValidationError when the stored size was not declared', () => {
    const error = captureError(() =>
      verifyUploadedObject({
        declaredContentType: 'image/png',
        declaredSizeBytes: TEST_BYTES.byteLength + 1,
        actual: metadata,
      }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      declaredSizeBytes: TEST_BYTES.byteLength + 1,
      actualSizeBytes: TEST_BYTES.byteLength,
    });
  });
});

describe('local storage driver', () => {
  it('round trips write -> head -> read -> delete -> head', async () => {
    const driver = createLocalStorageDriver();

    await writeLocalObject(TEST_KEY, TEST_BYTES, 'image/png');

    const head = await driver.head(TEST_KEY);
    expect(head).toEqual({
      key: TEST_KEY,
      contentType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      publicUrl: `/local-media/${TEST_KEY}`,
    });

    const read = await readLocalObject(TEST_KEY);
    expect(read).not.toBeNull();
    expect(read?.contentType).toBe('image/png');
    expect(read?.bytes.equals(Buffer.from(TEST_BYTES))).toBe(true);

    await driver.delete(TEST_KEY);

    expect(await driver.head(TEST_KEY)).toBeNull();
    expect(await readLocalObject(TEST_KEY)).toBeNull();
  });

  it('reports the byte length actually written to disk', async () => {
    const driver = createLocalStorageDriver();
    await writeLocalObject(TEST_KEY, TEST_BYTES, 'image/png');

    const head = await driver.head(TEST_KEY);
    const stats = await stat(path.join(storageDir, TEST_KEY));

    expect(head?.sizeBytes).toBe(stats.size);
  });

  it('treats deleting a missing key as success', async () => {
    const driver = createLocalStorageDriver();

    await expect(driver.delete('listings/none/missing.png')).resolves.toBeUndefined();
    await expect(readLocalObject('listings/none/missing.png')).resolves.toBeNull();
  });

  it('issues a dev presigned upload pointing at the dev route', async () => {
    const driver = createLocalStorageDriver();

    const presigned = await driver.createPresignedUpload({
      key: TEST_KEY,
      contentType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
    });

    expect(presigned).toEqual({
      uploadUrl: `/api/dev-media-upload?key=${encodeURIComponent(TEST_KEY)}`,
      method: 'PUT',
      key: TEST_KEY,
      publicUrl: `/local-media/${TEST_KEY}`,
      expiresInSeconds: 300,
      requiredHeaders: { 'Content-Type': 'image/png' },
    });
  });

  it('rejects path traversal keys instead of escaping the storage root', async () => {
    const driver = createLocalStorageDriver();
    const hostileKeys = [
      '../../etc/passwd',
      '/etc/passwd',
      'listings/../../etc/passwd',
      'a/../b.png',
      '..\\..\\windows\\system32',
      '',
    ];

    for (const key of hostileKeys) {
      await expect(writeLocalObject(key, TEST_BYTES, 'image/png')).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(readLocalObject(key)).rejects.toBeInstanceOf(ValidationError);
      await expect(driver.head(key)).rejects.toBeInstanceOf(ValidationError);
      await expect(driver.delete(key)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it('serves public URLs under /local-media', () => {
    expect(createLocalStorageDriver().publicUrl(TEST_KEY)).toBe(`/local-media/${TEST_KEY}`);
  });
});

describe('r2 storage driver', () => {
  it('builds a public URL from the configured base and tolerates a trailing slash', () => {
    configureR2({ R2_PUBLIC_BASE_URL: 'https://cdn.example.com/' });

    expect(createR2StorageDriver().publicUrl('listings/a/b.png')).toBe(
      'https://cdn.example.com/listings/a/b.png',
    );
  });

  it('throws at call time when no public base URL is configured', () => {
    configureR2({ R2_PUBLIC_BASE_URL: undefined });

    expect(() => createR2StorageDriver().publicUrl('listings/a/b.png')).toThrow(ValidationError);
  });

  it('presigns a PUT with the content type and length baked in', async () => {
    configureR2();

    const presigned = await createR2StorageDriver().createPresignedUpload({
      key: TEST_KEY,
      contentType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
    });

    expect(presigned.method).toBe('PUT');
    expect(presigned.key).toBe(TEST_KEY);
    expect(presigned.publicUrl).toBe(`https://cdn.example.com/${TEST_KEY}`);
    expect(presigned.expiresInSeconds).toBe(300);
    expect(presigned.requiredHeaders).toEqual({ 'Content-Type': 'image/png' });
    expect(presigned.uploadUrl).toContain('liveenvt-test-bucket');
    expect(presigned.uploadUrl).toContain('X-Amz-Signature');
    expect(presigned.uploadUrl).toContain('X-Amz-Expires=300');
  });

  it('honours a caller-supplied expiry within the maximum', async () => {
    configureR2();

    const presigned = await createR2StorageDriver().createPresignedUpload({
      key: TEST_KEY,
      contentType: 'image/webp',
      sizeBytes: 10,
      expiresInSeconds: 900,
    });

    expect(presigned.expiresInSeconds).toBe(900);
    expect(presigned.uploadUrl).toContain('X-Amz-Expires=900');
  });

  it('refuses to construct a driver when credentials are incomplete', () => {
    configureR2({ R2_SECRET_ACCESS_KEY: undefined });

    expect(() => createR2StorageDriver()).toThrow(ValidationError);
  });
});

describe('getStorageDriver', () => {
  it('falls back to the local driver when R2 is not configured', () => {
    const driver = getStorageDriver();

    expect(driver.name).toBe('local');
    expect(getStorageDriver()).toBe(driver);
  });

  it('selects the R2 driver when credentials are present', () => {
    configureR2();

    const driver = getStorageDriver();

    expect(driver.name).toBe('r2');
    expect(driver.publicUrl(TEST_KEY)).toBe(`https://cdn.example.com/${TEST_KEY}`);
    expect(getStorageDriver()).toBe(driver);
  });

  it('rebuilds the driver after resetStorageDriverForTests', () => {
    const first = getStorageDriver();
    resetStorageDriverForTests();
    const second = getStorageDriver();

    expect(second).not.toBe(first);
    expect(second.name).toBe('local');
  });
});
