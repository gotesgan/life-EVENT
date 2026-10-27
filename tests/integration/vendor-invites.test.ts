import { describe, expect, it, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import {
  approveVendorApplicationToListing,
  createVendorInvite,
  resolveVendorInvite,
  revokeVendorInvite,
  submitVendorOnboarding,
} from '@/server/services/vendor-invite.service';

/**
 * Vendor onboarding links, end to end against the real database.
 *
 * The properties that make the link safe are behavioural, not structural: only
 * a hash is stored, the link is single-use, it expires, it can be revoked, and
 * approval creates a *draft* listing rather than a published one. Those are
 * exactly the things a unit test with a mocked database would not catch.
 */
let actor: { id: string; name: string };

function tokenFrom(link: string): string {
  const token = new URL(link).searchParams.get('t');
  if (!token) throw new Error('expected an invite token in the link');
  return token;
}

const ONBOARDING = {
  businessName: 'Invite Lifecycle Venue',
  vendorType: 'banquet-halls',
  citySlug: 'pune',
  contactName: 'Asha Rao',
  contactPhone: '9876500011',
  contactEmail: 'invite-lifecycle@example.com',
  websiteUrl: '',
  description:
    'A banquet hall in Pune for 150 guests with in-house catering, parking and an air-conditioned hall for ceremonies.',
};

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  actor = admin;
});

describe('vendor invite lifecycle', () => {
  it('creates a link whose raw token is never stored', async () => {
    const invite = await createVendorInvite({ email: 'vendor@example.com' }, actor);
    const token = tokenFrom(invite.link);

    const row = await prisma.vendorInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(row.tokenHash).not.toContain(token);
    expect(row.tokenHash).toHaveLength(64);
    expect(row.status).toBe('SENT');
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('resolves, submits and marks the link submitted', async () => {
    const invite = await createVendorInvite({ email: 'vendor@example.com' }, actor);
    const token = tokenFrom(invite.link);

    await expect(resolveVendorInvite(token)).resolves.toMatchObject({ state: 'valid' });

    const result = await submitVendorOnboarding(
      { ...ONBOARDING, token, companyWebsite: undefined },
      { ipAddress: '203.0.113.5', userAgent: 'vitest' },
    );
    expect(result.accepted).toBe(true);
    expect(result.applicationId).toBeTruthy();

    const application = await prisma.vendorApplication.findUniqueOrThrow({
      where: { id: result.applicationId },
    });
    expect(application.source).toBe('INVITE');
    expect(application.businessName).toBe(ONBOARDING.businessName);
    expect(application.contactEmail).toBe(ONBOARDING.contactEmail);
    expect(application.citySlug).toBe('pune');
    expect(application.contactPhoneNormalised).toBe('9876500011');

    await expect(resolveVendorInvite(token)).resolves.toMatchObject({ state: 'submitted' });

    // The email seam records the admin notification instead of losing it.
    const logged = await prisma.emailLog.count({
      where: { template: 'vendor_onboarding_submitted' },
    });
    expect(logged).toBeGreaterThan(0);
  });

  it('refuses a second submission of the same link', async () => {
    const invite = await createVendorInvite({ email: 'second@example.com' }, actor);
    const token = tokenFrom(invite.link);

    await submitVendorOnboarding(
      { ...ONBOARDING, token, contactEmail: 'second@example.com', companyWebsite: undefined },
      { ipAddress: '203.0.113.6', userAgent: 'vitest' },
    );

    await expect(
      submitVendorOnboarding(
        { ...ONBOARDING, token, contactEmail: 'second@example.com', companyWebsite: undefined },
        { ipAddress: '203.0.113.6', userAgent: 'vitest' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports an expired link and refuses to submit through it', async () => {
    const invite = await createVendorInvite({ email: 'expired@example.com' }, actor);
    const token = tokenFrom(invite.link);

    await prisma.vendorInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(resolveVendorInvite(token)).resolves.toMatchObject({ state: 'expired' });
    await expect(
      submitVendorOnboarding(
        { ...ONBOARDING, token, companyWebsite: undefined },
        { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports a revoked link and refuses to submit through it', async () => {
    const invite = await createVendorInvite({ email: 'revoked@example.com' }, actor);
    const token = tokenFrom(invite.link);

    await revokeVendorInvite(invite.id, actor);

    await expect(resolveVendorInvite(token)).resolves.toMatchObject({ state: 'revoked' });
    await expect(
      submitVendorOnboarding(
        { ...ONBOARDING, token, companyWebsite: undefined },
        { ipAddress: '203.0.113.8', userAgent: 'vitest' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('approves an application into a draft listing exactly once', async () => {
    const invite = await createVendorInvite({ email: 'approve@example.com' }, actor);
    const token = tokenFrom(invite.link);
    const result = await submitVendorOnboarding(
      {
        ...ONBOARDING,
        token,
        businessName: 'Approval Test Banquets',
        contactEmail: 'approve@example.com',
        companyWebsite: undefined,
      },
      { ipAddress: '203.0.113.9', userAgent: 'vitest' },
    );
    const applicationId = result.applicationId!;

    const approved = await approveVendorApplicationToListing(
      { id: applicationId, citySlug: 'pune' },
      actor,
    );

    const listing = await prisma.businessListing.findUniqueOrThrow({
      where: { id: approved.listingId },
      include: { primaryCategory: true, primaryLocation: true },
    });
    expect(listing.publicationStatus).toBe('DRAFT');
    expect(listing.name).toBe('Approval Test Banquets');
    expect(listing.primaryCategory.slug).toBe('banquet-halls');
    expect(listing.primaryLocation.slug).toBe('pune');
    expect(listing.contactEmail).toBe('approve@example.com');

    const application = await prisma.vendorApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(application.status).toBe('APPROVED');
    expect(application.listingId).toBe(approved.listingId);

    // A second approval would duplicate the business; the listing link prevents it.
    await expect(
      approveVendorApplicationToListing({ id: applicationId, citySlug: 'pune' }, actor),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
