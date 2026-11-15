/**
 * HTTP access for the venue scraper: static fetch first, headless Chrome when
 * the page needs JavaScript.
 *
 * Most venue sites in the workbooks are WordPress or a page-builder export and
 * serve complete HTML. A minority are single-page apps or sit behind a bot check
 * that returns 403 to a plain `fetch`. The fallback renders those in the Chrome
 * that is already installed on the machine (`channel: 'chrome'`) rather than
 * downloading a second browser.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface FetchResult {
  url: string;
  status: number;
  html: string;
  /** How the HTML was obtained — recorded so a bad scrape can be explained. */
  via: 'http' | 'browser';
}

export interface FetchOptions {
  timeoutMs?: number;
  /** Set false to skip the headless-browser fallback (useful for bulk runs). */
  allowBrowser?: boolean;
}

async function staticFetch(url: string, timeoutMs: number): Promise<FetchResult | null> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-IN,en;q=0.9',
      },
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;
    return {
      url: response.url || url,
      status: response.status,
      html: await response.text(),
      via: 'http',
    };
  } catch {
    return null;
  }
}

type Browser = import('@playwright/test').Browser;

let browserPromise: Promise<Browser | null> | null = null;

async function getBrowser(): Promise<Browser | null> {
  if (!browserPromise) {
    browserPromise = (async () => {
      try {
        const { chromium } = await import('@playwright/test');
        return await chromium.launch({ channel: 'chrome', headless: true });
      } catch {
        return null;
      }
    })();
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser?.close().catch(() => undefined);
}

async function browserFetch(url: string, timeoutMs: number): Promise<FetchResult | null> {
  const browser = await getBrowser();
  if (!browser) return null;

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: 'en-IN',
  });

  // Photographs are what we are after, but downloading them here would double
  // the work: the URLs are in the DOM whether or not the bytes are fetched.
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') return route.abort();
    return route.continue();
  });

  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);
    // Trigger lazy-loaded sections so their markup exists in the snapshot.
    await page
      .evaluate(async () => {
        const step = window.innerHeight;
        for (let offset = 0; offset < document.body.scrollHeight; offset += step) {
          window.scrollTo(0, offset);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        window.scrollTo(0, 0);
      })
      .catch(() => undefined);
    await page.waitForTimeout(600);

    return {
      url: page.url(),
      status: response?.status() ?? 0,
      html: await page.content(),
      via: 'browser',
    };
  } catch {
    return null;
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function fetchPage(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult | null> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const allowBrowser = options.allowBrowser ?? true;

  const first = await staticFetch(url, timeoutMs);
  if (first && first.status >= 200 && first.status < 300 && first.html.length > 1500) {
    return first;
  }

  if (!allowBrowser) return first;

  const rendered = await browserFetch(url, Math.max(timeoutMs, 30_000));
  if (rendered) return rendered;
  return first;
}

/** Runs `worker` over `items` with a fixed number of in-flight tasks. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}
