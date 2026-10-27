import 'server-only';
import { prisma } from '@/lib/db';
import { generateOpaqueToken, sha256Hex } from '@/lib/crypto';
import { getAdminUrl, getAppUrl } from '@/lib/env';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { disambiguateSlug, slugify } from '@/lib/slug';
import type { VendorOnboardingInput } from '@/lib/validation/vendor-invite';
import { normalisePhone, hashIp } from '@/server/domain/contact';
import { recordAudit } from './audit.service';
import { sendEmail } from './email.service';
import { vendorOnboardingSubmittedEmail } from './email-templates';
import {
  sendVendorApplicationDecisionEmail,
  sendVendorInviteEmail,
} from './email-notification.port';
import { refreshListingSearchText } from './listing-search-text';
import { enforceRateLimit } from './rate-limit.service';
import { getServerEnv } from '@/lib/env';

/**
 * Vendor onboarding invites.
 *
 * The business fills in its own listing details from a private link — no account,
 * no password, no support email ping-pong. The properties that make the link
 * safe:
 *
 *  - **Only the hash is stored.** A database leak cannot mint links.
 *  - **Single use.** Submitting marks the invite `SUBMITTED`; it cannot be
 *    replayed, and a second submit is refused.
 *  - **Expiring.** Fourteen days, then `EXPIRED` on the next visit.
 *  - **Revocable.** The back office can kill an invite at any time.
 *
 * Approval creates a **draft** listing, never a published one: the team still
 * reviews prices, media and wording in the existing listing editor before it
 * goes live.
 */

const INVITE_TTL_DAYS = 14;

export interface VendorInviteRow {
  id: string;
  email: string | null;
  status: 'SENT' | 'OPENED' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: Date;
  createdAt: Date;
  applicationId: string | null;
  applicationName: string | null;
}

export interface CreatedVendorInvite {
  id: string;
  /** Returned exactly once — the caller shows it and never stores it. */
  link: string;
  expiresAt: Date;
  emailSent: boolean;
}

function buildInviteLink(rawToken: string): string {
  return `${getAppUrl()}/vendors/onboard?t=${encodeURIComponent(rawToken)}`;
}

function inviteExpired(row: { expiresAt: Date }): boolean {
  return row.expiresAt.getTime() < Date.now();
}

export async function createVendorInvite(
  input: { email?: string | null; applicationId?: string | null },
  actor: { id: string; name: string },
): Promise<CreatedVendorInvite> {
  let application: { id: string; businessName: string; contactEmail: string | null } | null = null;

  if (input.applicationId) {
    application = await prisma.vendorApplication.findUnique({
      where: { id: input.applicationId },
      select: { id: true, businessName: true, contactEmail: true },
    });
    if (!application) throw new NotFoundError('That application does not exist');
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const email = input.email?.trim() || application?.contactEmail || null;

  const invite = await prisma.vendorInvite.create({
    data: {
      tokenHash,
      email,
      applicationId: application?.id ?? null,
      expiresAt,
      createdById: actor.id,
    },
  });

  const link = buildInviteLink(rawToken);

  await recordAudit({
    action: 'vendor_invite.created',
    entityType: 'vendor_invite',
    entityId: invite.id,
    summary: `Created onboarding invite${application ? ` for ${application.businessName}` : ''}`,
    metadata: { applicationId: application?.id ?? null, email },
    context: { actorUserId: actor.id, actorName: actor.name },
  });

  if (email) {
    await sendVendorInviteEmail({ to: email, link, expiresAt });
  }

  return { id: invite.id, link, expiresAt, emailSent: Boolean(email) };
}

export async function adminListVendorInvites(limit = 25): Promise<VendorInviteRow[]> {
  const rows = await prisma.vendorInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      applicationId: true,
    },
  });

  const applicationIds = rows
    .map((row) => row.applicationId)
    .filter((id): id is string => Boolean(id));
  const applications = applicationIds.length
    ? await prisma.vendorApplication.findMany({
        where: { id: { in: applicationIds } },
        select: { id: true, businessName: true },
      })
    : [];
  const names = new Map(applications.map((row) => [row.id, row.businessName]));

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    status: inviteExpired(row) && row.status !== 'SUBMITTED' ? 'EXPIRED' : row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    applicationId: row.applicationId,
    applicationName: row.applicationId ? (names.get(row.applicationId) ?? null) : null,
  }));
}

