/**
 * Step 2 of the venue import pipeline: websites → `.cache/venues/<slug>.json`.
 *
 * For each venue that has a usable website this fetches the home page, follows
 * the handful of internal links that plausibly describe the venue (weddings,
 * banquets, gallery, packages, contact), and records every fact it can read:
 * headings, paragraphs, photographs, phones, emails and rupee prices.
 *
 * Nothing here writes to the database or to `public/`. The output is a cache, so
 * a bad fetch can be inspected and re-run without touching the catalogue:
 *
 *   pnpm tsx scripts/venues/scrape.mts --limit 20
 *   pnpm tsx scripts/venues/scrape.mts --only della-resorts,marigold-banquets-n-conventions
 *   pnpm tsx scripts/venues/scrape.mts --force --concurrency 4
 *
 * The cache lives under `.cache/` (gitignored) because it is third-party content
 * captured at a point in time, not source.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeBrowser, fetchPage, mapWithConcurrency } from './lib/fetch';
import {
  extractEmails,
  extractHeadings,
  extractImages,
  extractJsonLd,
  extractLinks,
  extractMeta,
  extractParagraphs,
  extractPhones,
  extractPrices,
  looksLikeShell,
  rankImageCandidates,
  type PriceMention,
} from './lib/extract';
import { stripHtml } from './lib/text';
import type { SourceVenue } from './lib/source';
import type { ScrapedPage, ScrapeResult } from './lib/scrape';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = join(root, 'data/venues/source-venues.json');
const cacheDirectory = join(root, '.cache/venues');

/** Link text/URL fragments that mark a page worth reading. */
const RELEVANT_PAGE =
  /wedding|banquet|event|venue|gallery|photo|package|price|tariff|contact|about|hall|lawn|corporate|meeting|conference|celebration|facilit|amenit|dining|room|suite|offer/i;

const MAX_SUBPAGES = 4;

function parseArgs(argv: readonly string[]): {
  only: Set<string> | null;
  limit: number | null;
  force: boolean;
  concurrency: number;
  city: string | null;
} {
  const only = argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length);
  const limit = argv.find((argument) => argument.startsWith('--limit='))?.slice('--limit='.length);
  const concurrency = argv
    .find((argument) => argument.startsWith('--concurrency='))
    ?.slice('--concurrency='.length);
  const city = argv.find((argument) => argument.startsWith('--city='))?.slice('--city='.length);

  return {
    only: only ? new Set(only.split(',').map((slug) => slug.trim())) : null,
    limit: limit ? Number(limit) : null,
    force: argv.includes('--force'),
    concurrency: concurrency ? Number(concurrency) : 3,
    city: city ?? null,
  };
}

function sameSite(candidate: string, base: string): boolean {
  try {
    const a = new URL(candidate);
    const b = new URL(base);
    const strip = (host: string): string => host.replace(/^www\./, '');
    return strip(a.hostname) === strip(b.hostname);
  } catch {
    return false;
  }
}

