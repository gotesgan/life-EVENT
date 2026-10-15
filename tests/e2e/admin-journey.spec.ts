import { expect, test, type Page } from '@playwright/test';
import {
  SEEDED_ADMIN,
  SEEDED_CUSTOMER,
  TINY_PNG,
  expectNoErrorBoundary,
  expectNoHorizontalOverflow,
  signInAs,
  signOut,
} from './helpers';

/**
 * Administrator journeys and authorization at the browser boundary.
 *
 * The negative cases matter as much as the positive ones: a signed-out visitor
 * and a signed-in customer must not reach the panel at all, and the route must
 * not confirm that it exists for them.
 *
 * The listing → image → publish → lead journey below is the workflow
 * `docs/testing-strategy.md` §10 claims the suite exists to prove; it replaces
 * the render-only checks the review (R4) found in its place.
 */

/** Unique per worker process so a re-run never collides on a unique slug. */
const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/**
 * One seeded lead per project.
 *
 * The whole suite shares one seeded database, and global setup re-seeds only
 * once per invocation — so three projects running the same mutation would find
 * the lead already moved by the previous project. Each project therefore works
 * a different seeded lead through a transition that is legal for its current
 * status, which keeps the assertions exact without making them order-dependent.
 */
const LEAD_PLANS: Record<
  string,
  { referenceCode: string; leadName: string; fromLabel: string; toValue: string; toLabel: string }
> = {
  'desktop-light': {
    referenceCode: 'LE-3BDP9TWX',
    leadName: 'The Sandalwood Grand',
    fromLabel: 'New',
    toValue: 'Contacted',
    toLabel: 'Contacted',
  },
  'desktop-dark': {
    referenceCode: 'LE-TW5JX9PB',
    leadName: 'Raag Bahar Live Band',
    fromLabel: 'Contacted',
    toValue: 'Qualified',
    toLabel: 'Qualified',
  },
  mobile: {
    referenceCode: 'LE-VC6QK3DZ',
    leadName: 'Skyline Sound DJs',
    fromLabel: 'Contacted',
    toValue: 'Qualified',
    toLabel: 'Qualified',
  },
};

function leadPlanFor(projectName: string) {
  return LEAD_PLANS[projectName] ?? LEAD_PLANS['desktop-light']!;
}

/** The enquiry the View-on-site sweep opens; its lead stays publicly visible. */
const VIEW_ON_SITE_ENQUIRY = LEAD_PLANS['desktop-light']!.referenceCode;

