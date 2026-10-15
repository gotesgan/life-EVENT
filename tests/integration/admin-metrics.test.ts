import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createEnquiry } from '@/server/services/enquiry.service';
import { adminGetEnquiryMetrics } from '@/server/services/admin-enquiry.service';
import { createEnquirySchema } from '@/lib/validation/enquiry';
import { clearRuntimeState } from '../setup/integration';
import { createTestAdmin, uniqueEmail, uniqueIp, uniquePhone } from './helpers';

async function createSingleLeadEnquiry() {
  const input = createEnquirySchema.parse({
    listings: ['gulmohar-banjara-banquets'],
    contactName: 'Metrics Fixture',
    contactEmail: uniqueEmail('metrics'),
    contactPhone: uniquePhone(),
    consentPrivacy: true,
  });

  const submission = await createEnquiry(input, {
    actorUserId: null,
    ipAddress: uniqueIp(),
    userAgent: 'vitest-metrics',
    idempotencyKey: null,
  });

  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { referenceCode: submission.referenceCode },
    select: { id: true, listings: { select: { id: true } } },
  });

  const lead = enquiry.listings[0];
  if (!lead) throw new Error('Expected the enquiry to have one lead');
  return { enquiryId: enquiry.id, leadId: lead.id };
}

describe('adminGetEnquiryMetrics counts agree with direct queries', () => {
  it('matches prisma.count for the totals, the flag and the status group-by', async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const metrics = await adminGetEnquiryMetrics();

    const [total, newLast7Days, flaggedDuplicates, byStatus] = await Promise.all([
      prisma.enquiry.count(),
      prisma.enquiry.count({ where: { createdAt: { gte: since } } }),
      prisma.enquiry.count({ where: { isPotentialDuplicate: true } }),
      prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    expect(metrics.total).toBe(total);
    expect(metrics.newLast7Days).toBe(newLast7Days);
    expect(metrics.flaggedDuplicates).toBe(flaggedDuplicates);

    const statusSum = metrics.byStatus.reduce((sum, row) => sum + row.count, 0);
    expect(statusSum).toBe(total);

    const expectedByStatus = new Map(byStatus.map((row) => [row.status, row._count._all]));
    for (const row of metrics.byStatus) {
      expect(row.count).toBe(expectedByStatus.get(row.status));
    }
  });

  it('reports a conversion rate that is a percentage, never a raw ratio', async () => {
    const metrics = await adminGetEnquiryMetrics();
    const converted = await prisma.enquiry.count({ where: { status: 'CONVERTED' } });

    const expected = metrics.total === 0 ? 0 : Math.round((converted / metrics.total) * 1000) / 10;
    expect(metrics.conversionRate).toBe(expected);
    expect(Number.isNaN(metrics.conversionRate)).toBe(false);
    expect(metrics.conversionRate).toBeGreaterThanOrEqual(0);
    expect(metrics.conversionRate).toBeLessThanOrEqual(100);
  });

  it('only surfaces top categories that actually have enquiry listings', async () => {
    const metrics = await adminGetEnquiryMetrics();

    for (const category of metrics.topCategories) {
      expect(category.count).toBeGreaterThan(0);
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.slug.length).toBeGreaterThan(0);
    }
  });
});

describe('adminGetEnquiryMetrics unassigned counter', () => {
  it('counts only NEW leads with no assignee', async () => {
    const before = await adminGetEnquiryMetrics();
    const directBefore = await prisma.enquiryListing.count({
      where: { assignedAdminId: null, status: 'NEW' },
    });
    expect(before.unassigned).toBe(directBefore);

    const admin = await createTestAdmin('metrics-admin');
    const unassignedNew = await createSingleLeadEnquiry();
    const assignedNew = await createSingleLeadEnquiry();
    const unassignedContacted = await createSingleLeadEnquiry();

    // (a) NEW + unassigned: counts.
    await prisma.enquiryListing.update({
      where: { id: assignedNew.leadId },
      data: { assignedAdminId: admin.id },
    });
    // (b) NEW + assigned: already covered above.
    // (c) CONTACTED + unassigned: does not count.
    await prisma.enquiryListing.update({
      where: { id: unassignedContacted.leadId },
      data: { status: 'CONTACTED' },
    });

    const stillNew = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: unassignedNew.leadId },
      select: { status: true, assignedAdminId: true },
    });
    expect(stillNew).toEqual({ status: 'NEW', assignedAdminId: null });

    const after = await adminGetEnquiryMetrics();
    expect(after.unassigned).toBe(before.unassigned + 1);
  });
});

/**
 * Runs last: it empties the enquiry tables, so any earlier test that relied on
 * seeded enquiries must already have finished.
 */
describe('adminGetEnquiryMetrics on an empty database', () => {
  it('returns zero totals and a conversion rate of 0 rather than NaN', async () => {
    await clearRuntimeState();

    const metrics = await adminGetEnquiryMetrics();

    expect(metrics.total).toBe(0);
    expect(metrics.newLast7Days).toBe(0);
    expect(metrics.byStatus).toEqual([]);
    expect(metrics.unassigned).toBe(0);
    expect(metrics.flaggedDuplicates).toBe(0);
    expect(metrics.topCategories).toEqual([]);
    expect(metrics.conversionRate).toBe(0);
    expect(Number.isNaN(metrics.conversionRate)).toBe(false);
  });
});
