import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ConflictError, ValidationError } from '@/lib/errors';
import {
  adminCreateListing,
  adminSetPublicationStatus,
  adminUpdateListing,
  type AdminActorContext,
} from '@/server/services/listing.service';
import { adminSetListingAttributeValues } from '@/server/services/attribute.service';
import { listingCreateSchema, listingUpdateSchema } from '@/lib/validation/listing';
import {
  attachCoverMedia,
  createTestAdmin,
  requireCategoryId,
  requireLocationId,
  uniqueSlug,
  uniqueSuffix,
} from './helpers';

type Actor = AdminActorContext;

async function actor(): Promise<Actor> {
  const admin = await createTestAdmin('lifecycle-admin');
  return admin.actor;
}

async function baseInput(overrides: Record<string, unknown> = {}) {
  const [primaryCategoryId, primaryLocationId] = await Promise.all([
    requireCategoryId('venues'),
    requireLocationId('mumbai'),
  ]);

  return listingCreateSchema.parse({
    name: `Lifecycle Venue ${uniqueSuffix()}`,
    primaryCategoryId,
    primaryLocationId,
    ...overrides,
  });
}

async function createListing(
  options: { media?: 'cover' | 'none'; overrides?: Record<string, unknown> } = {},
) {
  const adminActor = await actor();
  const created = await adminCreateListing(await baseInput(options.overrides), adminActor);
  if ((options.media ?? 'cover') === 'cover') {
    await attachCoverMedia(created.id);
  }
  return { ...created, actor: adminActor };
}

async function listingRow(id: string) {
  return prisma.businessListing.findUniqueOrThrow({
    where: { id },
    select: { publicationStatus: true, publishedAt: true, archivedAt: true, searchText: true },
  });
}

describe('adminCreateListing', () => {
  it('creates a DRAFT listing and records an audit entry', async () => {
    const created = await createListing({ media: 'none' });

    const row = await listingRow(created.id);
    expect(row.publicationStatus).toBe('DRAFT');
    expect(row.publishedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { action: 'listing.created', entityId: created.id },
      select: { summary: true },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.summary).toContain(created.name);

    // Keep the seed's "every listing has a cover" invariant true for later tests.
    await attachCoverMedia(created.id);
  });

  it('derives a unique slug from the name', async () => {
    const name = `Unique Slug Venue ${uniqueSuffix()}`;
    const adminActor = await actor();

    const first = await adminCreateListing(await baseInput({ name }), adminActor);
    await attachCoverMedia(first.id);
    const second = await adminCreateListing(await baseInput({ name }), adminActor);
    await attachCoverMedia(second.id);

    expect(first.slug).not.toBe(second.slug);
    expect(second.slug).toMatch(/-\d+$/);
  });

  it('writes a non-empty searchText haystack', async () => {
    const created = await createListing({ media: 'none' });

    const row = await listingRow(created.id);
    expect(row.searchText.length).toBeGreaterThan(0);
    expect(row.searchText).toContain(created.name.toLowerCase());

    await attachCoverMedia(created.id);
  });
});

