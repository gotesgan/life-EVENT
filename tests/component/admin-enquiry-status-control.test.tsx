import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { EnquiryStatusControl } from '@/components/admin/EnquiryStatusControl';
import { ALLOWED_TRANSITIONS, type EnquiryStatusValue } from '@/server/domain/enquiry-status';
import { ENQUIRY_LABELS, labelFor } from '@/components/admin/status';

/**
 * The lead status control.
 *
 * The subject of these tests is the state-machine boundary: the control must
 * offer *exactly* the targets `ALLOWED_TRANSITIONS` permits, so an
 * administrator can never pick a move the server will answer with `409`.
 *
 * The option list is queried with `role="option"` and `hidden: true`. Mantine
 * renders the combobox dropdown through a portal and keeps it in the DOM behind
 * a transition, so it is present but not part of the accessibility tree in
 * jsdom. Asserting on the complete set of rendered options is the strongest
 * available check: a target that is not in the DOM cannot be chosen.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/enquiries/e1',
}));

function renderWithProvider(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function renderedOptions(): string[] {
  return screen
    .queryAllByRole('option', { hidden: true })
    .map((option) => option.textContent?.trim() ?? '');
}

function expectedLabels(status: EnquiryStatusValue): string[] {
  return ALLOWED_TRANSITIONS[status].map((target) => labelFor(ENQUIRY_LABELS, target));
}

describe('EnquiryStatusControl', () => {
  it('offers exactly the transitions ALLOWED_TRANSITIONS permits from NEW', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <EnquiryStatusControl
        enquiryId="e1"
        enquiryListingId="el1"
        currentStatus="NEW"
        listingName="Sunset Lawns"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Move Sunset Lawns lead to' }));

    expect(new Set(renderedOptions())).toEqual(new Set(expectedLabels('NEW')));
  });

  it('does not make an illegal target actionable', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <EnquiryStatusControl
        enquiryId="e1"
        enquiryListingId="el1"
        currentStatus="NEW"
        listingName="Sunset Lawns"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Move Sunset Lawns lead to' }));

    // NEW cannot jump to CONVERTED or SHARED_WITH_PROVIDER — the provider has
    // not even been contacted — so those choices must not exist at all.
    const options = renderedOptions();
    expect(options).not.toContain(labelFor(ENQUIRY_LABELS, 'CONVERTED'));
    expect(options).not.toContain(labelFor(ENQUIRY_LABELS, 'SHARED_WITH_PROVIDER'));
    expect(options).not.toContain(labelFor(ENQUIRY_LABELS, 'LOST'));

    expect(options).toContain(labelFor(ENQUIRY_LABELS, 'CONTACTED'));
  });

  it('never offers the status the lead is already in', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <EnquiryStatusControl
        enquiryId="e1"
        enquiryListingId="el1"
        currentStatus="CONTACTED"
        listingName="Sunset Lawns"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Move Sunset Lawns lead to' }));

    const options = renderedOptions();
    expect(options).not.toContain(labelFor(ENQUIRY_LABELS, 'CONTACTED'));
    expect(new Set(options)).toEqual(new Set(expectedLabels('CONTACTED')));
  });

  it('offers no control at all for a closed lead', () => {
    expect(ALLOWED_TRANSITIONS.CONVERTED).toHaveLength(0);

    renderWithProvider(
      <EnquiryStatusControl
        enquiryId="e1"
        enquiryListingId="el1"
        currentStatus="CONVERTED"
        listingName="Sunset Lawns"
      />,
    );

    expect(screen.queryByRole('combobox', { name: /Move .* lead to/ })).not.toBeInTheDocument();
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });

  it('cannot submit until a target is chosen, and defaults to showing the update to the customer', () => {
    renderWithProvider(
      <EnquiryStatusControl
        enquiryId="e1"
        enquiryListingId="el1"
        currentStatus="QUALIFIED"
        listingName="Sunset Lawns"
      />,
    );

    expect(screen.getByRole('button', { name: 'Update status' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /Show this update to the customer/ })).toBeChecked();
  });
});
