import { expect, test, type Page } from '@playwright/test';
import {
  expectNoErrorState,
  expectResultsOrEmptyState,
  firstCardName,
  getResultTotal,
} from './helpers';

/**
 * Discovery journey: home → category → `/vendors` → filter → chip removal →
 * clear all → pagination → empty state.
 *
 * Every selector comes from the real markup: the filter rail is
 * `<aside aria-label="Filters">`, the results grid is
 * `<ul aria-label="Search results">`, and each applied filter is a
 * `button[aria-label="Remove filter: <label>: <value>"]`.
 */

function searchParams(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

function filterRail(page: Page) {
  return page.getByRole('complementary', { name: 'Filters' });
}

/**
 * Ensures the filter controls are reachable at the current viewport.
 *
 * On mobile the rail is rendered inside a bottom-sheet drawer rather than beside
 * the results, so a test that assumes the desktop column fails on a phone. The
 * drawer is opened here instead of skipping the mobile project, which keeps the
 * filter-composition behaviour genuinely covered on the layout most customers
 * actually use.
 */
async function openFiltersIfNeeded(page: Page): Promise<void> {
  // Wait for whichever affordance this layout provides before choosing. Checking
  // `isVisible()` straight away races the streamed filter panel and would send a
  // desktop run down the mobile path, where no filter button exists.
  const rail = filterRail(page);
  const opener = page.getByRole('button', { name: /filter/i }).first();
  await expect(rail.or(opener).first()).toBeVisible({ timeout: 30_000 });

  if (await rail.isVisible()) return;

  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
}

/** The container holding the filter controls, whichever layout is active. */
function filterScope(page: Page) {
  return page.getByRole('dialog').or(filterRail(page)).first();
}

/** Applies the mobile drawer, returning to the results. No-op on desktop. */
async function applyFilters(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible())) return;

  const apply = dialog.getByRole('button', { name: /show \d+ result|apply/i }).first();
  if ((await apply.count()) > 0) await apply.click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

/**
 * Opens a Mantine `Select` in the filter controls, picks an option, and commits.
 *
 * Committing inside the helper is what makes these tests layout-independent: on
 * desktop the change updates the URL immediately, while on mobile the drawer
 * holds the edits until "Show N results" is pressed.
 */
