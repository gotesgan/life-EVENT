import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  attachCoverMedia,
  requireCategoryId,
  requireLocationId,
  uniqueSlug,
  uniqueSuffix,
} from './helpers';

/**
 * These tests prove the database itself enforces the invariants the services
 * rely on. They operate on fixtures they create, never on seeded rows.
 */

function prismaErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

async function expectPrismaFailure(run: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(prismaErrorCode(error)).toBe(code);
    return;
  }
  throw new Error(`Expected the operation to fail with Prisma code ${code}, but it succeeded`);
}

async function createListingFixture() {
  const [primaryCategoryId, primaryLocationId] = await Promise.all([
    requireCategoryId('venues'),
    requireLocationId('mumbai'),
  ]);

  const listing = await prisma.businessListing.create({
    data: {
      slug: uniqueSlug('constraints'),
      name: `Constraints Listing ${uniqueSuffix()}`,
      primaryCategoryId,
      primaryLocationId,
    },
    select: { id: true, slug: true },
  });

  // Keeps the seed's "every listing has a cover" invariant true for the next file.
  await attachCoverMedia(listing.id);

  return listing;
}

async function createAttributeFixture() {
  const code = uniqueSlug('constraint-attr');
  return prisma.attributeDefinition.create({
    data: { code, label: `Constraint Attribute ${code}`, dataType: 'TEXT' },
    select: { id: true, code: true },
  });
}

async function createEnquiryFixture(listingIds: string[]) {
  const suffix = uniqueSuffix();
  return prisma.enquiry.create({
    data: {
      referenceCode: `LE-${suffix.toUpperCase().slice(0, 8)}`,
      contactName: `Constraint Enquiry ${suffix}`,
      contactEmail: `constraints.${suffix}@example.test`,
      contactPhone: '+91 98765 43210',
      contactPhoneNormalised: '9876543210',
      listings: { create: listingIds.map((listingId, index) => ({ listingId, sortOrder: index })) },
    },
    select: { id: true, referenceCode: true, listings: { select: { id: true, listingId: true } } },
  });
}

describe('unique listing slug', () => {
  it('refuses a second listing with the same slug', async () => {
    const first = await createListingFixture();
    const [primaryCategoryId, primaryLocationId] = await Promise.all([
      requireCategoryId('venues'),
      requireLocationId('mumbai'),
    ]);

    await expectPrismaFailure(
      () =>
        prisma.businessListing.create({
          data: {
            slug: first.slug,
            name: 'Duplicate slug listing',
            primaryCategoryId,
            primaryLocationId,
          },
        }),
      'P2002',
    );

    expect(await prisma.businessListing.count({ where: { slug: first.slug } })).toBe(1);
  });
});

describe('unique (listingId, attributeId)', () => {
  it('refuses a second attribute value for the same listing and attribute', async () => {
    const listing = await createListingFixture();
    const attribute = await createAttributeFixture();

    await prisma.listingAttributeValue.create({
      data: { listingId: listing.id, attributeId: attribute.id, valueText: 'first' },
    });

    await expectPrismaFailure(
      () =>
        prisma.listingAttributeValue.create({
          data: { listingId: listing.id, attributeId: attribute.id, valueText: 'second' },
        }),
      'P2002',
    );

    expect(
      await prisma.listingAttributeValue.count({
        where: { listingId: listing.id, attributeId: attribute.id },
      }),
    ).toBe(1);
  });
});

describe('unique (enquiryId, listingId)', () => {
  it('refuses the same provider twice inside one enquiry', async () => {
    const listing = await createListingFixture();
    const enquiry = await createEnquiryFixture([listing.id]);

    await expectPrismaFailure(
      () =>
        prisma.enquiryListing.create({
          data: { enquiryId: enquiry.id, listingId: listing.id },
        }),
      'P2002',
    );

    expect(await prisma.enquiryListing.count({ where: { enquiryId: enquiry.id } })).toBe(1);
  });
});

