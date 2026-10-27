import { expect, test } from '@playwright/test';
import { SEEDED_CUSTOMER, expectNoErrorBoundary, expectNoHorizontalOverflow } from './helpers';

/**
 * Responsive, theme and accessibility checks.
 *
 * These run across the three configured projects (`desktop-light`,
 * `desktop-dark`, `mobile`), so a regression in one viewport or scheme fails a
 * named project rather than hiding inside a general run.
 */

const PUBLIC_PAGES = [
  '/',
  '/categories',
  '/vendors',
  '/vendors?category=venues&location=mumbai&verified=true',
  '/vendors/gulmohar-banjara-banquets',
  '/partner-with-us',
  '/corporate-events',
  '/track',
  '/sign-in',
  '/about',
];

test.describe('layout integrity', () => {
  for (const path of PUBLIC_PAGES) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should render`).toBeLessThan(400);
      await expectNoHorizontalOverflow(page);
      await expectNoErrorBoundary(page);
    });
  }

  test('no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/vendors?category=venues');
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('theme', () => {
  test('the resolved colour scheme is applied to the document element', async ({ page }) => {
    await page.goto('/');
    const scheme = await page.locator('html').getAttribute('data-mantine-color-scheme');
    expect(['light', 'dark']).toContain(scheme);
  });

  test('the page background follows the active scheme', async ({ page }) => {
    await page.goto('/');
    const scheme = await page.locator('html').getAttribute('data-mantine-color-scheme');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const rgb = background.match(/\d+/g)?.map(Number) ?? [];
    const luminance = rgb.length >= 3 ? (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 : 128;

    if (scheme === 'dark') {
      // A designed dark theme is genuinely dark, not merely dimmed.
      expect(luminance).toBeLessThan(90);
    } else {
      expect(luminance).toBeGreaterThan(180);
    }
  });

  test('the scheme can be switched and persists across a navigation', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /theme|colour scheme|color scheme/i }).first();
    await expect(toggle).toBeVisible();

    const before = await page.locator('html').getAttribute('data-mantine-color-scheme');
    await toggle.click();
    await expect
      .poll(async () => page.locator('html').getAttribute('data-mantine-color-scheme'))
      .not.toBe(before);

    const after = await page.locator('html').getAttribute('data-mantine-color-scheme');
    await page.goto('/categories');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', after!);
  });
});

test.describe('accessibility basics', () => {
  test('keyboard focus produces a visible indicator on a filter control', async ({ page }) => {
    await page.goto('/vendors?category=venues');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30_000 });

    // Reach the filter rail by keyboard. Tabbing (rather than calling
    // `.focus()`) is what makes `:focus-visible` match, which is how this design
    // system renders its ring — a programmatic focus intentionally shows none.
    let reached = false;
    // Generous because every header dropdown materialises its own links into the
    // tab order while its trigger is focused.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return false;
        return Boolean(active.closest('[aria-label^="Filters"]'));
      });
      if (reached) break;
    }
    expect(reached, 'a filter control should be reachable by keyboard').toBe(true);

    const ring = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return { self: '', wrapper: '' };
      const self = getComputedStyle(active);
      const wrapperStyle = active.parentElement ? getComputedStyle(active.parentElement) : null;
      return {
        self: `${self.outlineWidth}|${self.outlineStyle}|${self.boxShadow}|${self.borderColor}`,
        wrapper: wrapperStyle
          ? `${wrapperStyle.outlineWidth}|${wrapperStyle.outlineStyle}|${wrapperStyle.boxShadow}`
          : '',
      };
    });

    const hasRing = (value: string) =>
      /[1-9]\d*px/.test(value.split('|')[0]) ||
      (!value.includes('none') && value.split('|')[2] !== 'none') ||
      value.split('|')[1] === 'solid';

    expect(
      hasRing(ring.self) || hasRing(ring.wrapper),
      `focused filter control should show a visible focus indicator, got ${JSON.stringify(ring)}`,
    ).toBe(true);
  });

  test('every page has exactly one level-one heading', async ({ page }) => {
    for (const path of ['/', '/vendors?category=venues', '/categories', '/about']) {
      await page.goto(path);
      // Auto-retrying: the streamed content decides the final heading count.
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${path} should have exactly one h1`,
      ).toHaveCount(1, { timeout: 30_000 });
    }
  });

  test('form inputs have accessible labels', async ({ page }) => {
    await page.goto('/vendors/gulmohar-banjara-banquets');
    await page
      .getByRole('button', { name: /^send an enquiry$/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByLabel('Full name')).toBeVisible();
    await expect(dialog.getByLabel('Email address')).toBeVisible();
    await expect(dialog.getByLabel('Contact number')).toBeVisible();
  });

  test('reduced motion removes long transitions', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');

    const longest = await page.evaluate(() => {
      let max = 0;
      for (const element of Array.from(document.querySelectorAll('*'))) {
        const duration = getComputedStyle(element).transitionDuration;
        for (const part of duration.split(',')) {
          const value = parseFloat(part);
          if (!Number.isNaN(value)) max = Math.max(max, part.includes('ms') ? value : value * 1000);
        }
      }
      return max;
    });

    expect(longest).toBeLessThanOrEqual(50);
    await context.close();
  });
});

test.describe('mobile filter experience', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the mobile filter control opens a drawer that Escape closes', async ({ page }) => {
    await page.goto('/vendors?category=venues');

    const openButton = page.getByRole('button', { name: /filter/i }).first();
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/filters/i).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('applying a filter from the drawer updates the URL', async ({ page }) => {
    await page.goto('/vendors?category=venues');

    const openButton = page.getByRole('button', { name: /filter/i }).first();
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Change a real control. The drawer writes each edit to the URL immediately,
    // so this must appear in the query string while the sheet is still open —
    // a drawer that silently discards edits now fails here instead of passing
    // because the apply button happened to exist.
    await dialog.getByLabel('Top picks only').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('verified')).toBe('true');

    const applyButton = dialog.getByRole('button', { name: /show \d+ result|apply/i }).first();
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/category=venues/);
    await expect(page).toHaveURL(/verified=true/);
  });

  test('the mobile navigation is reachable', async ({ page }) => {
    await page.goto('/');
    const burger = page.getByRole('button', { name: /menu|navigation/i }).first();
    await expect(burger).toBeVisible();
    await burger.click();
    await expect(page.getByRole('link', { name: /categories|vendors/i }).first()).toBeVisible();
  });
});

test.describe('signed-in surfaces', () => {
  test('the account area renders on a phone without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/sign-in');
    await expectNoHorizontalOverflow(page);
    void SEEDED_CUSTOMER;
  });
});
