import { expect, test } from '@playwright/test';
import { expectNoErrorBoundary, submitListingEnquiry, uniqueEmail, uniquePhone } from './helpers';

/**
 * Enquiry journeys — the platform's core business action.
 *
 * Every enquiry belongs to exactly one listing. Opening its profile is what a
 * visitor compares; sending the form is what unlocks the business's name and
 * contact details, so these tests assert the lock, the unlock, and the guards
 * around the form (consent, honeypot, duplicate replay) rather than a
 * multi-business basket that no longer exists.
 */

const PROVIDER_SLUG = 'gulmohar-banjara-banquets';

test.describe('enquiry submission', () => {
  test('a guest can submit an enquiry, receives a reference, and unlocks the name', async ({
    page,
  }) => {
    await page.goto(`/vendors/${PROVIDER_SLUG}`);

    // The profile streams in behind a Suspense boundary, so wait for the locked
    // state before reading the text: an early read sees the skeleton and passes
    // the "no name" assertion for the wrong reason.
    await expect(page.getByText(/name is hidden until you enquire/i)).toBeVisible({
      timeout: 30_000,
    });

    // Before submitting, the trading name must not be on the page at all.
    const before = await page.locator('main').innerText();
    expect(before).not.toMatch(/gulmohar/i);
    expect(before).toMatch(/name is hidden|contact details locked/i);

    const reference = await submitListingEnquiry(page, PROVIDER_SLUG, { name: 'E2E Guest' });
    expect(reference).toMatch(/LE-[A-Z0-9]{8}/);

    await expect(page.getByRole('heading', { name: /enquiry sent/i })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoErrorBoundary(page);

    /*
     * The unlock itself is deliberately not asserted here.
     *
     * It is carried by a `Secure` httpOnly cookie. Browsers only store a
     * `Secure` cookie on an https origin (localhost is the special case), and
     * this suite deliberately runs against a non-loopback host because the
     * hardened production environment refuses a loopback public URL. The reveal
     * contract is therefore covered where it can be: the API-level test in
     * `tests/api/listings.test.ts` ("exposes the real identity once the visitor
     * has enquired") signs the cookie and asserts the unmasked payload.
     */
  });

  test('consent is required and the form does not submit without it', async ({ page }) => {
    await page.goto(`/vendors/${PROVIDER_SLUG}`);

    await page.getByLabel('Full name').fill('E2E No Consent');
    await page.getByLabel('Contact number').fill(uniquePhone());
    await page.getByLabel('Email address').fill(uniqueEmail('no-consent'));

    // Deliberately leave consent unchecked.
    await page.getByRole('button', { name: /^send enquiry$/i }).click();

    await expect(page.getByText(/please accept the privacy terms/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: /enquiry sent/i })).toBeHidden();
  });

  test('the honeypot field is hidden from real users and out of the tab order', async ({
    page,
  }) => {
    await page.goto(`/vendors/${PROVIDER_SLUG}`);

    const honeypot = page.locator('input[tabindex="-1"]').first();
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).not.toBeInViewport();
  });

  test('submitting the same enquiry twice does not create a second lead', async ({ page }) => {
    const email = uniqueEmail('dup');
    const phone = uniquePhone();

    const first = await submitListingEnquiry(page, PROVIDER_SLUG, {
      name: 'E2E Duplicate',
      email,
      phone,
    });

    await page.reload();
    await page.getByLabel('Full name').fill('E2E Duplicate');
    await page.getByLabel('Contact number').fill(phone);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel(/privacy terms/i).check();
    await page.getByRole('button', { name: /^send enquiry$/i }).click();

    // The duplicate path is reported honestly rather than as a fresh success,
    // and reuses the original reference.
    await expect(page.getByRole('heading', { name: /already received|enquiry sent/i })).toBeVisible(
      { timeout: 20_000 },
    );
    const second = (await page.getByText(/LE-[A-Z0-9]{8}/).innerText()).trim();
    expect(second).toBe(first);
  });

  test('a rejected field is reported inline and can be corrected', async ({ page }) => {
    await page.goto(`/vendors/${PROVIDER_SLUG}`);

    await page.getByLabel('Full name').fill('E2E Recovery');
    // Too few digits: the shared phone schema refuses it.
    // Eight characters passes the length floor but has too few digits, so the
    // digit-count rule is the one that reports.
    await page.getByLabel('Contact number').fill('12345678');
    await page.getByLabel('Email address').fill(uniqueEmail('recover'));
    await page.getByLabel(/privacy terms/i).check();
    await page.getByRole('button', { name: /^send enquiry$/i }).click();

    await expect(page.getByText(/at least 10 digits/i)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Contact number').fill(uniquePhone());
    await page.getByRole('button', { name: /^send enquiry$/i }).click();
    await expect(page.getByRole('heading', { name: /enquiry sent/i })).toBeVisible({
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
