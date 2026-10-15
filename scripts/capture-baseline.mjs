import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3400';
const PAGES = [
  ['home', '/'],
  ['browse', '/vendors'],
  ['category', '/categories/venues'],
  ['profile', '/vendors/the-sandalwood-grand'],
  ['enquire', '/enquire'],
  ['signin', '/sign-in'],
  ['filtered', '/vendors?category=venues&location=mumbai'],
];
const VIEWPORTS = [
  [1440, 900, '1440'],
  [768, 1024, '768'],
  [390, 844, '390'],
];

const browser = await chromium.launch();
let n = 0;

for (const theme of ['light', 'dark']) {
  for (const [width, height, tag] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    const page = await context.newPage();
    for (const [name, path] of PAGES) {
      try {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(700);
        await page.screenshot({
          path: `docs/research/shots/head-${name}-${tag}-${theme}.png`,
        });
        n += 1;
      } catch (error) {
        console.log(`FAILED ${name} ${tag} ${theme}: ${String(error).slice(0, 120)}`);
      }
    }
    await context.close();
  }
}

await browser.close();
console.log(`CAPTURED ${n}`);