export async function revokeVendorInvite(
  id: string,
  actor: { id: string; name: string },
): Promise<void> {
  const invite = await prisma.vendorInvite.findUnique({ where: { id } });
  if (!invite) throw new NotFoundError('That invite does not exist');

  await prisma.vendorInvite.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  await recordAudit({
    action: 'vendor_invite.revoked',
    entityType: 'vendor_invite',
    entityId: id,
    summary: 'Revoked a vendor onboarding invite',
    context: { actorUserId: actor.id, actorName: actor.name },
  });
}

export type InviteResolution =
  | {
      state: 'valid';
      inviteId: string;
      applicationId: string | null;
      businessName: string | null;
      email: string | null;
      expiresAt: Date;
    }
  | { state: 'invalid' }
  | { state: 'expired' }
  | { state: 'revoked' }
  | { state: 'submitted' };

export async function resolveVendorInvite(rawToken: string): Promise<InviteResolution> {
  const invite = await prisma.vendorInvite.findUnique({
    where: { tokenHash: sha256Hex(rawToken) },
  });

  if (!invite) return { state: 'invalid' };

  const application = invite.applicationId
    ? await prisma.vendorApplication.findUnique({
        where: { id: invite.applicationId },
        select: { businessName: true },
      })
    : null;
  if (invite.status === 'REVOKED') return { state: 'revoked' };
  if (invite.status === 'SUBMITTED') return { state: 'submitted' };
  if (inviteExpired(invite)) return { state: 'expired' };

  /* Opening the form is recorded once; the token remains valid for submission. */
  if (invite.status === 'SENT') {
    await prisma.vendorInvite.update({
      where: { id: invite.id },
      data: { status: 'OPENED', openedAt: new Date() },
    });
  }

  return {
    state: 'valid',
    inviteId: invite.id,
    applicationId: invite.applicationId,
    businessName: application?.businessName ?? null,
    email: invite.email,
    expiresAt: invite.expiresAt,
  };
}

export interface SubmitOnboardingResult {
  accepted: boolean;
  applicationId?: string;
}

export async function submitVendorOnboarding(
  input: VendorOnboardingInput,
  context: { ipAddress: string | null; userAgent: string | null },
): Promise<SubmitOnboardingResult> {
  const env = getServerEnv();
  const ipHash = hashIp(context.ipAddress, env.IP_HASH_SALT);

  await enforceRateLimit(
    { key: `vendor-onboarding:ip:${ipHash ?? 'unknown'}`, limit: 10, windowSeconds: 60 * 60 },
    'Too many attempts from this connection. Please try again later.',
  );

  /* Same honeypot contract as the public form: pretend success, store nothing. */
  if ((input.companyWebsite ?? '').length > 0) return { accepted: true };

  const invite = await prisma.vendorInvite.findUnique({
    where: { tokenHash: sha256Hex(input.token) },
  });
  if (!invite) throw new NotFoundError('This link is not valid');
  if (invite.status === 'SUBMITTED')
    throw new ValidationError('This form has already been submitted');
  if (invite.status === 'REVOKED') throw new ValidationError('This link has been revoked');
  if (inviteExpired(invite)) throw new ValidationError('This link has expired');

  const [category, city] = await Promise.all([
    prisma.category.findUnique({ where: { slug: input.vendorType }, select: { slug: true } }),
    prisma.location.findUnique({ where: { slug: input.citySlug }, select: { slug: true } }),
  ]);
  if (!category) throw new ValidationError('Choose a vendor type from the list');
  if (!city) throw new ValidationError('Choose a city from the list');

  const payload = {
    businessName: input.businessName,
    vendorType: category.slug,
    citySlug: city.slug,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactPhoneNormalised: normalisePhone(input.contactPhone),
    contactEmail: input.contactEmail,
    websiteUrl: input.websiteUrl || null,
    description: input.description,
    source: 'INVITE' as const,
    submitted: {
      businessName: input.businessName,
      vendorType: category.slug,
      citySlug: city.slug,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      websiteUrl: input.websiteUrl,
      description: input.description,
      submittedAt: new Date().toISOString(),
    },
  };

  const application = await prisma.$transaction(async (tx) => {
    const saved = invite.applicationId
      ? await tx.vendorApplication.update({
          where: { id: invite.applicationId },
          data: { ...payload, status: 'NEW' },
        })
      : await tx.vendorApplication.create({ data: payload });

    await tx.vendorInvite.update({
      where: { id: invite.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        openedAt: invite.openedAt ?? new Date(),
      },
    });

    return saved;
  });

  await recordAudit({
    action: 'vendor_invite.submitted',
    entityType: 'vendor_application',
    entityId: application.id,
    summary: `Vendor details submitted by ${application.businessName}`,
    context: { ipHash, userAgent: context.userAgent },
  });

  const adminBase = getAdminUrl() ?? getAppUrl();
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { email: true },
    take: 10,
  });
  const recipients = new Set<string>();
  if (env.ADMIN_NOTIFICATION_EMAIL) recipients.add(env.ADMIN_NOTIFICATION_EMAIL);
  for (const admin of admins) if (admin.email) recipients.add(admin.email);

  await Promise.all(
    [...recipients].map((email) =>
      sendEmail({
        to: email,
        template: 'vendor_onboarding_submitted',
        ...vendorOnboardingSubmittedEmail({
          businessName: application.businessName,
          applicationId: application.id,
          adminUrl: adminBase,
        }),
      }),
    ),
  );

  return { accepted: true, applicationId: application.id };
}

