import { describe, expect, it } from 'vitest';
import {
  formatCapacityRange,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPriceRange,
  formatPriceUnit,
  maskEmail,
  pluralise,
  truncate,
} from '@/lib/format';

describe('formatPriceRange', () => {
  it('renders a min and a max as a range', () => {
    expect(formatPriceRange({ priceMin: 50_000, priceMax: 100_000, priceUnit: null })).toBe(
      '₹50,000 – ₹1,00,000',
    );
  });

  it('appends the price unit when one is set', () => {
    expect(formatPriceRange({ priceMin: 1_200, priceMax: 4_200, priceUnit: 'PER_PLATE' })).toBe(
      '₹1,200 – ₹4,200 per plate',
    );
  });

  it('renders a min only with a From prefix', () => {
    expect(formatPriceRange({ priceMin: 50_000, priceMax: null, priceUnit: null })).toBe(
      'From ₹50,000',
    );
    expect(formatPriceRange({ priceMin: 50_000, priceMax: null, priceUnit: 'PER_EVENT' })).toBe(
      'From ₹50,000 per event',
    );
  });

  it('renders a max only with an Up to prefix', () => {
    expect(formatPriceRange({ priceMin: null, priceMax: 100_000, priceUnit: null })).toBe(
      'Up to ₹1,00,000',
    );
  });

  it('collapses equal bounds into a single price rather than a struck-through-looking range', () => {
    expect(formatPriceRange({ priceMin: 50_000, priceMax: 50_000, priceUnit: null })).toBe(
      '₹50,000',
    );
  });

  it('returns null instead of a fabricated ₹0 when both bounds are unknown', () => {
    expect(formatPriceRange({ priceMin: null, priceMax: null, priceUnit: null })).toBeNull();
    expect(formatPriceRange({ priceMin: null, priceMax: null, priceUnit: 'PER_DAY' })).toBeNull();
  });

  it('treats zero and negative bounds as unknown, not as a real price', () => {
    expect(formatPriceRange({ priceMin: 0, priceMax: null, priceUnit: null })).toBeNull();
    expect(formatPriceRange({ priceMin: null, priceMax: 0, priceUnit: null })).toBeNull();
    expect(formatPriceRange({ priceMin: 0, priceMax: 0, priceUnit: null })).toBeNull();
    expect(formatPriceRange({ priceMin: -100, priceMax: null, priceUnit: null })).toBeNull();
    expect(formatPriceRange({ priceMin: 0, priceMax: 100, priceUnit: null })).toBe('Up to ₹100');
  });

  it('ignores an unrecognised unit instead of printing it', () => {
    expect(formatPriceRange({ priceMin: 100, priceMax: null, priceUnit: 'PER_FORTNIGHT' })).toBe(
      'From ₹100',
    );
  });
});

describe('formatPriceUnit', () => {
  it('maps every known unit and returns null for unknown or missing ones', () => {
    expect(formatPriceUnit('PER_PERSON')).toBe('per person');
    expect(formatPriceUnit('PER_HOUR')).toBe('per hour');
    expect(formatPriceUnit(null)).toBeNull();
    expect(formatPriceUnit(undefined)).toBeNull();
  });
});

describe('formatCapacityRange', () => {
  it('renders a differing min and max as a range', () => {
    expect(formatCapacityRange(100, 200)).toBe('100–200 guests');
  });

  it('renders a max only as Up to, including when min equals max', () => {
    expect(formatCapacityRange(null, 200)).toBe('Up to 200 guests');
    expect(formatCapacityRange(200, 200)).toBe('Up to 200 guests');
  });

  it('renders a min only as From', () => {
    expect(formatCapacityRange(100, null)).toBe('From 100 guests');
    expect(formatCapacityRange(100, 0)).toBe('From 100 guests');
  });

  it('returns null when nothing usable is known', () => {
    expect(formatCapacityRange(null, null)).toBeNull();
    expect(formatCapacityRange(0, 0)).toBeNull();
    expect(formatCapacityRange(0, null)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats a Date in UTC with a short month', () => {
    expect(formatDate(new Date('2026-01-01T00:00:00.000Z'))).toBe('1 Jan 2026');
    expect(formatDate(new Date('2026-12-15T23:30:00.000Z'))).toBe('15 Dec 2026');
  });

  it('formats an ISO string', () => {
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('1 Jan 2026');
  });

  it('returns null for invalid, empty and missing input', () => {
    expect(formatDate('not-a-date')).toBeNull();
    expect(formatDate(new Date('nonsense'))).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('appends the UTC time to the date', () => {
    expect(formatDateTime(new Date('2026-01-01T09:05:00.000Z'))).toBe('1 Jan 2026, 9:05 am');
  });

  it('returns null when the date is invalid', () => {
    expect(formatDateTime('not-a-date')).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('formats whole rupees with Indian digit grouping', () => {
    expect(formatCurrency(50_000)).toBe('₹50,000');
    expect(formatCurrency(1_00_00_000)).toBe('₹1,00,00,000');
  });

  it('rounds away fractional rupees', () => {
    expect(formatCurrency(1_200.6)).toBe('₹1,201');
  });
});

describe('truncate', () => {
  it('returns short text unchanged with no ellipsis', () => {
    expect(truncate('Short', 10)).toBe('Short');
    expect(truncate('ExactlyTen', 10)).toBe('ExactlyTen');
  });

  it('cuts at a word boundary when one is close enough to the limit', () => {
    expect(truncate('The quick brown fox jumps', 12)).toBe('The quick…');
    expect(truncate('Hello world again', 8)).toBe('Hello…');
  });

  it('hard-cuts a single long word rather than returning an empty string', () => {
    expect(truncate('Supercalifragilisticexpialidocious', 10)).toBe('Supercalif…');
  });

  it('never leaves a space before the ellipsis', () => {
    expect(truncate('Hello world again', 8)).not.toMatch(/ …$/);
  });

  it('always appends exactly one ellipsis when it truncates', () => {
    const result = truncate('The quick brown fox jumps', 12);
    expect(result.endsWith('…')).toBe(true);
    expect(result.endsWith('……')).toBe(false);
  });
});

describe('pluralise', () => {
  it('uses the singular for exactly one and the plural otherwise', () => {
    expect(pluralise(1, 'guest')).toBe('guest');
    expect(pluralise(0, 'guest')).toBe('guests');
    expect(pluralise(2, 'guest')).toBe('guests');
  });

  it('honours an explicit irregular plural', () => {
    expect(pluralise(1, 'child', 'children')).toBe('child');
    expect(pluralise(3, 'child', 'children')).toBe('children');
  });
});

describe('maskEmail', () => {
  it('keeps the first local character and the whole domain', () => {
    expect(maskEmail('arjun.mehta@example.test')).toBe('a**********@example.test');
  });

  it('still masks a single-character local part', () => {
    expect(maskEmail('a@b.com')).toBe('a*@b.com');
    expect(maskEmail('@example.com')).toBe('*@example.com');
  });

  it('returns a placeholder when there is no domain', () => {
    expect(maskEmail('notanemail')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });

  it('never reveals the full local part', () => {
    const masked = maskEmail('secretive@example.test');
    expect(masked).not.toContain('secretive');
    expect(masked).toContain('@example.test');
  });
});
