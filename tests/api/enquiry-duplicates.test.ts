import { beforeEach, describe, expect, it } from 'vitest';
import { POST as createEnquiry } from '@/app/api/enquiries/route';
import { normalisePhone } from '@/server/domain/contact';
import {
  SEEDED_LISTINGS,
  clearRuntimeState,
  jsonRequest,
  readJson,
  routeContext,
  type ApiErrorResponse,
} from './api-helpers';
import { uniqueEmail, uniquePhone, uniqueSlug } from '../integration/helpers';

/**
 * Duplicate-enquiry windows in `POST /api/enquiries`.
 *
 * The rule: an enquiry matching an existing one on email OR the last 10 digits
 * of the phone, with the same listing set, inside the 15-minute window is
 * reported as a duplicate and must not create a second row. Outside the window
 * it creates a new row. A same-contact enquiry against a *different* listing set
 * is not a duplicate, but is flagged for admin review.
 *
 * Explicit idempotency keys are used so the idempotency path cannot mask the
 * duplicate-detection path under test.
 */

interface CreateBody {
  data: { referenceCode: string; status: string; duplicate: boolean; listings: string[] };
}

interface Submission {
  listings?: readonly string[];
  contactEmail: string;
  contactPhone: string;
  requirements?: string;
}

async function submit(input: Submission, idempotencyKey: string) {
  const response = await createEnquiry(
    jsonRequest(
      '/api/enquiries',
      'POST',
      {
        listings: input.listings ?? [SEEDED_LISTINGS.published],
        contactName: 'Duplicate Test Guest',
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        ...(input.requirements ? { requirements: input.requirements } : {}),
        consentPrivacy: true,
      },
      { 'idempotency-key': idempotencyKey },
    ),
    routeContext({}),
  );
  return { status: response.status, body: await readJson<CreateBody & ApiErrorResponse>(response) };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('duplicate enquiry window', () => {
  it('treats a second enquiry with the same email as a duplicate and stores one row', async () => {
    const email = uniqueEmail('dupe-email');

    const first = await submit(
      { contactEmail: email, contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );
    expect(first.status).toBe(201);
    expect(first.body.data.duplicate).toBe(false);

    const second = await submit(
      { contactEmail: email, contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );

    expect(second.status).toBe(201);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.referenceCode).toBe(first.body.data.referenceCode);

    const { prisma } = await import('@/lib/db');
    expect(await prisma.enquiry.count({ where: { contactEmail: email } })).toBe(1);
  });

  it('matches a phone number with and without the country code', async () => {
    const emailA = uniqueEmail('dupe-phone-a');
    const emailB = uniqueEmail('dupe-phone-b');
    const digits = `${Math.floor(1000000000 + Math.random() * 8999999999)}`;
    const local = `${digits.slice(0, 5)} ${digits.slice(5)}`;
    const withCountry = `+91 ${local}`;

    const first = await submit(
      { contactEmail: emailA, contactPhone: withCountry },
      uniqueSlug('k'),
    );
    expect(first.status).toBe(201);

    // Different email, same last 10 digits, formatted without the country code.
    const second = await submit({ contactEmail: emailB, contactPhone: local }, uniqueSlug('k'));

    expect(second.status).toBe(201);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.referenceCode).toBe(first.body.data.referenceCode);

    const { prisma } = await import('@/lib/db');
    const rows = await prisma.enquiry.findMany({
      where: { contactEmail: { in: [emailA, emailB] } },
      select: { contactPhoneNormalised: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contactPhoneNormalised).toBe(normalisePhone(withCountry));
    expect(normalisePhone(withCountry)).toBe(normalisePhone(local));
  });

  it('creates a new enquiry once the 15-minute window has passed', async () => {
    const email = uniqueEmail('dupe-window');

    const first = await submit(
      { contactEmail: email, contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );
    expect(first.status).toBe(201);

    const { prisma } = await import('@/lib/db');
    await prisma.enquiry.update({
      where: { referenceCode: first.body.data.referenceCode },
      data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
    });

    const second = await submit(
      { contactEmail: email, contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );

    expect(second.status).toBe(201);
    expect(second.body.data.duplicate).toBe(false);
    expect(second.body.data.referenceCode).not.toBe(first.body.data.referenceCode);
    expect(await prisma.enquiry.count({ where: { contactEmail: email } })).toBe(2);
  });

  it('does not treat the same contact against a different listing set as a duplicate, but flags it', async () => {
    const email = uniqueEmail('dupe-listings');
    const { prisma } = await import('@/lib/db');
    const other = await prisma.businessListing.findFirstOrThrow({
      where: {
        publicationStatus: 'PUBLISHED',
        archivedAt: null,
        slug: { not: SEEDED_LISTINGS.published },
      },
      select: { slug: true },
    });

    const first = await submit(
      { contactEmail: email, contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );
    expect(first.status).toBe(201);

    const second = await submit(
      {
        listings: [other.slug],
        contactEmail: email,
        contactPhone: uniquePhone(),
      },
      uniqueSlug('k'),
    );

    expect(second.status).toBe(201);
    expect(second.body.data.duplicate).toBe(false);
    expect(second.body.data.referenceCode).not.toBe(first.body.data.referenceCode);
    expect(second.body.data.listings).toHaveLength(1);
    expect(second.body.data.listings[0]).not.toBe(first.body.data.listings[0]);

    const rows = await prisma.enquiry.findMany({
      where: { contactEmail: email },
      select: { referenceCode: true, isPotentialDuplicate: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    // The near-repeat is surfaced for a human, not silently collapsed.
    expect(rows[1]?.isPotentialDuplicate).toBe(true);
  });

  it('does not match an unrelated contact inside the window', async () => {
    const first = await submit(
      { contactEmail: uniqueEmail('dupe-unrelated-a'), contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );
    expect(first.status).toBe(201);

    const second = await submit(
      { contactEmail: uniqueEmail('dupe-unrelated-b'), contactPhone: uniquePhone() },
      uniqueSlug('k'),
    );

    expect(second.status).toBe(201);
    expect(second.body.data.duplicate).toBe(false);
    expect(second.body.data.referenceCode).not.toBe(first.body.data.referenceCode);
  });
});