describe('unique (scope, key) on idempotency keys', () => {
  it('refuses a second row for the same scope and key', async () => {
    const key = `constraints-${uniqueSuffix()}`;
    const expiresAt = new Date(Date.now() + 60_000);

    await prisma.idempotencyKey.create({
      data: { key, scope: 'constraints.scope', requestHash: 'hash-1', expiresAt },
    });

    await expectPrismaFailure(
      () =>
        prisma.idempotencyKey.create({
          data: { key, scope: 'constraints.scope', requestHash: 'hash-2', expiresAt },
        }),
      'P2002',
    );

    expect(await prisma.idempotencyKey.count({ where: { key, scope: 'constraints.scope' } })).toBe(
      1,
    );
  });

  it('allows the same key in a different scope', async () => {
    const key = `constraints-${uniqueSuffix()}`;
    const expiresAt = new Date(Date.now() + 60_000);

    await prisma.idempotencyKey.create({
      data: { key, scope: 'constraints.scope.a', requestHash: 'hash', expiresAt },
    });
    await prisma.idempotencyKey.create({
      data: { key, scope: 'constraints.scope.b', requestHash: 'hash', expiresAt },
    });

    expect(await prisma.idempotencyKey.count({ where: { key } })).toBe(2);
  });
});

describe('BusinessListing deletion cascades to owned children', () => {
  it('removes media, services and attribute values with the listing', async () => {
    const listing = await createListingFixture();
    const attribute = await createAttributeFixture();

    await prisma.listingMedia.create({
      data: {
        listingId: listing.id,
        storageKey: `constraints/${uniqueSuffix()}.png`,
        publicUrl: '/local-media/constraints.png',
        altText: 'Constraint fixture image',
        mimeType: 'image/png',
        sizeBytes: 128,
        status: 'READY',
      },
    });
    await prisma.listingService.create({
      data: { listingId: listing.id, name: `Constraint Service ${uniqueSuffix()}` },
    });
    await prisma.listingAttributeValue.create({
      data: { listingId: listing.id, attributeId: attribute.id, valueText: 'value' },
    });
    await prisma.listingAmenity.create({
      data: {
        listingId: listing.id,
        amenityId: (await prisma.amenity.findFirstOrThrow({ select: { id: true } })).id,
      },
    });

    await prisma.businessListing.delete({ where: { id: listing.id } });

    const [media, services, values, amenities] = await Promise.all([
      prisma.listingMedia.count({ where: { listingId: listing.id } }),
      prisma.listingService.count({ where: { listingId: listing.id } }),
      prisma.listingAttributeValue.count({ where: { listingId: listing.id } }),
      prisma.listingAmenity.count({ where: { listingId: listing.id } }),
    ]);

    expect({ media, services, values, amenities }).toEqual({
      media: 0,
      services: 0,
      values: 0,
      amenities: 0,
    });
    expect(await prisma.businessListing.count({ where: { id: listing.id } })).toBe(0);
  });
});

describe('BusinessListing deletion is restricted while a lead references it', () => {
  it('refuses the delete and leaves the listing in place', async () => {
    const listing = await createListingFixture();
    const enquiry = await createEnquiryFixture([listing.id]);

    await expectPrismaFailure(
      () => prisma.businessListing.delete({ where: { id: listing.id } }),
      'P2003',
    );

    expect(await prisma.businessListing.count({ where: { id: listing.id } })).toBe(1);
    expect(await prisma.enquiryListing.count({ where: { enquiryId: enquiry.id } })).toBe(1);
  });

  it('allows the delete once the referencing enquiry is removed', async () => {
    const listing = await createListingFixture();
    const enquiry = await createEnquiryFixture([listing.id]);

    await prisma.enquiry.delete({ where: { id: enquiry.id } });
    await expect(
      prisma.businessListing.delete({ where: { id: listing.id } }),
    ).resolves.toBeDefined();
  });
});

describe('Enquiry deletion cascades to its leads, activities and notes', () => {
  it('removes every child row with the enquiry', async () => {
    const listing = await createListingFixture();
    const enquiry = await createEnquiryFixture([listing.id]);
    const lead = enquiry.listings[0];
    if (!lead) throw new Error('Expected one lead');

    await prisma.enquiryActivity.create({
      data: {
        enquiryId: enquiry.id,
        enquiryListingId: lead.id,
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        isCustomerVisible: true,
      },
    });
    await prisma.enquiryNote.create({
      data: { enquiryId: enquiry.id, enquiryListingId: lead.id, body: 'Private constraint note' },
    });

    await prisma.enquiry.delete({ where: { id: enquiry.id } });

    const [leads, activities, notes] = await Promise.all([
      prisma.enquiryListing.count({ where: { enquiryId: enquiry.id } }),
      prisma.enquiryActivity.count({ where: { enquiryId: enquiry.id } }),
      prisma.enquiryNote.count({ where: { enquiryId: enquiry.id } }),
    ]);

    expect({ leads, activities, notes }).toEqual({ leads: 0, activities: 0, notes: 0 });
    // The listing itself must survive: deleting a lead never deletes a business.
    expect(await prisma.businessListing.count({ where: { id: listing.id } })).toBe(1);
  });
});
