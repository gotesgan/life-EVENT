import { expect, test } from '@playwright/test';

/**
 * SEO and metadata surfaces.
 *
 * The strategy these assert is deliberate: clean category and city pages are
 * indexable, while endlessly generated filter combinations are not, so the
 * crawler is not invited into low-value URLs.
 */

test.describe('crawler surfaces', () => {
  test('robots.txt is served and disallows filtered query combinations', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toMatch(/user-agent/i);
    expect(body).toMatch(/sitemap/i);
    // Filtered search URLs must not be crawled.
    expect(body).toMatch(/disallow/i);
    expect(body).toMatch(/\?/);
  });

  test('sitemap.xml is well-formed and includes category and city URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);

    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('/categories');
    // A location landing page, whatever the chosen slug.
    expect(/\/cities\//.test(body)).toBe(true);
  });

  test('a category page has a title, description and canonical URL', async ({ page }) => {
    await page.goto('/categories/venues');

    await expect(page).toHaveTitle(/venue/i);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(20);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain('/categories/venues');
  });

  test('a listing page declares an opaque canonical URL', async ({ page }) => {
    await page.goto('/vendors/gulmohar-banjara-banquets');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    // Canonicals must not spell the withheld trading name out; they carry the
    // listing's opaque public reference instead.
    expect(canonical).toMatch(/\/vendors\/ul_[a-z0-9]+$/);
    expect(canonical).not.toContain('gulmohar');
  });

  test('private surfaces are not indexed', async ({ page }) => {
    for (const path of ['/sign-in', '/account', '/admin']) {
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      // Either an explicit noindex, or a redirect away from the page.
      const redirected = !page.url().includes(path);
      expect(redirected || /noindex/i.test(robots ?? '')).toBe(true);
    }
  });
});

test.describe('not-found and error surfaces', () => {
  test('an unknown route renders a designed 404 with a way home', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-real-page');
    expect(response?.status()).toBe(404);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /home|browse/i }).first()).toBeVisible();
  });

  test('the 404 page does not leak a stack trace', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/at\s+\w+\s+\(/);
    expect(body).not.toMatch(/PrismaClient|stack trace/i);
  });
});
