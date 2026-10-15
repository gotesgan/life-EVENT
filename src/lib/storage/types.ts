/**
 * Storage contracts.
 *
 * Deliberately free of any cloud SDK import: the services layer depends on this
 * interface, not on Cloudflare R2 or the filesystem, so a driver can be swapped
 * in tests without stubbing network calls. Kept out of `server-only` so the
 * shapes stay type-checkable from anywhere.
 */

/** What `head()` reports about an object that actually exists in storage. */
export interface StorageObjectMetadata {
  key: string;
  contentType: string;
  sizeBytes: number;
  publicUrl: string;
}

/** A short-lived, single-object upload grant handed to the browser. */
export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT';
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
  /**
   * Headers the browser must send verbatim. They are part of the signature, so
   * omitting or altering one makes storage reject the upload.
   */
  requiredHeaders: Record<string, string>;
}

export interface PresignRequest {
  key: string;
  contentType: string;
  sizeBytes: number;
  expiresInSeconds?: number;
}

export interface StorageDriver {
  readonly name: 'r2' | 'local';
  createPresignedUpload(request: PresignRequest): Promise<PresignedUpload>;
  head(key: string): Promise<StorageObjectMetadata | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