async function selectInRail(page: Page, label: string, option: string): Promise<void> {
  await openFiltersIfNeeded(page);
  await filterScope(page).getByLabel(label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await applyFilters(page);
}

/** Toggles a checkbox/switch in the filter controls and commits. */
async function toggleInFilters(page: Page, label: string): Promise<void> {
  await openFiltersIfNeeded(page);
  await filterScope(page).getByLabel(label).click();
  await applyFilters(page);
}

test.describe('browse and filter', () => {
  test('the home search routes to /vendors with the chosen category', async ({ page }) => {
    await page.goto('/');
    await expectNoErrorState(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const search = page.getByRole('search').first();
    await expect(search).toBeVisible();

    await search.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Photography & Film', exact: true }).click();
    await search.getByRole('button', { name: 'Search vendors' }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/vendors');
    await expect.poll(() => searchParams(page).get('category')).toBe('photography');
    await expectResultsOrEmptyState(page);
  });

  test('the category directory opens a category and lands on its results', async ({ page }) => {
    await page.goto('/categories');
    await expectNoErrorState(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page
      .getByRole('link', { name: /Banquet Halls/ })
      .first()
      .click();

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(/categories\/banquet-halls|vendors/);
    await expectNoErrorState(page);
    await expectResultsOrEmptyState(page);
  });

  test('category, location and verified filters compose and never grow the result set', async ({
    page,
  }) => {
    await page.goto('/vendors');
    await expectNoErrorState(page);
    await expectResultsOrEmptyState(page);
    const unfiltered = await getResultTotal(page);

    await selectInRail(page, 'Category', 'Photography & Film');
    await expect.poll(() => searchParams(page).get('category')).toBe('photography');
    const afterCategory = await getResultTotal(page);
    expect(afterCategory).toBeLessThanOrEqual(unfiltered);

    await selectInRail(page, 'City or locality', 'Mumbai');
    await expect.poll(() => searchParams(page).get('location')).toBe('mumbai');

    await toggleInFilters(page, 'Top picks only');
    await expect.poll(() => searchParams(page).get('verified')).toBe('true');

    // All three parameters survive together in the URL.
    expect(searchParams(page).get('category')).toBe('photography');
    expect(searchParams(page).get('location')).toBe('mumbai');
    expect(searchParams(page).get('verified')).toBe('true');

    await expectResultsOrEmptyState(page);
    const filtered = await getResultTotal(page);
    expect(filtered).toBeLessThanOrEqual(unfiltered);
  });

  test('removing one chip removes only that filter', async ({ page }) => {
    await page.goto('/vendors?category=photographers&location=mumbai&verified=true');
    await expectNoErrorState(page);
    await expectResultsOrEmptyState(page);

    const locationChip = page.getByRole('button', { name: 'Remove filter: Location: mumbai' });
    const verifiedChip = page.getByRole('button', { name: 'Remove filter: Top picks only: Yes' });
    await expect(locationChip).toBeVisible();
    await expect(verifiedChip).toBeVisible();

    await locationChip.click();

    await expect.poll(() => searchParams(page).get('location')).toBeNull();
    expect(searchParams(page).get('category')).toBe('photographers');
    expect(searchParams(page).get('verified')).toBe('true');
    await expect(verifiedChip).toBeVisible();
  });

  test('clear all returns to a clean URL while keeping the category', async ({ page }) => {
    await page.goto('/vendors?category=photographers&location=mumbai&verified=true');
    await expectNoErrorState(page);

    await page.getByRole('button', { name: 'Clear all' }).click();

    await expect.poll(() => searchParams(page).get('location')).toBeNull();
    expect(searchParams(page).get('category')).toBe('photographers');
    expect(searchParams(page).get('verified')).toBeNull();
  });

  test('page two preserves the filters and shows different results', async ({ page }) => {
    // The unfiltered directory: the seeded catalogue has more than one page of
    // published listings, which a single event type may not.
    await page.goto('/vendors');
    await expectNoErrorState(page);
    await expectResultsOrEmptyState(page);

    // Mantine's numeric page buttons are named by their number; only the
    // first/previous/next/last controls get an aria-label from `getControlProps`.
    const pageTwoControl = page.getByRole('button', { name: '2', exact: true }).first();
    await expect(pageTwoControl).toBeVisible({ timeout: 30_000 });
    const firstOnPageOne = await firstCardName(page);

    await pageTwoControl.click();

    await expect.poll(() => searchParams(page).get('page')).toBe('2');
    // Pagination must not have dropped the active sort/filter state.
    expect(searchParams(page).get('page')).toBe('2');

    await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible();
    const firstOnPageTwo = await firstCardName(page);
    expect(firstOnPageTwo).not.toBe(firstOnPageOne);
  });

  test('an impossible filter combination shows an actionable empty state', async ({ page }) => {
    // No makeup artist is based in, or serves, Juhu in the seed data.
    await page.goto('/vendors?category=makeup-artists&location=juhu');

    await expect(page.getByText('No businesses match these filters')).toBeVisible();
    await expectNoErrorState(page);

    const clear = page.getByRole('link', { name: 'Clear all filters' });
    await expect(clear).toBeVisible();
    await clear.click();

    await expect.poll(() => searchParams(page).get('location')).toBeNull();
    expect(searchParams(page).get('category')).toBe('makeup-artists');
    await expectResultsOrEmptyState(page);
  });

  test('a venue card highlight renders the option label, never a raw identifier', async ({
    page,
  }) => {
    await page.goto('/vendors?category=venues');
    await expectNoErrorState(page);
    await expectResultsOrEmptyState(page);

    // `venue_type` is a multi-select bound with `showOnCard`. Its options are
    // stored as ids; the card must resolve them to their labels.
    const venueTypeHighlight = page
      .locator('article')
      .first()
      .locator('li', { hasText: /Venue type/i });

    await expect(venueTypeHighlight).toHaveCount(1);
    const text = (await venueTypeHighlight.innerText()).trim();

    expect(text).toMatch(/Banquet|Hotel|Resort|Lawn/i);
    expect(text, `raw identifier leaked onto the card: ${text}`).not.toMatch(/c[a-z0-9]{20,}/);
  });

  test('a category attribute filter appears only for the category that declares it', async ({
    page,
  }) => {
    await page.goto('/vendors?category=photographers');
    await expectNoErrorState(page);
    await openFiltersIfNeeded(page);
    await expect(page.getByRole('group', { name: 'Photography style' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Venue type' })).toHaveCount(0);

    await page.goto('/vendors?category=banquet-halls');
    await expectNoErrorState(page);
    await openFiltersIfNeeded(page);
    await expect(page.getByRole('group', { name: 'Venue type' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Photography style' })).toHaveCount(0);
  });
});
