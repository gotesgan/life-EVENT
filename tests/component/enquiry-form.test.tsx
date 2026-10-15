import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import type { ReactElement } from 'react';
import { EnquiryForm } from '@/components/enquiry/EnquiryForm';

/**
 * Behavioural tests for the enquiry form.
 *
 * These cover the four things that are expensive to get wrong and cheap to
 * regress: a submission that ignores consent, a submission that cannot be safely
 * retried (the idempotency key), a server field error that never reaches the
 * input, and a replayed enquiry that is presented as if it were new. Styling is
 * deliberately not asserted.
 */

const providers = [{ slug: 'gulmohar-banjara-banquets', name: 'Gulmohar Banjara Banquets' }];
const cityOptions = [{ value: 'mumbai', label: 'Mumbai' }];
const eventTypeOptions = [{ value: 'wedding', label: 'Wedding' }];

function renderForm(ui?: ReactElement) {
  return render(
    <MantineProvider>
      <DatesProvider settings={{ locale: 'en', firstDayOfWeek: 1, consistentWeeks: true }}>
        {ui ?? (
          <EnquiryForm
            providers={providers}
            cityOptions={cityOptions}
            eventTypeOptions={eventTypeOptions}
            policyVersion="2026-02-01"
          />
        )}
      </DatesProvider>
    </MantineProvider>,
  );
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Fills every field the API requires except the consent checkbox. */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), 'Priya Nair');
  await user.type(screen.getByLabelText(/^email/i), 'priya@example.test');
  await user.type(screen.getByLabelText(/^phone/i), '+91 90000 00001');
}

function consentCheckbox() {
  return screen.getByRole('checkbox', { name: /privacy terms/i });
}

function submitButton() {
  return screen.getByRole('button', { name: /send enquiry/i });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EnquiryForm', () => {
  it('blocks submission and reports an error when consent is not given', async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(submitButton());

    expect(
      await screen.findByText(/accept the privacy terms before sending your enquiry/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the enquiry with a stable Idempotency-Key header', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          data: {
            referenceCode: 'LE-ABCD1234',
            status: 'NEW',
            duplicate: false,
            listings: ['Gulmohar Banjara Banquets'],
          },
        },
        201,
      ),
    );

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(consentCheckbox());
    await user.click(submitButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/enquiries');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(String(init.body)) as {
      listings: string[];
      contactName: string;
      consentPrivacy: boolean;
      consentPolicyVersion: string;
    };
    expect(body.listings).toEqual(['gulmohar-banjara-banquets']);
    expect(body.contactName).toBe('Priya Nair');
    expect(body.consentPrivacy).toBe(true);
    expect(body.consentPolicyVersion).toBe('2026-02-01');

    expect(await screen.findByText('LE-ABCD1234')).toBeInTheDocument();
  });

  it('maps a 400 field error back onto the input', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request was invalid',
            details: {
              fieldErrors: { contactEmail: ['That email address cannot be used for this enquiry'] },
              formErrors: [],
            },
          },
        },
        400,
      ),
    );

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(consentCheckbox());
    await user.click(submitButton());

    expect(
      await screen.findByText('That email address cannot be used for this enquiry'),
    ).toBeInTheDocument();
  });

  it('says a duplicate enquiry was already received and shows the same reference', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          data: {
            referenceCode: 'LE-REPLAY99',
            status: 'NEW',
            duplicate: true,
            listings: ['Gulmohar Banjara Banquets'],
          },
        },
        201,
      ),
    );

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(consentCheckbox());
    await user.click(submitButton());

    expect(await screen.findByText(/already received/i)).toBeInTheDocument();
    expect(screen.getByText('LE-REPLAY99')).toBeInTheDocument();
  });
});
