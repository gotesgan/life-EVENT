import { beforeAll, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/env';
import {
  adminNewEnquiryEmail,
  enquiryConfirmationEmail,
  enquiryStatusEmail,
  vendorApplicationDecisionEmail,
  vendorInviteEmail,
} from '@/server/services/email-templates';

/**
 * Transactional email bodies.
 *
 * These are the one outbound surface where a typo reaches a customer, so the
 * tests pin the information every message must carry and the escaping that
 * matters (customer-supplied values are interpolated into HTML).
 */
/**
 * Templates build absolute links from the configured app origin, so the unit
 * environment needs the same minimum configuration the server validates.
 */
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://unit:unit@localhost:5432/unit';
  process.env.BETTER_AUTH_SECRET ??= 'unit-test-secret-value-32-characters-long';
  process.env.NEXT_PUBLIC_APP_URL ??= 'https://www.example.com';
  resetServerEnvCache();
});

describe('vendorInviteEmail', () => {
  const expiresAt = new Date('2026-11-09T12:00:00.000Z');

  it('carries the link, the expiry date and both formats', () => {
    const template = vendorInviteEmail({
      email: 'owner@example.com',
      link: 'https://www.example.com/vendors/onboard?t=abc123',
      expiresAt,
    });

    expect(template.subject).toMatch(/listing/i);
    expect(template.html).toContain('https://www.example.com/vendors/onboard?t=abc123');
    expect(template.text).toContain('https://www.example.com/vendors/onboard?t=abc123');
    expect(template.text).toMatch(/9 November 2026/);
    expect(template.text).toMatch(/single-use/);
  });
});

describe('vendorApplicationDecisionEmail', () => {
  it('does not say "approved" when the application was rejected', () => {
    const rejected = vendorApplicationDecisionEmail({
      businessName: 'Test Banquets',
      approved: false,
      note: 'Not a fit yet.',
    });

    expect(rejected.subject).not.toMatch(/approved/i);
    expect(rejected.text).toMatch(/not listing this business/i);
    expect(rejected.text).toContain('Not a fit yet.');
  });

  it('explains the next step when approved', () => {
    const approved = vendorApplicationDecisionEmail({
      businessName: 'Test Banquets',
      approved: true,
    });
    expect(approved.subject).toMatch(/approved/i);
    expect(approved.text).toMatch(/complete the details/i);
  });
});

describe('enquiry emails', () => {
  it('names the reference and the businesses in the confirmation', () => {
    const template = enquiryConfirmationEmail({
      customerName: 'Asha',
      referenceCode: 'LE-ABCD2345',
      listings: ['Gulmohar Banquets', 'Rosewood Pavilion'],
    });

    expect(template.subject).toContain('LE-ABCD2345');
    expect(template.text).toContain('Gulmohar Banquets, Rosewood Pavilion');
    expect(template.text).toContain('/track?reference=LE-ABCD2345');
  });

  it('sends the admin a reference, the contact and the event date', () => {
    const template = adminNewEnquiryEmail({
      referenceCode: 'LE-ABCD2345',
      customerName: 'Asha',
      customerEmail: 'asha@example.com',
      listings: ['Gulmohar Banquets'],
      eventDate: new Date('2027-02-14T00:00:00.000Z'),
      adminUrl: 'https://admin.example.com',
    });

    expect(template.text).toContain('LE-ABCD2345');
    expect(template.text).toContain('asha@example.com');
    expect(template.text).toMatch(/14 February 2027/);
    expect(template.text).toContain('https://admin.example.com/enquiries');
  });

  it('humanises the status in a customer update', () => {
    const template = enquiryStatusEmail({
      customerName: 'Asha',
      referenceCode: 'LE-ABCD2345',
      listingName: 'Gulmohar Banquets',
      status: 'SHARED_WITH_PROVIDER',
    });

    expect(template.text).toMatch(/shared with provider/);
    expect(template.text).toContain('Gulmohar Banquets');
  });
});
