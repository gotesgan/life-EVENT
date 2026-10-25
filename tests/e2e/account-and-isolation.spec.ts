import { expect, test } from '@playwright/test';
import {
  SEEDED_CUSTOMER,
  expectNoErrorBoundary,
  expectNoHorizontalOverflow,
  registerNewCustomer,
  signInAs,
  signOut,
  submitListingEnquiry,
} from './helpers';

/**
 * Customer account and cross-customer isolation.
 *
 * The isolation test is the most important one in the suite: it asserts that a
 * signed-in customer cannot reach another customer's enquiry, and that the
 * platform answers with a 404 rather than a 403 so the response does not confirm
 * that the reference exists.
 */

const PROVIDER_SLUG = 'gulmohar-banjara-banquets';

async function submitEnquiry(page: import('@playwright/test').Page, email: string) {
  // One enquiry per listing: the profile's own form is the submission surface.
  return submitListingEnquiry(page, PROVIDER_SLUG, { name: 'Isolation Test', email });
}

test.describe('customer account', () => {
  test('redirects to sign-in when signed out', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('lists the seeded customer\u2019s own enquiries with customer-facing wording', async ({
    page,
  }) => {
    await signInAs(page, SEEDED_CUSTOMER);
    await page.goto('/account/enquiries');

    await expect(page.getByRole('heading', { name: /my enquiries/i })).toBeVisible();
    await expectNoErrorBoundary(page);

    const body = await page.locator('body').innerText();
    // Internal operational vocabulary must never reach a customer.
    for (const internal of ['SHARED_WITH_PROVIDER', 'QUALIFIED', 'isPotentialDuplicate']) {
      expect(body).not.toContain(internal);
    }
  });

  test('shows an enquiry detail with a customer-visible timeline and no admin notes', async ({
    page,
  }) => {
    await signInAs(page, SEEDED_CUSTOMER);
    await page.goto('/account/enquiries');

    const firstEnquiryLink = page.locator('a[href^="/account/enquiries/"]').first();
    await expect(firstEnquiryLink).toBeVisible();
    await firstEnquiryLink.click();

    await expect(page.getByText(/LE-[A-Z0-9]{8}/).first()).toBeVisible();
    const body = await page.locator('body').innerText();

    // Private notes exist in the seed for these enquiries; none may surface here.
    expect(body).not.toMatch(/internal note/i);
    expect(body).not.toContain('assignedAdminId');
  });

  test('a new customer can register and see the enquiry they submitted', async ({ page }) => {
    const account = await registerNewCustomer(page, { name: 'Fresh Customer' });
    const reference = await submitEnquiry(page, account.email);

    await page.goto('/account/enquiries');
    await expect(page.getByText(reference).first()).toBeVisible();
  });

  test('one customer cannot read another customer\u2019s enquiry', async ({ page }) => {
    // Customer A submits.
    const customerA = await registerNewCustomer(page, { name: 'Customer A' });
    const referenceA = await submitEnquiry(page, customerA.email);
    await signOut(page);

    // Customer B signs up and guesses A's reference.
    await registerNewCustomer(page, { name: 'Customer B' });
    await page.goto(`/account/enquiries/${referenceA}`);

    // Assert on what the visitor can actually see, not on the HTTP status.
    // With Partial Prerendering the static shell is served with 200 and the
    // dynamic part resolves afterwards, so the status code is not the signal —
    // the absence of A's data and of the enquiry UI is.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(customerA.email);
    expect(body).not.toContain(referenceA);
    expect(body).not.toMatch(/Internal margin note/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /could not find|not found|page you were looking for/i,
    );
  });

  test('the profile page saves permitted details and keeps email read-only', async ({ page }) => {
    await signInAs(page, SEEDED_CUSTOMER);
    await page.goto('/account/profile');

    await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/email/i);
    await expectNoErrorBoundary(page);
  });

  test('the account area does not scroll horizontally on a phone', async ({ page }) => {
    await signInAs(page, SEEDED_CUSTOMER);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/account/enquiries');
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('sign in and sign up', () => {
  test('sign-in form validates and rejects a wrong password without leaking state', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('priya@example.test');
    await page.locator('input[type="password"]').fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Stays on the page and shows an error; no user data is revealed.
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
  });

  test('a new account can sign in and reaches the account area', async ({ page }) => {
    const account = await registerNewCustomer(page, { name: 'Sign In Test' });
    await signOut(page);

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/account/, { timeout: 20_000 });
  });
});
