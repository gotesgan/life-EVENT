import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/actor';

/**
 * CSV exports for the reports page.
 *
 * Admin-only and read-only. The rows are limited so an accidental export cannot
 * hold a transaction open for minutes; if the dataset outgrows this, the export
 * moves to a queued job rather than a bigger request.
 */
const MAX_ROWS = 5000;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

function csvResponse(filename: string, body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  await requireAdmin(request.headers);

  const report = request.nextUrl.searchParams.get('report') ?? 'enquiries';

  if (report === 'applications') {
    const rows = await prisma.vendorApplication.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    return csvResponse(
      'vendor-applications.csv',
      toCsv(
        [
          'id',
          'business_name',
          'vendor_type',
          'source',
          'city',
          'contact_name',
          'contact_phone',
          'contact_email',
          'status',
          'review_note',
          'listing_id',
          'created_at',
          'reviewed_at',
        ],
        rows.map((row) => [
          row.id,
          row.businessName,
          row.vendorType,
          row.source,
          row.citySlug,
          row.contactName,
          row.contactPhone,
          row.contactEmail,
          row.status,
          row.reviewNote,
          row.listingId,
          row.createdAt,
          row.reviewedAt,
        ]),
      ),
    );
  }

  const rows = await prisma.enquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
    select: {
      id: true,
      referenceCode: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      status: true,
      eventDate: true,
      guestCount: true,
      budgetMin: true,
      budgetMax: true,
      referralSource: true,
      consentPrivacy: true,
      createdAt: true,
      listings: {
        select: {
          status: true,
          listing: { select: { name: true, primaryCategory: { select: { name: true } } } },
        },
      },
    },
  });

  return csvResponse(
    'enquiries.csv',
    toCsv(
      [
        'id',
        'reference',
        'customer_name',
        'customer_email',
        'customer_phone',
        'status',
        'event_date',
        'guest_count',
        'budget_min',
        'budget_max',
        'referral_source',
        'consent_privacy',
        'created_at',
        'listings',
      ],
      rows.map((row) => [
        row.id,
        row.referenceCode,
        row.contactName,
        row.contactEmail,
        row.contactPhone,
        row.status,
        row.eventDate,
        row.guestCount,
        row.budgetMin,
        row.budgetMax,
        row.referralSource,
        row.consentPrivacy,
        row.createdAt,
        row.listings
          .map((rowListing) => `${rowListing.listing.name} (${rowListing.status})`)
          .join(' | '),
      ]),
    ),
  );
}
