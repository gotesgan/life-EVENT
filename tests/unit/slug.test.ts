import { describe, expect, it } from 'vitest';
import { buildPath, disambiguateSlug, slugify } from '@/lib/slug';

describe('slugify', () => {
  it('strips diacritics rather than dropping the letters', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
    expect(slugify('Château Crème Brûlée')).toBe('chateau-creme-brulee');
  });

  it('expands an ampersand to the word "and"', () => {
    expect(slugify('Dhundh Floral & Decor')).toBe('dhundh-floral-and-decor');
    expect(slugify('R&D')).toBe('r-and-d');
  });

  it('drops apostrophes and other punctuation', () => {
    expect(slugify("Riya's Events!")).toBe('riyas-events');
    expect(slugify('The Grand (Sandalwood) — Grand')).toBe('the-grand-sandalwood-grand');
  });

  it('collapses repeated separators and trims leading/trailing dashes', () => {
    expect(slugify('--Hello -- World--')).toBe('hello-world');
    expect(slugify('a    b')).toBe('a-b');
  });

  it('lowercases and leaves an existing slug unchanged', () => {
    expect(slugify('banquet-halls')).toBe('banquet-halls');
    expect(slugify('Gulmohar Banjara Banquets')).toBe('gulmohar-banjara-banquets');
  });

  it('caps the result at 80 characters', () => {
    const slug = slugify('a'.repeat(200));
    expect(slug).toHaveLength(80);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('strips leading and trailing dashes on input that is not capped', () => {
    expect(slugify('  --A B--  ')).toBe('a-b');
    expect(slugify('word '.repeat(4))).toBe('word-word-word-word');
  });

  // Regression guard: the length cap must be applied BEFORE the final dash trim.
  // Capping afterwards can leave a trailing dash when the cut lands on a
  // separator, and such a slug fails `slugSchema` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`),
  it('does not leave a trailing dash after the length cap', () => {
    const slug = slugify('word '.repeat(40));
    // The cap is a maximum, not a target: trimming the dash that the cut
    // exposed can legitimately leave the result one character shorter.
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('returns an empty string for input with no usable characters', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});

describe('disambiguateSlug', () => {
  it('returns the base unchanged when it is free', () => {
    expect(disambiguateSlug('banquet-halls', new Set())).toBe('banquet-halls');
    expect(disambiguateSlug('banquet-halls', new Set(['other']))).toBe('banquet-halls');
  });

  it('appends -2 when the base is taken', () => {
    expect(disambiguateSlug('banquet-halls', new Set(['banquet-halls']))).toBe('banquet-halls-2');
  });

  it('progresses to -3, -4 when the lower suffixes are also taken', () => {
    const taken = new Set(['banquet-halls', 'banquet-halls-2']);
    expect(disambiguateSlug('banquet-halls', taken)).toBe('banquet-halls-3');

    taken.add('banquet-halls-3');
    expect(disambiguateSlug('banquet-halls', taken)).toBe('banquet-halls-4');
  });

  it('falls back to "item" when the base is empty', () => {
    expect(disambiguateSlug('', new Set())).toBe('item');
    expect(disambiguateSlug('', new Set(['item']))).toBe('item-2');
  });

  it('throws rather than returning a taken slug when the suffix space is exhausted', () => {
    const taken = new Set<string>(['clash']);
    for (let suffix = 2; suffix <= 1000; suffix += 1) taken.add(`clash-${suffix}`);

    expect(() => disambiguateSlug('clash', taken)).toThrow(/free slug/);
  });

  it('is pure: the same inputs give the same output', () => {
    const taken = new Set(['a', 'a-2']);
    expect(disambiguateSlug('a', taken)).toBe(disambiguateSlug('a', taken));
  });
});

describe('buildPath', () => {
  it('joins slugified segments with slashes', () => {
    expect(buildPath(['Maharashtra', 'Mumbai', 'Bandra West'])).toBe(
      'maharashtra/mumbai/bandra-west',
    );
  });

  it('slugifies each segment and drops empty ones', () => {
    expect(buildPath(['India', '', '  ', 'New Delhi'])).toBe('india/new-delhi');
  });

  it('returns an empty string for no usable segments', () => {
    expect(buildPath([])).toBe('');
    expect(buildPath(['!!!'])).toBe('');
  });
});
