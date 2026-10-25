import 'server-only';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getServerEnv } from '@/lib/env';
import { buildPaginated } from '@/lib/pagination';
import type { AdminVendorApplicationQuery } from '@/lib/validation/vendor-application';
import type { CreateVendorApplicationInput } from '@/lib/validation/vendor-application';
import { hashIp, normalisePhone } from '@/server/domain/contact';
import { enforceRateLimit } from '@/server/services/rate-limit.service';

export interface VendorApplicationContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface VendorApplicationResult {
  /** Always true for an honest submission; a tripped honeypot is indistinguishable. */
  accepted: boolean;
}

/**
 * Publishes a fake-but-plausible acceptance, so a bot cannot tell it was caught.
 * Kept as a constant so the route and the service cannot drift.
 */
const ACCEPTED: VendorApplicationResult = { accepted: true };

/**
 * Records a business's request to be listed.
 *
 * Order of operations mirrors the enquiry service for the same reason: refuse
 * abuse before doing work, then resolve the catalogue reference, then write.
 *
 * The `vendorType` is a category **slug**, resolved here rather than trusted from
 * the body. An applicant can only choose a type that exists in the catalogue, so
 * an accepted application always points at something the back office can action
 * without a manual lookup.
 */
export async function createVendorApplication(
  input: CreateVendorApplicationInput,
  context: VendorApplicationContext,
): Promise<VendorApplicationResult> {
  const env = getServerEnv();
  const ipHash = hashIp(context.ipAddress, env.IP_HASH_SALT);

  await enforceRateLimit(
    {
      key: `vendor-application:ip:${ipHash ?? 'unknown'}`,
      limit: 5,
      windowSeconds: 60 * 60,
    },
    'You have already sent several applications. Please try again later.',
  );

  // Honeypot: accept and move on without storing anything.
  if ((input.companyWebsite ?? '').length > 0) return ACCEPTED;

  const category = await prisma.category.findUnique({
    where: { slug: input.vendorType },
    select: { slug: true },
  });
  if (!category) {
    throw new ValidationError('Choose a vendor type from the list', {
      fieldErrors: { vendorType: ['Choose a vendor type from the list'] },
    });
  }

  await prisma.vendorApplication.create({
    data: {
      businessName: input.businessName,
      vendorType: category.slug,
      contactPhone: input.contactPhone,
      contactPhoneNormalised: normalisePhone(input.contactPhone),
      description: input.description,
      ipHash,
      userAgent: context.userAgent,
    },
  });

  return ACCEPTED;
}

// ---------------------------------------------------------------------------
// Back office
// ---------------------------------------------------------------------------

export interface AdminVendorApplicationRow {
  id: string;
  businessName: string;
  vendorType: string;
  contactPhone: string;
  description: string;
  status: 'NEW' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export async function adminListVendorApplications(query: AdminVendorApplicationQuery) {
  const { status, q } = query;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { businessName: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
            { contactPhoneNormalised: { contains: q.replace(/\D/g, '') } },
          ],
        }
      : {}),
  };

  const page = 1;
  const pageSize = 100;

  const [rows, totalItems] = await Promise.all([
    prisma.vendorApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      select: {
        id: true,
        businessName: true,
        vendorType: true,
        contactPhone: true,
        description: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    prisma.vendorApplication.count({ where }),
  ]);

  return buildPaginated(rows, totalItems, page, pageSize);
}

export async function adminSetVendorApplicationStatus(
  id: string,
  status: AdminVendorApplicationRow['status'],
  note: string | null,
): Promise<void> {
  const existing = await prisma.vendorApplication.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('That application does not exist');

  await prisma.vendorApplication.update({
    where: { id },
    data: {
      status,
      reviewNote: note,
      reviewedAt: status === 'NEW' ? null : new Date(),
    },
  });
}
