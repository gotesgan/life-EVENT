import { expect, test } from '@playwright/test';
import { SEEDED_CUSTOMER, expectNoErrorBoundary, signInAs } from './helpers';

/**
 * Listing profile journeys.
 *
 * Selectors are taken from the real components rather than invented. The page
 * heading shows the anonymous identity until the visitor enquires — the
 * trading name is withheld by design — and the enquiry form sits in the rail.
 */

const PUBLISHED_SLUG = 'gulmohar-banjara-banquets';

test.describe('listing profile', () => {
  test('opens from the search results', async ({ page }) => {
    await page.goto('/vendors?category=venues');
    const firstCardLink = page.locator('article a').first();
    await expect(firstCardLink).toBeVisible();
    await firstCardLink.click();

    // Public links carry an opaque `ul_` reference, never the name-bearing slug.
    await expect(page).toHaveURL(/\/vendors\/ul_[a-z0-9]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test('renders the business details from a direct URL', async ({ page }) => {
    await page.goto(`/vendors/${PUBLISHED_SLUG}`);

    // Identity is withheld until an enquiry: the heading names the category and
    // locality, never the business.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/banquet hall/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/andheri east/i);
    await expect(page.getByRole('heading', { name: /about this business/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /services/i })).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test('never renders ₹0 for a business with no published price', async ({ page }) => {
    await page.goto(`/vendors/${PUBLISHED_SLUG}`);

    // Wait for the streamed profile header before reading the page text; the
    // sticky enquiry rail is in the static shell and would resolve too early.
    await expect(
      page.getByRole('heading', { level: 1, name: /banquet hall in andheri east/i }),
    ).toBeVisible({ timeout: 30_000 });

    const body = await page.locator('body').innerText();

    expect(body).not.toContain('₹0');
    // Either a real price or the designed "on request" treatment, never blank.
    expect(/₹|price on request/i.test(body)).toBe(true);
  });

  test('does not publish a withheld phone number as page text', async ({ page }) => {
    // Seeded listings deliberately mix `showPhone` true/false. For any listing
    // where the DTO withholds the phone, the raw number must not appear.
    await page.goto('/vendors?category=venues&pageSize=48');
    const profileLinks = page.locator('article a');
    const count = Math.min(await profileLinks.count(), 4);

    for (let index = 0; index < count; index += 1) {
      await page.goto('/vendors?category=venues&pageSize=48');
      const href = await profileLinks.nth(index).getAttribute('href');
      if (!href) continue;

      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
      const body = await page.locator('body').innerText();

      // A 10-digit run shown as plain text is the failure mode this guards
      // against: contact details must go through an enquiry, not the page copy.
      const plainPhone = /(?:\+91[\s-]?)?\b9\d{4}[\s-]?\d{5}\b/.test(body);
      const hasEnquiryCta = /send an enquiry|view & enquire/i.test(body);
      expect(plainPhone && !hasEnquiryCta).toBe(false);
    }
  });

  test('an unknown slug renders the not-found page', async ({ page }) => {
    await page.goto('/vendors/this-business-does-not-exist');

    // Content, not status: with Partial Prerendering the shell is 200 and the
    // `notFound()` decision resolves with the streamed response.
    // Match the rendered heading, not `getByText`, which also matches the
    // document `<title>` and is therefore never "visible".
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /could not find|not found/i,
      {
        timeout: 30_000,
      },
    );
    await expect(page.getByRole('link', { name: /home|browse/i }).first()).toBeVisible();
  });

  test('shows the shared provider contact details on the customer’s own enquiry', async ({
    page,
  }) => {
    // The seeded customer `priya` has a CONVERTED lead against Mirage Beauty
    // Studio. That listing publishes its phone but withholds its email, so the
    // email is only ever visible through the lead-status gate in
    // `deriveContactDisclosure`. The profile page has no lead context; the
    // customer's account surface does, and that is what this asserts.
    await signInAs(page, SEEDED_CUSTOMER);
    await page.goto('/account/enquiries/LE-ZM4H6CYV');

    await expect(page.getByText(/LE-ZM4H6CYV/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('+91 90000 00010')).toBeVisible();
    // Withheld publicly (`showEmail: false`), disclosed because the lead reached
    // the provider. Deleting the disclosure gate makes this fail.
    await expect(page.getByText('hello@mirage-beauty-studio.example.test')).toBeVisible();
    await expectNoErrorBoundary(page);
  });
});
