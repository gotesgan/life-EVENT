import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * Capture the product's major sections for external design review.
 *
 * Produces numbered, self-describing images in `docs/ui-review/` so a UI expert
 * can assess each section without navigating the app. Viewport shots at 1440x900
 * (what a person actually sees), not full-page dumps, because the review is about
 * composition and hierarchy within a screen.
 *
 * Honest about the current state: the listing covers are still generated SVG
 * placeholders, so several images show that. That is the single most useful thing
 * for an expert to see.
 */

const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:3800';
const OUT = 'docs/ui-review';
const VIEWPORT = { width: 1440, height: 900 };

const ADMIN = { email: 'admin@liveenvt.test', password: 'AdminPass123!' };
const CUSTOMER = { email: 'priya@example.test', password: 'CustomerPass123!' };

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' });
const page = await context.newPage();

const captured: string[] = [];
const failed: string[] = [];

async function shot(name: string, options: { scrollTo?: string; full?: boolean } = {}) {
  try {
    if (options.scrollTo) {
      const target = page.locator(options.scrollTo).first();
      await target.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: options.full ?? false });
    captured.push(name);
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed.push(`${name}: ${String(error).slice(0, 90)}`);
    console.log(`  FAIL ${name}`);
  }
}

async function go(path: string) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);
}

async function signIn(creds: { email: string; password: string }, next?: string) {
  await page.goto(`${BASE}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2200);
}

// ── Public discovery ────────────────────────────────────────────────────────
await go('/');
await shot('01-home-hero');
await shot('02-home-categories', { scrollTo: 'text=Browse by category' });
await shot('03-home-featured-listings', { scrollTo: 'article' });

await go('/vendors');
await shot('04-browse-grid');
await shot('05-browse-filter-rail', { scrollTo: 'text=Event type' });
await shot('06-listing-card-closeup', { scrollTo: 'article' });

await go('/vendors?category=venues&location=mumbai');
await shot('07-browse-filters-applied');

await go('/categories/venues');
await shot('08-category-landing');

await go('/vendors/the-sandalwood-grand');
await shot('09-profile-hero');
await shot('10-profile-gallery', { scrollTo: 'text=Gallery' });
await shot('11-profile-contact-and-enquiry', { scrollTo: 'text=Send an enquiry' });

await go('/enquire?enquire=the-sandalwood-grand');
await shot('12-enquiry-form');

await go('/sign-in');
await shot('13-sign-in');

await go('/track');
await shot('14-track-enquiry');

// ── Customer account ────────────────────────────────────────────────────────
await signIn(CUSTOMER, '/account');
await go('/account');
await shot('15-account-overview');

await go('/account/enquiries');
await shot('16-account-enquiry-list');

await go('/account/enquiries/LE-ZM4H6CYV');
await shot('17-account-enquiry-detail-timeline');

// ── Admin ───────────────────────────────────────────────────────────────────
await context.clearCookies();
await signIn(ADMIN, '/admin');
await go('/admin');
await shot('18-admin-dashboard');

await go('/admin/listings');
await shot('19-admin-listings-table');

await go('/admin/enquiries');
await shot('20-admin-enquiry-inbox');

await browser.close();

console.log(`\ncaptured ${captured.length}, failed ${failed.length}`);
if (failed.length > 0) console.log('failures:\n  ' + failed.join('\n  '));