describe('adminSetPublicationStatus: publish guard rails', () => {
  it('refuses to publish without a READY image', async () => {
    const created = await createListing({
      media: 'none',
      overrides: { description: 'A description' },
    });

    await expect(
      adminSetPublicationStatus(created.id, 'publish', created.actor),
    ).rejects.toBeInstanceOf(ConflictError);

    expect((await listingRow(created.id)).publicationStatus).toBe('DRAFT');
    await attachCoverMedia(created.id);
  });

  it('refuses to publish with no description', async () => {
    const created = await createListing({ media: 'cover' });

    const error = await adminSetPublicationStatus(created.id, 'publish', created.actor).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toMatch(/description/i);
    expect((await listingRow(created.id)).publicationStatus).toBe('DRAFT');
  });

  it('publishes when both a READY image and a description exist, stamping publishedAt', async () => {
    const created = await createListing({ overrides: { description: 'A complete description' } });

    const updated = await adminSetPublicationStatus(created.id, 'publish', created.actor);

    expect(updated.publicationStatus).toBe('PUBLISHED');
    expect(updated.publishedAt).not.toBeNull();

    const row = await listingRow(created.id);
    expect(row.publicationStatus).toBe('PUBLISHED');
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(
      await prisma.auditLog.count({ where: { action: 'listing.published', entityId: created.id } }),
    ).toBe(1);
  });

  it('refuses to publish an already-published listing', async () => {
    const created = await createListing({ overrides: { description: 'Already live' } });
    await adminSetPublicationStatus(created.id, 'publish', created.actor);

    await expect(
      adminSetPublicationStatus(created.id, 'publish', created.actor),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('adminSetPublicationStatus: unpublish, archive and restore', () => {
  it('moves a published listing through unpublish, archive and restore', async () => {
    const created = await createListing({ overrides: { description: 'Lifecycle subject' } });
    await adminSetPublicationStatus(created.id, 'publish', created.actor);

    const unpublished = await adminSetPublicationStatus(
      created.id,
      'unpublish',
      created.actor,
      'Paused',
    );
    expect(unpublished.publicationStatus).toBe('UNPUBLISHED');

    const archived = await adminSetPublicationStatus(
      created.id,
      'archive',
      created.actor,
      'Retired',
    );
    expect(archived.publicationStatus).toBe('ARCHIVED');
    const archivedRow = await listingRow(created.id);
    expect(archivedRow.archivedAt).toBeInstanceOf(Date);

    const restored = await adminSetPublicationStatus(created.id, 'restore', created.actor);
    expect(restored.publicationStatus).toBe('DRAFT');
    expect((await listingRow(created.id)).archivedAt).toBeNull();
  });

  it('writes an audit row for every transition', async () => {
    const created = await createListing({ overrides: { description: 'Audited lifecycle' } });
    await adminSetPublicationStatus(created.id, 'publish', created.actor);
    await adminSetPublicationStatus(created.id, 'unpublish', created.actor);
    await adminSetPublicationStatus(created.id, 'archive', created.actor);
    await adminSetPublicationStatus(created.id, 'restore', created.actor);

    const actions = await prisma.auditLog.findMany({
      where: { entityId: created.id, action: { startsWith: 'listing.' } },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    });

    const recorded = new Set(actions.map((row) => row.action));
    expect(recorded).toContain('listing.published');
    expect(recorded).toContain('listing.unpublished');
    expect(recorded).toContain('listing.archived');
    expect(recorded).toContain('listing.restored');
  });
});

describe('adminUpdateListing replaces child collections wholesale', () => {
  it('removes a service that is not present in the update payload', async () => {
    const suffix = uniqueSuffix();
    const alpha = `Alpha Service ${suffix}`;
    const beta = `Beta Service ${suffix}`;

    const created = await createListing({
      overrides: {
        description: 'Service replacement subject',
        services: [{ name: alpha }, { name: beta }],
      },
    });

    expect(await prisma.listingService.count({ where: { listingId: created.id } })).toBe(2);
    expect((await listingRow(created.id)).searchText).toContain(beta.toLowerCase());

    const primaryCategoryId = await requireCategoryId('venues');
    const update = listingUpdateSchema.parse({
      primaryCategoryId,
      categoryIds: [],
      services: [{ name: alpha }],
    });

    await adminUpdateListing(created.id, update, created.actor);

    const services = await prisma.listingService.findMany({
      where: { listingId: created.id },
      select: { name: true },
    });
    expect(services.map((service) => service.name)).toEqual([alpha]);

    const row = await listingRow(created.id);
    expect(row.searchText).toContain(alpha.toLowerCase());
    expect(row.searchText).not.toContain(beta.toLowerCase());
  });

  it('refreshes searchText when the description changes', async () => {
    const created = await createListing({ overrides: { description: 'Original copy' } });
    const primaryCategoryId = await requireCategoryId('venues');

    await adminUpdateListing(
      created.id,
      listingUpdateSchema.parse({
        primaryCategoryId,
        categoryIds: [],
        description: 'A completely new description sentence',
      }),
      created.actor,
    );

    const row = await listingRow(created.id);
    expect(row.searchText).toContain('completely new description');
    expect(row.searchText).not.toContain('original copy');
  });
});

describe('adminSetListingAttributeValues', () => {
  async function createScratchCategory() {
    const slug = uniqueSlug('lc-category');
    return prisma.category.create({
      data: { slug, path: slug, name: `LC Category ${slug}` },
      select: { id: true, slug: true },
    });
  }

  async function createAttribute(
    dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT',
    overrides: { minNumber?: number; maxNumber?: number; maxLength?: number } = {},
  ) {
    const code = uniqueSlug('lc-attr');
    return prisma.attributeDefinition.create({
      data: { code, label: `LC Attribute ${code}`, dataType, ...overrides },
      select: { id: true, code: true, label: true },
    });
  }

  async function bind(
    categoryId: string,
    attributeId: string,
    overrides: { isRequired?: boolean } = {},
  ) {
    return prisma.categoryAttribute.create({
      data: {
        categoryId,
        attributeId,
        isVisibleOnProfile: true,
        isRequired: overrides.isRequired ?? false,
      },
    });
  }

  async function createListingInCategory(categoryId: string) {
    const adminActor = await actor();
    const created = await adminCreateListing(
      listingCreateSchema.parse({
        name: `Attribute Listing ${uniqueSuffix()}`,
        primaryCategoryId: categoryId,
        primaryLocationId: await requireLocationId('mumbai'),
      }),
      adminActor,
    );
    await attachCoverMedia(created.id);
    return { ...created, actor: adminActor };
  }

  it('rejects a value that is not an allowed option for a SINGLE_SELECT attribute', async () => {
    const category = await createScratchCategory();
    const attribute = await createAttribute('SINGLE_SELECT');
    await prisma.attributeOption.create({
      data: { attributeId: attribute.id, value: 'candid', label: 'Candid' },
    });
    await bind(category.id, attribute.id);
    const listing = await createListingInCategory(category.id);

    const error = await adminSetListingAttributeValues({
      listingId: listing.id,
      values: [{ attributeId: attribute.id, optionValue: 'not-an-option' }],
      actor: listing.actor,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({ attributeCode: attribute.code });
    expect(await prisma.listingAttributeValue.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it('rejects a numeric value outside the definition bounds', async () => {
    const category = await createScratchCategory();
    const attribute = await createAttribute('NUMBER', { minNumber: 10, maxNumber: 100 });
    await bind(category.id, attribute.id);
    const listing = await createListingInCategory(category.id);

    await expect(
      adminSetListingAttributeValues({
        listingId: listing.id,
        values: [{ attributeId: attribute.id, valueNumber: 5 }],
        actor: listing.actor,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a value for an attribute that does not apply to the listing', async () => {
    const category = await createScratchCategory();
    const listing = await createListingInCategory(category.id);
    const foreign = await createAttribute('TEXT');

    await expect(
      adminSetListingAttributeValues({
        listingId: listing.id,
        values: [{ attributeId: foreign.id, valueText: 'nope' }],
        actor: listing.actor,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a save that omits a required attribute', async () => {
    const category = await createScratchCategory();
    const attribute = await createAttribute('TEXT');
    await bind(category.id, attribute.id, { isRequired: true });
    const listing = await createListingInCategory(category.id);

    const error = await adminSetListingAttributeValues({
      listingId: listing.id,
      values: [],
      actor: listing.actor,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      missingRequired: [{ code: attribute.code, label: attribute.label }],
    });
  });

  // Regression guard: a value supplied in the WRONG typed column must be
  // rejected. `validateAttributeValues` previously range-checked the numeric
  // value but never checked that the column matched the definition's dataType, so
  // supplying `valueNumber` for a BOOLEAN attribute was accepted and stored as an
  // all-null row — an administrator saw a successful save for a value that was
  // silently discarded.
  // See report.
  it('rejects a typed value whose column does not match the definition', async () => {
    const category = await createScratchCategory();
    const attribute = await createAttribute('BOOLEAN');
    await bind(category.id, attribute.id);
    const listing = await createListingInCategory(category.id);

    await expect(
      adminSetListingAttributeValues({
        listingId: listing.id,
        values: [{ attributeId: attribute.id, valueNumber: 42 }],
        actor: listing.actor,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('replaces previous values rather than merging them', async () => {
    const category = await createScratchCategory();
    const first = await createAttribute('TEXT');
    const second = await createAttribute('TEXT');
    await bind(category.id, first.id);
    await bind(category.id, second.id);
    const listing = await createListingInCategory(category.id);

    await adminSetListingAttributeValues({
      listingId: listing.id,
      values: [{ attributeId: first.id, valueText: 'first value' }],
      actor: listing.actor,
    });
    expect(await prisma.listingAttributeValue.count({ where: { listingId: listing.id } })).toBe(1);

    await adminSetListingAttributeValues({
      listingId: listing.id,
      values: [{ attributeId: second.id, valueText: 'second value' }],
      actor: listing.actor,
    });

    const rows = await prisma.listingAttributeValue.findMany({
      where: { listingId: listing.id },
      select: { attributeId: true, valueText: true },
    });

    expect(rows).toEqual([{ attributeId: second.id, valueText: 'second value' }]);
  });
});
