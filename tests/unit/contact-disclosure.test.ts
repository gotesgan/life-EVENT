import { describe, expect, it } from 'vitest';
import { deriveContactDisclosure, type ContactDisclosureInput } from '@/server/domain/contact';
import type { EnquiryStatusValue } from '@/server/domain/enquiry-status';
import { ALLOWED_TRANSITIONS } from '@/server/domain/enquiry-status';

/** Every channel configured, but each with its disclosure flag controlled. */
function listing(overrides: Partial<ContactDisclosureInput> = {}): ContactDisclosureInput {
  return {
    contactPhone: '+91 98765 43210',
    contactEmail: 'hello@business.test',
    contactWhatsapp: '+91 98765 43210',
    websiteUrl: 'https://business.test',
    showPhone: false,
    showEmail: false,
    showWhatsapp: false,
    showWebsite: false,
    ...overrides,
  };
}

const ALL_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHARED_WITH_PROVIDER',
  'CONVERTED',
  'LOST',
  'CANCELLED',
  'DUPLICATE',
  'SPAM',
] as const satisfies readonly EnquiryStatusValue[];

describe('published channels', () => {
  it('is always visible, even with no lead at all', () => {
    const result = deriveContactDisclosure(
      listing({ showPhone: true, showEmail: true, showWhatsapp: true, showWebsite: true }),
      null,
    );

    expect(result).toEqual({
      phone: '+91 98765 43210',
      email: 'hello@business.test',
      whatsapp: '+91 98765 43210',
      website: 'https://business.test',
      hasWithheldChannels: false,
    });
  });

  it('is visible at every status once published', () => {
    for (const status of ALL_STATUSES) {
      const result = deriveContactDisclosure(listing({ showPhone: true }), status);
      expect(result.phone).toBe('+91 98765 43210');
    }
  });

  it('returns null for a published channel with no value', () => {
    const result = deriveContactDisclosure(
      listing({
        contactPhone: null,
        contactEmail: null,
        contactWhatsapp: null,
        showPhone: true,
        showWebsite: true,
      }),
      null,
    );

    expect(result.phone).toBeNull();
    expect(result.website).toBe('https://business.test');
    expect(result.hasWithheldChannels).toBe(false);
  });
});

describe('private channels without a shared lead', () => {
  it('hides every private channel when there is no lead', () => {
    const result = deriveContactDisclosure(listing(), null);

    expect(result).toEqual({
      phone: null,
      email: null,
      whatsapp: null,
      website: null,
      hasWithheldChannels: true,
    });
  });

  it.each(['NEW', 'CONTACTED', 'QUALIFIED'] as const)(
    'stays hidden while the lead is %s',
    (status) => {
      const result = deriveContactDisclosure(listing(), status);

      expect(result.phone).toBeNull();
      expect(result.email).toBeNull();
      expect(result.whatsapp).toBeNull();
      expect(result.website).toBeNull();
      expect(result.hasWithheldChannels).toBe(true);
    },
  );

  it.each(['LOST', 'CANCELLED', 'DUPLICATE', 'SPAM'] as const)(
    'stays hidden after the lead closed as %s without ever being shared',
    (status) => {
      const result = deriveContactDisclosure(listing(), status);
      expect(result.phone).toBeNull();
      expect(result.hasWithheldChannels).toBe(true);
    },
  );
});

describe('private channels once the lead is shared', () => {
  it.each(['SHARED_WITH_PROVIDER', 'CONVERTED'] as const)('is revealed at %s', (status) => {
    const result = deriveContactDisclosure(listing(), status);

    expect(result).toEqual({
      phone: '+91 98765 43210',
      email: 'hello@business.test',
      whatsapp: '+91 98765 43210',
      website: 'https://business.test',
      hasWithheldChannels: false,
    });
  });

  it('releases only the channels that were configured', () => {
    const result = deriveContactDisclosure(
      listing({ contactEmail: null, contactWhatsapp: null, websiteUrl: null }),
      'SHARED_WITH_PROVIDER',
    );

    expect(result.phone).toBe('+91 98765 43210');
    expect(result.email).toBeNull();
    expect(result.hasWithheldChannels).toBe(false);
  });

  it('mixes published and private channels correctly before sharing', () => {
    const result = deriveContactDisclosure(
      listing({ showPhone: true, showWebsite: true }),
      'QUALIFIED',
    );

    expect(result.phone).toBe('+91 98765 43210');
    expect(result.website).toBe('https://business.test');
    expect(result.email).toBeNull();
    expect(result.whatsapp).toBeNull();
    expect(result.hasWithheldChannels).toBe(true);
  });
});

describe('hasWithheldChannels', () => {
  it('is false when nothing private is configured', () => {
    const result = deriveContactDisclosure(
      listing({ showPhone: true, showEmail: true, showWhatsapp: true, showWebsite: true }),
      'NEW',
    );
    expect(result.hasWithheldChannels).toBe(false);
  });

  it('is false when the private channel has no value to withhold', () => {
    const result = deriveContactDisclosure(
      listing({ contactPhone: null, contactEmail: null, contactWhatsapp: null, websiteUrl: null }),
      'NEW',
    );
    expect(result.hasWithheldChannels).toBe(false);
  });

  it('is true only until the lead is shared', () => {
    expect(deriveContactDisclosure(listing(), 'NEW').hasWithheldChannels).toBe(true);
    expect(deriveContactDisclosure(listing(), 'SHARED_WITH_PROVIDER').hasWithheldChannels).toBe(
      false,
    );
    expect(deriveContactDisclosure(listing(), 'CONVERTED').hasWithheldChannels).toBe(false);
  });

  it('treats CONVERTED as provider-shared even though it has no outgoing transition', () => {
    expect(ALLOWED_TRANSITIONS.CONVERTED).toEqual([]);
    expect(deriveContactDisclosure(listing(), 'CONVERTED').phone).toBe('+91 98765 43210');
  });
});
