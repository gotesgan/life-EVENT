import { createHash } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import {
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '@/lib/errors';
import { slugify } from '@/lib/slug';
import type { StorageObjectMetadata } from './types';

/**
 * Upload validation: the single source of truth for what may be stored.
 *
 * Both the presign step and the completion step call into this module, so the
 * allow-list and the size cap cannot drift apart between the two. Nothing here
 * trusts a client-supplied filename.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * The extension we store for each accepted type. Derived from the MIME type on
 * purpose: a filename like `evil.php` declared as `image/png` must land as
 * `.png`, otherwise a key could be crafted to look executable to a web server.
 */
export const EXTENSION_BY_MIME_TYPE: Record<AllowedImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const MAX_ALT_TEXT_LENGTH = 200;
const MAX_SLUG_LENGTH = 48;
const FALLBACK_SLUG = 'image';

export interface UploadRequestInput {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface ValidatedUploadRequest {
  contentType: AllowedImageMimeType;
  sizeBytes: number;
  /** Derived from `contentType`; never taken from `filename`. */
  extension: string;
}

export interface BuildListingMediaKeyInput {
  listingId: string;
  mediaId: string;
  filename: string;
  contentType: string;
  /** Part of the deterministic hash so a re-upload of new bytes gets a new key. */
  sizeBytes: number;
}

export interface VerifyUploadedObjectInput {
  declaredContentType: string;
  declaredSizeBytes: number;
  actual: StorageObjectMetadata | null;
}

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * The shared media error classes were written for message-only failures, but
 * clients need the allowed list / cap to render a useful message. Attaching the
 * machine-readable detail here keeps that knowledge in one place without
 * widening the error hierarchy's constructor surface.
 */
function withDetails<TError extends Error>(error: TError, details: unknown): TError {
  (error as { details?: unknown }).details = details;
  return error;
}

export function validateUploadRequest(input: UploadRequestInput): ValidatedUploadRequest {
  const contentType = input.contentType.trim().toLowerCase();

  if (!isAllowedImageMimeType(contentType)) {
    throw withDetails(
      new UnsupportedMediaTypeError(
        `Unsupported file type "${input.contentType}". Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      ),
      { allowedContentTypes: ALLOWED_IMAGE_MIME_TYPES, contentType: input.contentType },
    );
  }

  const maxBytes = getServerEnv().MEDIA_MAX_UPLOAD_BYTES;
  const { sizeBytes } = input;

  // A non-positive or non-integer length is always wrong, even though it is not
  // "too large" in the usual sense; it is the same class of bad request.
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw withDetails(
      new PayloadTooLargeError(
        `File size must be between 1 byte and ${maxBytes} bytes (received ${sizeBytes})`,
      ),
      { maxBytes, sizeBytes },
    );
  }

  return {
    contentType,
    sizeBytes,
    extension: EXTENSION_BY_MIME_TYPE[contentType],
  };
}

/**
 * Builds `listings/{listingId}/{mediaId}/{slug}-{sha8}.{ext}`.
 *
 * Deterministic on purpose: the same upload always resolves to the same key, so
 * a retried request is idempotent and orphan cleanup can recompute keys.
 */
export function buildListingMediaKey(input: BuildListingMediaKeyInput): string {
  const { listingId, mediaId, filename, contentType, sizeBytes } = input;

  const baseName = filename.replace(/\.[^.]*$/, '');
  const slug = slugify(baseName).slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '') || FALLBACK_SLUG;

  const extension = isAllowedImageMimeType(contentType)
    ? EXTENSION_BY_MIME_TYPE[contentType]
    : 'bin';

  const sha8 = createHash('sha256')
    .update(`${listingId}:${mediaId}:${contentType}:${sizeBytes}`)
    .digest('hex')
    .slice(0, 8);

  return `listings/${listingId}/${mediaId}/${slug}-${sha8}.${extension}`;
}

/**
 * Alt text is user input that is stored and shown in `<img alt>`; collapsing
 * whitespace stops control characters and accidental layout breakage, and the
 * cap keeps a single field from carrying an unbounded payload.
 */
export function sanitizeAltText(input: string): string {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  const capped = collapsed.slice(0, MAX_ALT_TEXT_LENGTH).trim();

  if (capped.length === 0) {
    throw new ValidationError('Alt text is required and cannot be blank');
  }

  return capped;
}

/**
 * Security checkpoint run after the browser uploads directly to storage.
 *
 * The presigned request constrains content type and length, but the client
 * controls what it actually PUTs. Re-reading the stored object is the only way
 * to know the bytes on disk match the row we are about to mark `READY`.
 */
export function verifyUploadedObject(input: VerifyUploadedObjectInput): StorageObjectMetadata {
  const { actual, declaredSizeBytes } = input;

  if (actual === null) {
    throw new NotFoundError('Upload', 'The uploaded file was not found in storage');
  }

  const declared = input.declaredContentType.trim().toLowerCase();
  // Content type headers may carry a charset parameter; only the media type is
  // meaningful for our allow-list.
  const stored = actual.contentType.split(';')[0]?.trim().toLowerCase() ?? '';

  if (stored !== declared) {
    throw withDetails(
      new UnsupportedMediaTypeError(
        `The stored content type "${actual.contentType}" did not match the declared content type "${input.declaredContentType}"`,
      ),
      { declaredContentType: input.declaredContentType, actualContentType: actual.contentType },
    );
  }

  if (actual.sizeBytes !== declaredSizeBytes) {
    throw new ValidationError(
      `The stored byte size (${actual.sizeBytes}) did not match the declared byte size (${declaredSizeBytes})`,
      { declaredSizeBytes, actualSizeBytes: actual.sizeBytes },
    );
  }

  // The allow-list is re-checked against what storage reports, not only against
  // what the client declared. On R2 the object's `ContentType` was set from the
  // declared value at presign time, so the equality check above is *tautological*
  // for that driver — it proves the metadata round-tripped, not that the bytes
  // are an image. Re-validating the reported type against the allow-list is the
  // part that can actually fail: it catches an object whose metadata was changed
  // after upload, or a driver returning something unexpected.
  if (!isAllowedImageMimeType(stored)) {
    throw withDetails(
      new UnsupportedMediaTypeError(
        `Storage reports the uploaded object as "${actual.contentType}", which is not an accepted image type`,
      ),
      { actualContentType: actual.contentType, allowed: ALLOWED_IMAGE_MIME_TYPES },
    );
  }

  // Likewise the size is re-checked against the cap, because on R2 the presigned
  // `Content-Length` is a constraint the *client* is asked to honour, and a
  // driver is free to report whatever is actually there.
  const maxBytes = getServerEnv().MEDIA_MAX_UPLOAD_BYTES;
  if (actual.sizeBytes <= 0 || actual.sizeBytes > maxBytes) {
    throw withDetails(
      new PayloadTooLargeError(
        `The stored object is ${actual.sizeBytes} bytes, outside the permitted 1–${maxBytes} range`,
      ),
      { actualSizeBytes: actual.sizeBytes, maxBytes },
    );
  }

  return actual;
}
