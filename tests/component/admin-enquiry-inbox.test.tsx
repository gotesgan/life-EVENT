import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import type { AdminEnquiryListRow } from '@/server/dto/enquiry.dto';
import { EnquiryInbox } from '@/components/admin/EnquiryInbox';

/**
 * The enquiry inbox.
 *
 * The privacy boundary is the point of this file: the list DTO publishes masked
 * contact details and the inbox must render exactly those. A regression that
 * printed the unmasked pair would leak a customer's email address into a table
 * that is rendered for every administrator, so it is asserted directly rather
 * than assumed.
 *
 * `next/navigation` is mocked because the inbox owns selection and bulk actions
 * (which refresh the server component) and `TablePagination` writes to the URL;
 * neither is under test here.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/enquiries',
}));

vi.mock('@/components/ui/ClientLink', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function row(overrides: Partial<AdminEnquiryListRow> = {}): AdminEnquiryListRow {
  return {
    id: 'e1',
    referenceCode: 'LE-2026-0001',
    status: 'NEW',
    createdAt: new Date('2026-02-01T09:30:00.000Z'),
    updatedAt: new Date('2026-02-01T09:30:00.000Z'),
    contactName: 'Anita Rao',
    contactEmailMasked: 'a***@example.com',
    contactPhoneMasked: '••••••4321',
    eventTypeName: 'Wedding',
    eventDate: new Date('2026-11-14T00:00:00.000Z'),
    guestCount: 250,
    budgetMin: 500000,
    budgetMax: 900000,
    isPotentialDuplicate: false,
    customerUserId: 'u1',
    assignment: { assignedAdminId: 'a1', assignedAdminName: 'Priya Sharma' },
    listings: [
      {
        enquiryListingId: 'el1',
        listingId: 'l1',
        name: 'Sunset Lawns',
        slug: 'sunset-lawns',
        status: 'NEW',
        publicationStatus: 'PUBLISHED',
        assignedAdminName: null,
        assignedAt: null,
        firstContactedAt: null,
        sharedWithProviderAt: null,
        convertedAt: null,
        lostAt: null,
        lostReason: null,
        providerResponseNote: null,
      },
      {
        enquiryListingId: 'el2',
        listingId: 'l2',
        name: 'The Grand Banquet',
        slug: 'the-grand-banquet',
        status: 'CONTACTED',
        publicationStatus: 'PUBLISHED',
        assignedAdminName: 'Priya Sharma',
        assignedAt: new Date('2026-02-01T09:00:00.000Z'),
        firstContactedAt: new Date('2026-02-02T09:00:00.000Z'),
        sharedWithProviderAt: null,
        convertedAt: null,
        lostAt: null,
        lostReason: null,
        providerResponseNote: null,
      },
    ],
    ...overrides,
  };
}

function renderInbox(rows: AdminEnquiryListRow[]): ReactElement {
  return (
    <MantineProvider>
      <EnquiryInbox
        rows={rows}
        params={{}}
        page={1}
        pageSize={25}
        totalItems={rows.length}
        emptyState={<p>No enquiries match these filters</p>}
      />
    </MantineProvider>
  );
}

describe('EnquiryInbox', () => {
  it('renders the masked contact details and never the unmasked address', () => {
    render(renderInbox([row()]));

    expect(screen.getByText('a***@example.com')).toBeInTheDocument();
    expect(screen.getByText('••••••4321')).toBeInTheDocument();

    expect(screen.queryByText('anita@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('+91 98765 43210')).not.toBeInTheDocument();
  });

  it('links every enquiry to its detail page', () => {
    render(renderInbox([row()]));

    expect(screen.getByRole('link', { name: 'LE-2026-0001' })).toHaveAttribute(
      'href',
      '/admin/enquiries/e1',
    );
  });

  it('marks a flagged enquiry and shows a chip per provider lead', () => {
    render(renderInbox([row({ isPotentialDuplicate: true })]));

    expect(screen.getByText('Possible duplicate')).toBeInTheDocument();
    expect(screen.getByText('Sunset Lawns')).toBeInTheDocument();
    expect(screen.getByText('The Grand Banquet')).toBeInTheDocument();
    expect(screen.getByText('Contacted')).toBeInTheDocument();
  });

  it('gives every row a labelled selection control', () => {
    render(renderInbox([row()]));

    expect(
      screen.getByRole('checkbox', { name: 'Select enquiry LE-2026-0001' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Select every enquiry on this page' }),
    ).toBeInTheDocument();
  });

  it('renders the empty state when nothing matched', () => {
    render(renderInbox([]));

    expect(screen.getByText('No enquiries match these filters')).toBeInTheDocument();
  });
});
