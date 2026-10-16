import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3800';
const OUT = 'docs/ui-review';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
});
const page = await context.newPage();
const failed: string[] = [];

async function shot(name: string) {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('  ok   ' + name);
  } catch {
    failed.push(name);
    console.log('  FAIL ' + name);
  }
}
async function go(p: string) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
}
async function signIn(email: string, password: string, next: string) {
  await page.goto(`${BASE}/sign-in?next=${encodeURIComponent(next)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByLabel(/email/i).fill(email);
  // The visibility toggle shares the "password" label, so target the input by type.
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2600);
  console.log('  signed in -> ' + new URL(page.url()).pathname);
}

await signIn('priya@example.test', 'CustomerPass123!', '/account');
await go('/account');
await shot('15-account-overview');
await go('/account/enquiries');
await shot('16-account-enquiry-list');
await go('/account/enquiries/LE-ZM4H6CYV');
await shot('17-account-enquiry-detail-timeline');

await context.clearCookies();
await signIn('admin@liveenvt.test', 'AdminPass123!', '/admin');
await go('/admin');
await shot('18-admin-dashboard');
await go('/admin/listings');
await shot('19-admin-listings-table');
await go('/admin/enquiries');
await shot('20-admin-enquiry-inbox');

await browser.close();
console.log(failed.length ? 'failed: ' + failed.join(',') : 'all captured');
