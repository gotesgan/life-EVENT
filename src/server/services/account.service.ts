import 'server-only';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CustomerProfileUpdateInput } from '@/lib/validation/account';

/**
 * Customer account reads and updates.
 *
 * Deliberately narrow: email, role and status are not writable here. Changing
 * an email requires a verification flow the MVP does not ship, and role/status
 * are administrator-owned — accepting them from a customer request would let a
 * customer change their identity or grant themselves permissions.
 */
export async function getAccountOverview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      profile: {
        select: {
          phone: true,
          preferredContactMethod: true,
          marketingConsent: true,
          city: { select: { slug: true, name: true, type: true } },
        },
      },
      _count: { select: { enquiries: true } },
    },
  });

  if (!user) throw new NotFoundError('Account');

  const [activeEnquiries, completedEnquiries] = await Promise.all([
    prisma.enquiry.count({
      where: {
        customerUserId: userId,
        status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'SHARED_WITH_PROVIDER'] },
      },
    }),
    prisma.enquiry.count({
      where: { customerUserId: userId, status: { in: ['CONVERTED', 'LOST', 'CANCELLED'] } },
    }),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      memberSince: user.createdAt,
    },
    profile: {
      phone: user.profile?.phone ?? null,
      preferredContactMethod: user.profile?.preferredContactMethod ?? 'EMAIL',
      marketingConsent: user.profile?.marketingConsent ?? false,
      city: user.profile?.city ?? null,
    },
    stats: {
      totalEnquiries: user._count.enquiries,
      activeEnquiries,
      completedEnquiries,
    },
  };
}

export type AccountOverview = Awaited<ReturnType<typeof getAccountOverview>>;

export async function updateCustomerProfile(userId: string, input: CustomerProfileUpdateInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profile: { select: { id: true } } },
  });
  if (!user) throw new NotFoundError('Account');

  let cityId: string | null | undefined;
  if (input.citySlug !== undefined) {
    if (input.citySlug === null) {
      cityId = null;
    } else {
      const location = await prisma.location.findUnique({
        where: { slug: input.citySlug },
        select: { id: true },
      });
      if (!location) {
        throw new ValidationError('That city could not be found', {
          citySlug: input.citySlug,
        });
      }
      cityId = location.id;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    }

    const profileData = {
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(cityId !== undefined ? { cityId } : {}),
      ...(input.preferredContactMethod !== undefined
        ? { preferredContactMethod: input.preferredContactMethod }
        : {}),
      ...(input.marketingConsent !== undefined ? { marketingConsent: input.marketingConsent } : {}),
    };

    if (Object.keys(profileData).length > 0) {
      await tx.customerProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });
    }

    return tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profile: {
          select: {
            phone: true,
            preferredContactMethod: true,
            marketingConsent: true,
            city: { select: { slug: true, name: true } },
          },
        },
      },
    });
  });
}