// ---------------------------------------------------------------------------
// Approval → draft listing
// ---------------------------------------------------------------------------

/**
 * Turns an approved application into a DRAFT listing.
 *
 * The draft carries only what the application actually contains: identity,
 * category, city, contact and description. Prices, media and attributes stay
 * for the team to fill in the listing editor — the point is that an approved
 * vendor stops being a row in an inbox and becomes a real listing object the
 * existing tools can finish.
 */
export async function approveVendorApplicationToListing(
  input: { id: string; citySlug: string },
  actor: { id: string; name: string },
): Promise<{ listingId: string }> {
  const application = await prisma.vendorApplication.findUnique({ where: { id: input.id } });
  if (!application) throw new NotFoundError('That application does not exist');
  if (application.listingId) {
    throw new ValidationError('This application already has a listing draft');
  }

  const [category, city] = await Promise.all([
    prisma.category.findUnique({
      where: { slug: application.vendorType },
      select: { id: true },
    }),
    prisma.location.findUnique({
      where: { slug: input.citySlug },
      select: { id: true },
    }),
  ]);
  if (!category)
    throw new ValidationError('The chosen vendor type no longer exists in the catalogue');
  if (!city) throw new ValidationError('Choose a city from the list');

  const base = slugify(application.businessName) || 'business';
  const existing = await prisma.businessListing.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slug = disambiguateSlug(base, new Set(existing.map((row) => row.slug)));

  const listingId = await prisma.$transaction(async (tx) => {
    const listing = await tx.businessListing.create({
      data: {
        slug,
        name: application.businessName,
        description: application.description,
        primaryCategoryId: category.id,
        primaryLocationId: city.id,
        contactPersonName: application.contactName ?? null,
        contactPhone: application.contactPhone,
        contactEmail: application.contactEmail ?? null,
        websiteUrl: application.websiteUrl ?? null,
        publicationStatus: 'DRAFT',
        createdById: actor.id,
      },
      select: { id: true },
    });

    await tx.vendorApplication.update({
      where: { id: application.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewNote: 'Approved — draft listing created',
        listingId: listing.id,
      },
    });

    await refreshListingSearchText(listing.id, tx);
    return listing.id;
  });

  await recordAudit({
    action: 'vendor_application.approved_to_listing',
    entityType: 'vendor_application',
    entityId: application.id,
    summary: `Approved ${application.businessName} and created listing draft`,
    metadata: { listingId },
    context: { actorUserId: actor.id, actorName: actor.name },
  });

  if (application.contactEmail) {
    await sendVendorApplicationDecisionEmail({
      to: application.contactEmail,
      businessName: application.businessName,
      approved: true,
      note: 'The team will finish the listing and publish it shortly.',
    });
  }

  return { listingId };
}