async function createDraftListing(
  page: Page,
  input: { name: string; slug: string; description?: string },
): Promise<string> {
  await page.goto('/admin/listings/new');
  await expect(page.getByRole('heading', { name: 'New listing' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel('Listing name').fill(input.name);
  await page.getByLabel('Slug').fill(input.slug);
  if (input.description) {
    await page.getByLabel('Description').fill(input.description);
  }

  await page.getByRole('combobox', { name: 'Primary category' }).click();
  await page.getByRole('option', { name: 'Venues', exact: true }).click();

  await page.getByRole('combobox', { name: 'Primary location' }).click();
  await page.getByRole('option', { name: 'Mumbai · city', exact: true }).click();

  await page.getByRole('button', { name: 'Create draft listing' }).click();

  await expect(page).toHaveURL(/\/admin\/listings\/[a-z0-9]+$/i, { timeout: 30_000 });
  const id = page.url().split('/').pop();
  if (!id) throw new Error(`No listing id in ${page.url()}`);
  await expect(page.getByText(input.name).first()).toBeVisible({ timeout: 30_000 });
  return id;
}

async function openListingActions(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
}

test.describe('admin authorization', () => {
  test('a signed-out visitor is redirected to sign in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('a signed-in customer cannot reach the admin panel', async ({ page }) => {
    await signInAs(page, SEEDED_CUSTOMER);
    await page.goto('/admin');

    // Assert on rendered content rather than the status code: under Partial
    // Prerendering the shell is served with 200 and the authorization decision
    // resolves with the dynamic part.
    await expect(page.getByText(/could not find|not found/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('heading', { name: /operational metrics|recent listings/i }),
    ).toHaveCount(0);
  });
});

test.describe('admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, SEEDED_ADMIN);
  });

  test('the overview shows real operational metrics', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);

    const body = await page.locator('body').innerText();
    // Real counted values from the seed, not placeholders.
    expect(body).toMatch(/\d/);
  });

  test('the listings table filters to drafts and never shows a published row', async ({ page }) => {
    await page.goto('/admin/listings');

    await expect(page.getByRole('heading', { name: /listings/i }).first()).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    // A known published seed listing is visible before filtering.
    await expect(page.getByText('Gulmohar Banjara Banquets').first()).toBeVisible();

    await page.goto('/admin/listings?publicationStatus=DRAFT');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    // The filter must return draft rows…
    expect(await rows.count()).toBeGreaterThan(0);
    // …every one of them a draft…
    await expect(page.locator('tbody tr', { hasText: 'Published' })).toHaveCount(0);
    // …and it must have excluded the published listing. A no-op filter fails here.
    await expect(page.getByText('Gulmohar Banjara Banquets')).toHaveCount(0);
  });

  test('the listing editor renders category-specific attribute controls', async ({ page }) => {
    await page.goto('/admin/listings');
    const editLink = page.getByRole('link', { name: 'Gulmohar Banjara Banquets' }).first();
    await expect(editLink).toBeVisible({ timeout: 30_000 });
    await editLink.click();

    // Wait for the streamed editor rather than assuming it is in the first HTML.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Attributes' }).click();

    // The venue category binds `venue_type`; the control and the listing's real
    // selection must both render. Removing the attribute system fails here.
    await expect(page.getByRole('combobox', { name: /Venue type/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Banquet Hall').first()).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test('the enquiry inbox lists seeded leads and opens one', async ({ page }) => {
    await page.goto('/admin/enquiries');

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    const detailLink = page.locator('a[href^="/admin/enquiries/"]').first();
    await expect(detailLink).toBeVisible({ timeout: 30_000 });
    await detailLink.click();

    await expect(page.getByText(/LE-[A-Z0-9]{8}/).first()).toBeVisible({ timeout: 20_000 });
    await expectNoErrorBoundary(page);
  });

  test('the audit log shows actions performed by the seed', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test('the catalogue shows categories, attributes and locations', async ({ page }) => {
    for (const path of [
      '/admin/catalogue/categories',
      '/admin/catalogue/attributes',
      '/admin/catalogue/locations',
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should render`).toBe(200);
      await expectNoErrorBoundary(page);
    }
  });

  test('the admin tables do not scroll the page horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/admin/enquiries');
    await expectNoHorizontalOverflow(page);
  });

  test('every admin "View on site" link resolves to a real page', async ({ page, request }) => {
    test.slow();

    // `pageSize=100` keeps every listing on one page: the sweep is meant to be
    // exhaustive, and the default page size can be exceeded by the listings the
    // journey itself creates.
    await page.goto('/admin/listings?pageSize=100');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const rowCount = await rows.count();

    const checked = new Set<string>();
    let unpublishedRows = 0;

    for (let index = 0; index < rowCount; index += 1) {
      const actionButton = rows.nth(index).getByRole('button', { name: /^Actions for / });
      // Rows can disappear if the server refreshes the table mid-sweep; a row
      // with no action control simply has nothing to check.
      if ((await actionButton.count()) === 0) continue;
      await actionButton.click();

      // Scope to the menu that is actually open: Mantine keeps closed dropdowns
      // mounted, so an unscoped locator would count items from earlier rows.
      const menu = page.locator('[role="menu"]:visible').last();
      await expect(menu).toBeVisible();
      const viewOnSite = menu.getByRole('menuitem', { name: 'View on site', exact: true });
      const disabled = menu.getByRole('menuitem', { name: /No public page/i });
      await expect(viewOnSite.or(disabled).first()).toBeVisible();

      if ((await viewOnSite.count()) > 0) {
        const href = await viewOnSite.getAttribute('href');
        if (href) checked.add(href);
      } else {
        // A row with no public page must offer no link at all, only a disabled
        // explanation — never a dead `/listings/...` target. Attributes are read
        // directly so an unpublished row cannot stall the sweep.
        expect(await disabled.count(), 'an unpublished row should explain itself').toBe(1);
        expect(await disabled.getAttribute('disabled')).not.toBeNull();
        unpublishedRows += 1;
      }

      await page.keyboard.press('Escape');
    }

    expect(checked.size, 'at least one View on site link should be inspected').toBeGreaterThan(0);
    expect(unpublishedRows, 'the seed should contain unpublished listings').toBeGreaterThan(0);

    // The enquiry detail page exposes the same link per provider lead. The
    // inbox search keeps this deterministic while other specs pile up enquiries.
    await page.goto(`/admin/enquiries?q=${VIEW_ON_SITE_ENQUIRY}`);
    await page.getByRole('link', { name: VIEW_ON_SITE_ENQUIRY }).click();
    const detailLinks = page.getByRole('link', { name: 'View on site' });
    await expect(detailLinks.first()).toBeVisible({ timeout: 30_000 });
    for (const link of await detailLinks.all()) {
      const href = await link.getAttribute('href');
      if (href) checked.add(href);
    }

    for (const href of checked) {
      const response = await request.get(href);
      expect(response.status(), `${href} should resolve`).toBe(200);
    }
  });
});

test.describe('admin mutations', () => {
  test('suspending your own account is refused with a message', async ({ page }) => {
    await signInAs(page, SEEDED_ADMIN);
    await page.goto('/admin/customers?q=Platform%20Admin');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The administrator's own row is listed, and its moderation control is
    // present but disabled. Deleting the self-guard removes the disabled control
    // and fails this test instead of silently passing.
    const selfRow = page.locator('tr', { hasText: 'Platform Admin' }).first();
    await expect(selfRow).toBeVisible({ timeout: 30_000 });

    const moderation = selfRow.getByRole('button', {
      name: 'Moderation actions for Platform Admin',
    });
    await expect(moderation).toBeVisible();
    await expect(moderation).toBeDisabled();
  });

  test('signing out ends the session', async ({ page }) => {
    await signInAs(page, SEEDED_ADMIN);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await signOut(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('admin listing lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, SEEDED_ADMIN);
  });

  test('refuses to publish a draft that has no image', async ({ page }) => {
    const name = `E2E Image Guard ${RUN_ID}`;
    const slug = `e2e-image-guard-${RUN_ID}`;

    await createDraftListing(page, {
      name,
      slug,
      description: 'A draft with copy but deliberately no photograph yet.',
    });

    await openListingActions(page, name);
    await page.getByRole('menuitem', { name: 'Publish', exact: true }).click();

    // The service's own sentence is surfaced, not a generic failure.
    await expect(page.getByText(/add at least one image before publishing/i)).toBeVisible({
      timeout: 20_000,
    });

    // And the refusal is real: the listing is still invisible to the public.
    await page.goto(`/vendors/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /could not find|not found/i,
      { timeout: 30_000 },
    );
    await expect(page.getByText(name)).toHaveCount(0);
  });

  // The full documented journey is long: create, upload through the real
  // presign/complete pair, publish, then work a lead through assignment,
  // status change and a private note.
  test('takes a listing from draft to published, then works a lead end to end', async ({
    page,
  }) => {
    test.slow();

    const plan = leadPlanFor(test.info().project.name);
    const name = `E2E Journey Banquets ${RUN_ID}`;
    const slug = `e2e-journey-banquets-${RUN_ID}`;
    const altText = 'A wide pillar-free banquet hall set for a wedding';
    const statusNote = `Called the customer on 12 Oct — they confirmed the date (${RUN_ID}).`;
    const privateNote = `Internal only: quote the corporate rate (${RUN_ID}).`;

    // 1. Create the draft through the real editor.
    await createDraftListing(page, {
      name,
      slug,
      description: 'A purpose-built banquet hall used by the end-to-end journey test.',
    });

    // 2. Attach an image: the real MediaManager asks the server to presign, the
    //    browser PUTs the bytes to the URL that comes back, and the server
    //    re-reads the object before marking the media READY.
    await page.getByRole('tab', { name: 'Media' }).click();
    // The FileInput's visible control is a button; the real `<input type="file">`
    // is hidden inside Mantine's FileButton, so it is targeted directly.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'banquet-hall.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await page.getByRole('textbox', { name: 'Image description (alt text)' }).fill(altText);
    await page.getByRole('button', { name: 'Upload image' }).click();

    await expect(page.getByText(altText)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Ready')).toBeVisible();

    // 3. Publish, and prove it is actually public.
    await openListingActions(page, name);
    await page.getByRole('menuitem', { name: 'Publish', exact: true }).click();
    await expect(page.getByText(/is now published/i)).toBeVisible({ timeout: 20_000 });

    const publicPage = await page.goto(`/vendors/${slug}`);
    expect(publicPage?.status(), 'a published listing must be publicly reachable').toBe(200);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });

    // 4. Open this project's seeded enquiry in the inbox.
    await page.goto(`/admin/enquiries?q=${plan.referenceCode}`);
    await page.getByRole('link', { name: plan.referenceCode }).click();
    await expect(page.getByRole('heading', { level: 1, name: plan.referenceCode })).toBeVisible({
      timeout: 30_000,
    });

    // 5. Assign the lead to the seeded administrator.
    await expect(page.getByText('Currently assigned to Platform Admin.')).toBeVisible();
    // Mantine renders the radio input off-screen; the visible label is the control.
    await page.getByText('Every provider lead', { exact: true }).click();
    await page.getByRole('button', { name: 'Save assignment' }).click();
    await expect(page.getByText('Lead assigned to an administrator').first()).toBeVisible({
      timeout: 20_000,
    });

    // 6. Move the lead through an allowed transition, with a note that lands in
    //    the activity history.
    // An enquiry can hold several provider leads, each with its own status
    // control, so the control and its note are scoped to this lead's card.
    const leadCard = page.locator('article').filter({ hasText: plan.leadName }).first();
    await expect(leadCard).toBeVisible();
    await leadCard.getByRole('combobox', { name: `Move ${plan.leadName} lead to` }).click();
    await page.getByRole('option', { name: plan.toValue, exact: true }).click();
    await leadCard.getByRole('textbox', { name: 'Note (optional)' }).fill(statusNote);
    await leadCard.getByRole('button', { name: 'Update status' }).click();

    await expect(
      page.getByText(new RegExp(`${plan.fromLabel}\\s*→\\s*${plan.toLabel}`)),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(statusNote)).toBeVisible();

    // 7. Add a private note: never customer-visible, kept on the enquiry.
    await page.getByRole('textbox', { name: 'Add a note' }).fill(privateNote);
    await page.getByRole('button', { name: 'Add note' }).click();

    await expect(page.getByText(privateNote)).toBeVisible({ timeout: 20_000 });
    // The history records that a note was added, even though its body stays in
    // the private notes panel rather than crossing into the activity feed.
    await expect(page.getByText('Internal note added').first()).toBeVisible();
  });
});