/** Picks the internal pages most likely to hold venue facts, best-first. */
function chooseSubpages(html: string, baseUrl: string): string[] {
  const scored = new Map<string, number>();

  for (const link of extractLinks(html, baseUrl)) {
    if (!sameSite(link.href, baseUrl)) continue;
    const url = new URL(link.href);
    url.hash = '';
    const key = url.toString().replace(/\/$/, '');
    if (key === baseUrl.replace(/\/$/, '')) continue;

    const haystack = `${url.pathname} ${link.text}`;
    if (!RELEVANT_PAGE.test(haystack)) continue;

    // A dedicated page beats a nav item that happens to match one word.
    let score = 0;
    if (/wedding/i.test(haystack)) score += 5;
    if (/banquet|hall|lawn|venue/i.test(haystack)) score += 4;
    if (/package|price|tariff/i.test(haystack)) score += 4;
    if (/gallery|photo/i.test(haystack)) score += 3;
    if (/contact/i.test(haystack)) score += 2;
    if (/about/i.test(haystack)) score += 1;
    if (url.pathname.split('/').filter(Boolean).length > 3) score -= 2;

    scored.set(key, Math.max(scored.get(key) ?? 0, score));
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SUBPAGES)
    .map(([url]) => url);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function readPage(url: string, html: string, via: 'http' | 'browser'): ScrapedPage {
  const meta = extractMeta(html, url);
  const text = stripHtml(html);
  const jsonLd = extractJsonLd(html).filter((record) => {
    const type = record['@type'];
    return typeof type === 'string' || Array.isArray(type);
  });

  return {
    url,
    via,
    title: meta.ogTitle ?? meta.title,
    description: meta.ogDescription ?? meta.description,
    headings: extractHeadings(html),
    paragraphs: extractParagraphs(html),
    images: extractImages(html, url),
    phones: extractPhones(text),
    emails: extractEmails(text),
    prices: extractPrices(text),
    jsonLd,
  };
}

async function scrapeVenue(venue: SourceVenue): Promise<ScrapeResult> {
  const base: ScrapeResult = {
    slug: venue.slug,
    name: venue.name,
    requestedUrl: venue.websiteUrl ?? '',
    finalUrl: null,
    status: venue.websiteUrl ? 'error' : 'no-website',
    via: null,
    pages: [],
    images: [],
    phones: [],
    emails: [],
    prices: [],
    scrapedAt: new Date().toISOString(),
  };

  if (!venue.websiteUrl) return base;

  const home = await fetchPage(venue.websiteUrl);
  if (!home) return { ...base, status: 'error' };

  const blocked = home.status === 403 || home.status === 429 || home.status === 503;
  if (blocked && looksLikeShell(home.html)) {
    return { ...base, finalUrl: home.url, status: 'blocked', via: home.via };
  }

  const pages: ScrapedPage[] = [readPage(home.url, home.html, home.via)];

  for (const subpage of chooseSubpages(home.html, home.url)) {
    const result = await fetchPage(subpage, { allowBrowser: false });
    if (!result || result.status >= 400) continue;
    pages.push(readPage(result.url, result.html, result.via));
  }

  const images = rankImageCandidates(
    pages.flatMap((page) => page.images.map((url) => ({ url, pageUrl: page.url }))),
  );
  const phones = unique(pages.flatMap((page) => page.phones));
  const emails = unique(pages.flatMap((page) => page.emails));

  // Keep the cheapest mention of each amount; the same ₹1,200 appears in a
  // dozen nav-adjacent contexts and the first context is the most specific.
  const pricesByAmount = new Map<number, PriceMention>();
  for (const price of pages.flatMap((page) => page.prices)) {
    if (!pricesByAmount.has(price.amount)) pricesByAmount.set(price.amount, price);
  }

  return {
    ...base,
    finalUrl: home.url,
    status: 'ok',
    via: home.via,
    pages,
    images,
    phones,
    emails,
    prices: [...pricesByAmount.values()].sort((a, b) => a.amount - b.amount),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const venues: SourceVenue[] = JSON.parse(await readFile(sourcePath, 'utf8'));

  let selected = venues.filter((venue) => venue.websiteUrl);
  if (args.only) selected = selected.filter((venue) => args.only?.has(venue.slug));
  if (args.city) selected = selected.filter((venue) => venue.city === args.city);
  if (args.limit) selected = selected.slice(0, args.limit);

  await mkdir(cacheDirectory, { recursive: true });

  let done = 0;
  const results = await mapWithConcurrency(selected, args.concurrency, async (venue) => {
    const target = join(cacheDirectory, `${venue.slug}.json`);

    if (!args.force) {
      try {
        const cached: ScrapeResult = JSON.parse(await readFile(target, 'utf8'));
        if (cached.status === 'ok') {
          done += 1;
          return cached;
        }
      } catch {
        // No usable cache entry; scrape it.
      }
    }

    const result = await scrapeVenue(venue);
    await writeFile(target, `${JSON.stringify(result, null, 1)}\n`, 'utf8');
    done += 1;
    const images = result.images.length;
    const prices = result.prices.length;
    console.log(
      `[${done}/${selected.length}] ${result.status.padEnd(9)} ${venue.slug} ` +
        `(${result.pages.length}p, ${images}img, ${prices}price)`,
    );
    return result;
  });

  await closeBrowser();

  const summary = new Map<string, number>();
  for (const result of results) summary.set(result.status, (summary.get(result.status) ?? 0) + 1);
  const withImages = results.filter((result) => result.images.length >= 3).length;
  const withPrices = results.filter((result) => result.prices.length > 0).length;

  console.log(
    `\nScraped ${results.length} venues: ` +
      [...summary].map(([status, count]) => `${status}=${count}`).join(', '),
  );
  console.log(`  ≥3 photographs: ${withImages}`);
  console.log(`  with a price mention: ${withPrices}`);
  console.log(`  cache: .cache/venues/`);
}

await main();
