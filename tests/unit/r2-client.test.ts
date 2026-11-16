import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/errors';
import { buildR2PublicUrl, isMissingObjectError, resolveR2Endpoint } from '@/lib/storage/r2-client';

/**
 * The deploy scripts and the application driver share these helpers, so the
 * contract is tested directly rather than only through the driver.
 */

describe('resolveR2Endpoint', () => {
  it('prefers an explicit endpoint over the account id', () => {
    expect(
      resolveR2Endpoint({ endpoint: 'https://custom.example.com', accountId: 'account' }),
    ).toBe('https://custom.example.com');
  });

  it('derives the endpoint from the account id', () => {
    expect(resolveR2Endpoint({ accountId: 'abc123' })).toBe(
      'https://abc123.r2.cloudflarestorage.com',
    );
  });

  it('returns null when neither is configured', () => {
    expect(resolveR2Endpoint({})).toBeNull();
    expect(resolveR2Endpoint({ endpoint: '', accountId: '' })).toBeNull();
  });
});

describe('buildR2PublicUrl', () => {
  it('joins the base and the key', () => {
    expect(buildR2PublicUrl('https://cdn.example.com', 'venues/a/b.jpg')).toBe(
      'https://cdn.example.com/venues/a/b.jpg',
    );
  });

  it('strips trailing slashes from the base', () => {
    expect(buildR2PublicUrl('https://cdn.example.com///', 'seed/a.jpg')).toBe(
      'https://cdn.example.com/seed/a.jpg',
    );
  });

  it('fails loudly when the base is missing', () => {
    expect(() => buildR2PublicUrl('', 'seed/a.jpg')).toThrow(ValidationError);
    expect(() => buildR2PublicUrl('   ', 'seed/a.jpg')).toThrow(ValidationError);
  });
});

describe('isMissingObjectError', () => {
  it('recognises the S3 not-found shapes', () => {
    expect(isMissingObjectError({ name: 'NotFound' })).toBe(true);
    expect(isMissingObjectError({ name: 'NoSuchKey' })).toBe(true);
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isMissingObjectError(null)).toBe(false);
    expect(isMissingObjectError('NotFound')).toBe(false);
    expect(isMissingObjectError({ name: 'AccessDenied' })).toBe(false);
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 500 } })).toBe(false);
  });
});
