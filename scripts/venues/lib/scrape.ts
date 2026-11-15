/**
 * The shape of one venue's scrape, cached under `.cache/venues/<slug>.json`.
 *
 * Kept out of `scrape.mts` so `images.mts` can import the type without running
 * the scraper.
 */

import type { PriceMention } from './extract';

export interface ScrapedPage {
  url: string;
  via: 'http' | 'browser';
  title: string | null;
  description: string | null;
  headings: string[];
  paragraphs: string[];
  images: string[];
  phones: string[];
  emails: string[];
  prices: PriceMention[];
  jsonLd: Record<string, unknown>[];
}

export interface ScrapeResult {
  slug: string;
  name: string;
  requestedUrl: string;
  finalUrl: string | null;
  status: 'ok' | 'blocked' | 'error' | 'no-website';
  via: 'http' | 'browser' | null;
  pages: ScrapedPage[];
  images: string[];
  phones: string[];
  emails: string[];
  prices: PriceMention[];
  scrapedAt: string;
}
