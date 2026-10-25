import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Secret storage for settings that must be readable by the server but must never
 * be returned to a browser in plain text — currently the Meta Conversions API
 * access token.
 *
 * AES-256-GCM with a random IV per value, authenticated (the tag is stored), and
 * a version prefix so a future key rotation can decrypt old rows. The key is
 * derived from `BETTER_AUTH_SECRET`; that value is already the root secret for
 * session signing, so a database leak alone does not expose integration tokens.
 * This is deliberately not a KMS: it is the right level of protection for a
 * single-server deployment, and the shape (`v1.iv.tag.ciphertext`) is what an
 * operator would re-wrap into a KMS later without touching call sites.
 */
const VERSION = 'v1';

function keyFor(secret: string): Buffer {
  return createHash('sha256').update(`settings-key:${secret}`).digest();
}

export function encryptSecret(plainText: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/** Returns `null` for anything malformed rather than throwing into a page render. */
export function decryptSecret(payload: string, secret: string): string | null {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const iv = Buffer.from(parts[1]!, 'base64url');
    const tag = Buffer.from(parts[2]!, 'base64url');
    const ciphertext = Buffer.from(parts[3]!, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** SHA-256, lowercase hex. Used for invite-token hashes and Meta PII hashing. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** A URL-safe random token; only its hash is ever persisted. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
