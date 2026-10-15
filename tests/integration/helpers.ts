import { prisma } from '@/lib/db';
import type { AdminActorContext } from '@/server/services/listing.service';

/**
 * Shared helpers for the integration suites.
 *
 * Integration files run against one shared database in sequence, so they must
 * never truncate or assume an empty table. Every helper here namespaces the
 * rows it creates with a per-call suffix instead.
 */

let sequence = 0;

/**
 * A short, filesystem/URL-safe token that is unique within a process run.
 * Combining a timestamp, a counter and randomness makes a collision between
 * concurrently-created fixtures effectively impossible.
 */
export function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}${sequence.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** A globally unique slug for fixtures (`prefix-<suffix>`). */
export function uniqueSlug(prefix: string): string {
  return `${prefix}-${uniqueSuffix()}`.toLowerCase();
}

/** A globally unique email address for fixtures. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${uniqueSuffix()}@example.test`;
}

/**
 * A unique, valid-looking Indian phone number.
 *
 * Duplicate detection matches on the normalised phone OR the email, so two
 * fixtures that share a phone number are treated as the same contact even when
 * their emails differ. Every enquiry fixture therefore needs its own phone.
 */
export function uniquePhone(): string {
  sequence += 1;
  const tail = `${String(Date.now() % 100_000).padStart(5, '0')}${String(sequence % 10_000).padStart(4, '0')}0`;
  return `+91 ${tail.slice(0, 5)} ${tail.slice(5, 10)}`;
}

/**
 * A unique pseudo-IP for fixtures.
 *
 * Enquiry submission is rate limited per IP and per email, so tests must not
 * share either or an unrelated test can exhaust the bucket first.
 */
export function uniqueIp(): string {
  sequence += 1;
  return `10.${(sequence % 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${
    Math.floor(Math.random() * 250) + 1
  }`;
}

/** A globally unique enquiry reference code in the platform's format. */
export function uniqueReferenceCode(): string {
  return `LE-${uniqueSuffix().toUpperCase().slice(0, 8)}`;
}

export interface TestAdmin {
  id: string;
  name: string;
  email: string;
  actor: AdminActorContext;
}

/** Creates an ACTIVE admin user and the actor context the services expect. */
export async function createTestAdmin(prefix = 'admin'): Promise<TestAdmin> {
  const suffix = uniqueSuffix();
  const user = await prisma.user.create({
    data: {
      name: `Test Admin ${suffix}`,
      email: uniqueEmail(prefix),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true, name: true, email: true },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    actor: { userId: user.id, name: user.name },
  };
}

export interface TestCustomer {
  id: string;
  name: string;
  email: string;
}

/** Creates an ACTIVE customer user. */
export async function createTestCustomer(prefix = 'customer'): Promise<TestCustomer> {
  const suffix = uniqueSuffix();
  const user = await prisma.user.create({
    data: {
      name: `Test Customer ${suffix}`,
      email: uniqueEmail(prefix),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
    select: { id: true, name: true, email: true },
  });

  return { id: user.id, name: user.name, email: user.email };
}

/** Looks a category up by slug and fails loudly when the seed has changed. */
export async function requireCategoryId(slug: string): Promise<string> {
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return category.id;
}

/** Looks a location up by slug and fails loudly when the seed has changed. */
export async function requireLocationId(slug: string): Promise<string> {
  const location = await prisma.location.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return location.id;
}

/** Looks a listing up by slug and fails loudly when the seed has changed. */
export async function requireListingId(slug: string): Promise<string> {
  const listing = await prisma.businessListing.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return listing.id;
}

/** Looks an attribute definition up by code and fails loudly when missing. */
export async function requireAttributeId(code: string): Promise<string> {
  const attribute = await prisma.attributeDefinition.findUniqueOrThrow({
    where: { code },
    select: { id: true },
  });
  return attribute.id;
}

/**
 * Attaches a media row to a listing fixture.
 *
 * The seed's `verifySeededData()` asserts that *every* listing has a cover
 * image, and it runs again in `beforeAll` for each integration file. Fixtures
 * that survive their own test file must therefore carry a cover, or the next
 * file's seed fails before its tests start.
 */
export async function attachCoverMedia(
  listingId: string,
  options: { status?: 'PENDING' | 'READY' | 'FAILED'; isCover?: boolean; altText?: string } = {},
): Promise<{ id: string }> {
  const suffix = uniqueSuffix();
  return prisma.listingMedia.create({
    data: {
      listingId,
      storageKey: `tests/${suffix}.png`,
      publicUrl: `/local-media/tests/${suffix}.png`,
      altText: options.altText ?? 'Test fixture image',
      mimeType: 'image/png',
      sizeBytes: 128,
      status: options.status ?? 'READY',
      isCover: options.isCover ?? true,
    },
    select: { id: true },
  });
}
