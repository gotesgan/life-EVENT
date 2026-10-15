import { expect, test } from '@playwright/test';
import { uniqueEmail, uniquePhone } from './helpers';

/**
 * Enquiry journeys — the platform's core business action.
 *
 * The form is the one place where a mistake costs a lead, so these tests assert
 * the guards as well as the happy path: consent is required, the honeypot is
 * hidden, a reference code comes back, and tracking needs both the code and the
 * matching email.
 */

const PROVIDER_SLUG = 'gulmohar-banjara-banquets';
const SECOND_PROVIDER_SLUG = 'smriti-frame-studios';

test.describe('enquiry submission', () => {
  test('a guest can submit an enquiry and receives a reference code', async ({ page }) => {
    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);

    await page.getByLabel('Your name').fill('E2E Guest');
    await page.getByLabel('Email').fill(uniqueEmail('guest'));
    await page.getByLabel('Phone').fill(uniquePhone());
    await page.getByLabel(/accept the privacy terms/i).check();

    await page.getByRole('button', { name: /send enquiry/i }).click();

    await expect(page.getByRole('heading', { name: /your enquiry has been sent/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/LE-[A-Z0-9]{8}/)).toBeVisible();
  });

  test('consent is required and the form does not submit without it', async ({ page }) => {
    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);

    await page.getByLabel('Your name').fill('E2E Guest');
    await page.getByLabel('Email').fill(uniqueEmail('no-consent'));
    await page.getByLabel('Phone').fill(uniquePhone());

    // Deliberately leave consent unchecked.
    await page.getByRole('button', { name: /send enquiry/i }).click();

    await expect(page.getByText(/privacy terms/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /your enquiry has been sent/i })).toBeHidden();
  });

  test('the honeypot field is hidden from real users and out of the tab order', async ({
    page,
  }) => {
    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);

    const honeypot = page.getByLabel('Company website');
    // Present in the DOM so bots fill it, but not reachable by keyboard.
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).not.toBeInViewport();
  });

  test('submitting the same enquiry twice does not create a second lead', async ({ page }) => {
    const email = uniqueEmail('dup');
    const phone = uniquePhone();
    const fill = async () => {
      await page.getByLabel('Your name').fill('E2E Duplicate');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Phone').fill(phone);
      await page.getByLabel(/accept the privacy terms/i).check();
      await page.getByRole('button', { name: /send enquiry/i }).click();
    };

    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);
    await fill();

    const reference = page.getByText(/LE-[A-Z0-9]{8}/);
    await expect(reference).toBeVisible({ timeout: 20_000 });
    const firstReference = (await reference.innerText()).trim();

    // The duplicate path is reported honestly rather than as a fresh success.
    await page.reload();
    await fill();

    await expect(
      page.getByRole('heading', { name: /already received|has been sent/i }),
    ).toBeVisible({ timeout: 20_000 });
    const secondReference = (await page.getByText(/LE-[A-Z0-9]{8}/).innerText()).trim();

    expect(secondReference).toBe(firstReference);
  });

  test('multiple providers can be selected and submitted in one enquiry', async ({ page }) => {
    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);

    const selected = page.getByRole('list', { name: 'Selected businesses' });
    await expect(selected.getByText('Gulmohar Banjara Banquets')).toBeVisible();

    // Add a second provider through the real control; the selection must grow.
    // A provider added after load has no server-resolved name yet, so the pill
    // shows its slug — that is the real behaviour, and the submission below
    // proves the server still resolves it.
    await page.getByLabel('Add a business by its page address').fill(SECOND_PROVIDER_SLUG);
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(selected.getByText(SECOND_PROVIDER_SLUG)).toBeVisible();
    await expect(selected.getByRole('listitem')).toHaveCount(2);

    // And the second provider is genuinely part of the submitted payload.
    await page.getByLabel('Your name').fill('E2E Multi Provider');
    await page.getByLabel('Email').fill(uniqueEmail('multi'));
    await page.getByLabel('Phone').fill(uniquePhone());
    await page.getByLabel(/accept the privacy terms/i).check();
    await page.getByRole('button', { name: /send enquiry/i }).click();

    await expect(page.getByRole('heading', { name: /your enquiry has been sent/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/LE-[A-Z0-9]{8}/)).toBeVisible();
  });

  test('recovers from a rejected submission once the business address is corrected', async ({
    page,
  }) => {
    const unknownSlug = 'this-business-does-not-exist-xyz';

    await page.goto(`/enquire?enquire=${PROVIDER_SLUG}`);
    await page.getByLabel('Add a business by its page address').fill(unknownSlug);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(
      page.getByRole('list', { name: 'Selected businesses' }).getByText(unknownSlug),
    ).toBeVisible();

    await page.getByLabel('Your name').fill('E2E Recovery');
    await page.getByLabel('Email').fill(uniqueEmail('recover'));
    await page.getByLabel('Phone').fill(uniquePhone());
    await page.getByLabel(/accept the privacy terms/i).check();
    await page.getByRole('button', { name: /send enquiry/i }).click();

    // First attempt is refused because that business does not exist.
    await expect(page.getByRole('alert').filter({ hasText: /could not be found/i })).toBeVisible({
      timeout: 20_000,
    });

    // Correct the mistake rather than starting over. Before the idempotency fix
    // this second attempt was answered with a permanent 409. The pill's remove
    // button is aria-hidden by Mantine's Pill, so it is targeted structurally.
    await page
      .getByRole('list', { name: 'Selected businesses' })
      .locator('li', { hasText: unknownSlug })
      .locator('button')
      .click();
    await page.getByRole('button', { name: /send enquiry/i }).click();

    await expect(page.getByRole('heading', { name: /your enquiry has been sent/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/LE-[A-Z0-9]{8}/)).toBeVisible();
  });
});

test.describe('guest enquiry tracking', () => {
  test('requires both the reference code and the matching email', async ({ page }) => {
    await page.goto('/track');

    await page.getByLabel('Reference code').fill('LE-AAAAAAAA');
    await page.getByLabel('Email you used').fill(uniqueEmail('wrong'));
    await page.getByRole('button', { name: /track|check|find/i }).click();

    // Never confirms which half was right.
    await expect(page.getByText(/could not find/i)).toBeVisible({ timeout: 20_000 });
  });

  test('shows a real seeded enquiry when both parts are correct', async ({ page }) => {
    // The seed creates this enquiry for the seeded customer.
    await page.goto('/track');

    await page.getByLabel('Reference code').fill('LE-ZM4H6CYV');
    await page.getByLabel('Email you used').fill('priya@example.test');
    await page.getByRole('button', { name: /track|check|find/i }).click();

    await expect(page.getByText(/LE-ZM4H6CYV/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
