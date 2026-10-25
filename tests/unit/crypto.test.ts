import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, sha256Hex } from '@/lib/crypto';

/**
 * Secret storage for integration tokens (the Meta Conversions API token).
 *
 * The properties that matter: the round trip works, the ciphertext does not
 * contain the plaintext, a wrong key fails closed rather than returning garbage,
 * and a tampered payload is rejected by the GCM tag.
 */
describe('encryptSecret / decryptSecret', () => {
  const secret = 'a-test-secret-that-is-long-enough';
  const plaintext = 'EAAG-meta-capi-token-1234567890';

  it('round-trips a value', () => {
    const encrypted = encryptSecret(plaintext, secret);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted, secret)).toBe(plaintext);
  });

  it('uses a fresh IV for every encryption', () => {
    expect(encryptSecret(plaintext, secret)).not.toBe(encryptSecret(plaintext, secret));
  });

  it('returns null for the wrong key instead of throwing', () => {
    const encrypted = encryptSecret(plaintext, secret);
    expect(decryptSecret(encrypted, 'a-different-secret-value')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const encrypted = encryptSecret(plaintext, secret);
    const parts = encrypted.split('.');
    const tampered = [parts[0], parts[1], parts[2], `${parts[3]?.slice(0, -2)}AA`].join('.');
    expect(decryptSecret(tampered, secret)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(decryptSecret('', secret)).toBeNull();
    expect(decryptSecret('v1.not-a-real-payload', secret)).toBeNull();
    expect(decryptSecret('v2.a.b.c', secret)).toBeNull();
  });

  it('hashes deterministically and lowercases via the caller', () => {
    expect(sha256Hex('Vendor@Example.com'.toLowerCase())).toBe(sha256Hex('vendor@example.com'));
    expect(sha256Hex('a')).toHaveLength(64);
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });
});
