import { describe, expect, it } from 'vitest';
import {
  areSameContact,
  generateReferenceCode,
  hashIp,
  hashPayload,
  normaliseEmail,
  normalisePhone,
  stableStringify,
} from '@/server/domain/contact';

describe('normaliseEmail', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Arjun.Mehta@Example.TEST  ')).toBe('arjun.mehta@example.test');
  });

  it('is idempotent', () => {
    const once = normaliseEmail('  Foo@Bar.COM ');
    expect(normaliseEmail(once)).toBe(once);
  });
});

describe('normalisePhone', () => {
  it('collapses the Indian formatting variants to the same digit tail', () => {
    const variants = ['+91 98765 43210', '098765-43210', '98 7654 3210', '9876543210'];
    for (const variant of variants) {
      expect(normalisePhone(variant)).toBe('9876543210');
    }
  });

  it('keeps the last ten digits when the number is longer', () => {
    expect(normalisePhone('+91 (0) 98765-43210')).toBe('9876543210');
    expect(normalisePhone('0091 9876543210')).toBe('9876543210');
  });

  it('leaves a short number untouched rather than padding or truncating it', () => {
    expect(normalisePhone('12345')).toBe('12345');
    expect(normalisePhone('+1 (415) 555')).toBe('1415555');
  });

  it('returns an empty string when there are no digits', () => {
    expect(normalisePhone('not a number')).toBe('');
  });
});

describe('areSameContact', () => {
  it('matches on email case-insensitively', () => {
    expect(areSameContact({ email: 'Arjun@Example.test' }, { email: 'arjun@example.test' })).toBe(
      true,
    );
  });

  it('matches on a normalised phone even when the formatting differs', () => {
    expect(
      areSameContact(
        { email: 'a@example.test', phone: '+91 98765 43210' },
        { email: 'b@example.test', phone: '9876543210' },
      ),
    ).toBe(true);
  });

  it('returns false when neither email nor phone match', () => {
    expect(
      areSameContact(
        { email: 'a@example.test', phone: '9876543210' },
        { email: 'b@example.test', phone: '9000000000' },
      ),
    ).toBe(false);
  });

  it('returns false for empty or missing inputs', () => {
    expect(areSameContact({}, {})).toBe(false);
    expect(areSameContact({ email: null, phone: null }, { email: null, phone: null })).toBe(false);
    expect(areSameContact({ email: 'a@example.test' }, { email: null })).toBe(false);
  });

  it('does not treat two short phone numbers as a match', () => {
    expect(areSameContact({ phone: '12345' }, { phone: '12345' })).toBe(false);
  });
});

describe('hashIp', () => {
  it('is deterministic for the same ip and salt', () => {
    expect(hashIp('203.0.113.7', 'salt-a')).toBe(hashIp('203.0.113.7', 'salt-a'));
  });

  it('changes with the salt', () => {
    expect(hashIp('203.0.113.7', 'salt-a')).not.toBe(hashIp('203.0.113.7', 'salt-b'));
  });

  it('returns null for empty, null and undefined input', () => {
    expect(hashIp('', 'salt')).toBeNull();
    expect(hashIp(null, 'salt')).toBeNull();
    expect(hashIp(undefined, 'salt')).toBeNull();
  });

  it('never returns the raw IP address', () => {
    const hashed = hashIp('203.0.113.7', 'salt-a');
    expect(hashed).not.toBeNull();
    expect(hashed).not.toContain('203.0.113.7');
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('stableStringify', () => {
  it('is independent of object key order', () => {
    const a = { alpha: 1, beta: 2, gamma: 3 };
    const b = { gamma: 3, alpha: 1, beta: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('is stable for nested objects and arrays', () => {
    const a = { outer: { z: 1, a: 2 }, list: [1, 2, 3] };
    const b = { list: [1, 2, 3], outer: { a: 2, z: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('is order-sensitive for arrays, because order carries meaning', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('drops undefined properties but keeps null', () => {
    expect(stableStringify({ a: undefined, b: null })).toBe(stableStringify({ b: null }));
  });
});

describe('hashPayload', () => {
  it('hashes differently-ordered payloads to the same value', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(hashPayload(a)).toBe(hashPayload(b));
  });

  it('hashes different payloads to different values', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('produces a 64-character hex digest', () => {
    expect(hashPayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateReferenceCode', () => {
  it('matches the documented LE-XXXXXXXX format without ambiguous characters', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateReferenceCode()).toMatch(/^LE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('never emits the ambiguous characters 0, 1, I or O', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateReferenceCode().slice(3)).not.toMatch(/[01IO]/);
    }
  });

  it('is unique across 500 calls', () => {
    const codes = new Set<string>();
    for (let index = 0; index < 500; index += 1) {
      codes.add(generateReferenceCode());
    }
    expect(codes.size).toBe(500);
  });
});
