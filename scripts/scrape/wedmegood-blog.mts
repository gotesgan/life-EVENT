/**
 * Scrapes the WedMeGood blog index into one viewable document.
 *
 * The blog is a server-rendered listing: each page carries two featured blocks,
 * nine article cards and four guide tiles. This script fetches those pages,
 * extracts the blocks, and writes a single self-contained HTML file plus the raw
 * JSON, so the result can be opened in a browser without a server.
 *
 * Politeness, because this is someone else's site:
 *  - one request at a time by default, with a delay between pages;
 *  - raw HTML cached under `data/wedmegood-blog/cache/`, so a re-run does not
 *    re-fetch what it already has (`--refresh` overrides);
 *  - 429/5xx retried with exponential backoff and `Retry-After` honoured;
 *  - a browser-like User-Agent, because the site serves a challenge to unknown
 *    clients.
 *
 * The site's robots.txt allows `User-agent: *` with `use=reference` and
 * `ai-train=no`. This is a reference extraction of public listing metadata
 * (title, link, image, author, date, excerpt) — it does not copy article bodies.
 *
 * Run:
 *   pnpm scrape:blog                 # first 3 pages, ~27 posts
 *   pnpm scrape:blog --pages=10      # first 10 pages
 *   pnpm scrape:blog --all           # every page (896 at the time of writing)
 *   pnpm scrape:blog --start=50 --pages=5
 *   pnpm scrape:blog --refresh       # ignore the HTML cache
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const BASE = 'https://www.wedmegood.com';
const OUT_DIR = resolve(process.cwd(), 'data/wedmegood-blog');
const CACHE_DIR = join(OUT_DIR, 'cache');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface CliOptions {
  start: number;
  pages: number | 'all';
  delayMs: number;
  refresh: boolean;
  limit: number | null;
}

interface FeaturedBlock {
  title: string;
  url: string;
  image: string | null;
}

interface PostBlock {
  title: string;
  url: string;
  image: string | null;
  imageAlt: string | null;
  author: string | null;
  date: string | null;
  readTime: string | null;
  excerpt: string | null;
  page: number;
}

interface GuideBlock {
  title: string;
  kicker: string | null;
  url: string;
  image: string | null;
}

interface PageBlocks {
  page: number;
  featured: FeaturedBlock[];
  posts: PostBlock[];
  guides: GuideBlock[];
  lastPage: number | null;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const value = (name: string): string | undefined =>
    argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);

  const pages = value('pages');
  const delay = value('delay');
  const start = value('start');
  const limit = value('limit');

  return {
    start: start ? Math.max(1, Number.parseInt(start, 10)) : 1,
    pages: argv.includes('--all') ? 'all' : pages ? Math.max(1, Number.parseInt(pages, 10)) : 3,
    delayMs: delay ? Math.max(0, Number.parseInt(delay, 10)) : 800,
    refresh: argv.includes('--refresh'),
    limit: limit ? Math.max(1, Number.parseInt(limit, 10)) : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function absolute(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function textOf(element: Element | null | undefined): string | null {
  const text = element?.textContent?.replace(/\s+/g, ' ').trim();
  return text && text.length > 0 ? text : null;
}

/** Pulls the URL out of `background-image:url('…')`. */
function backgroundImage(style: string | null): string | null {
  if (!style) return null;
  const match = style.match(/url\((['"]?)(.*?)\1\)/);
  return match?.[2] ? absolute(match[2]) : null;
}

function parsePage(html: string, page: number): PageBlocks {
  const { document } = new JSDOM(html).window;

  const featured: FeaturedBlock[] = [];
  for (const block of document.querySelectorAll('.section-featured-article')) {
    const anchor = block.closest('a');
    const title = textOf(block.querySelector('h2'));
    if (!anchor || !title) continue;
    featured.push({
      title,
      url: absolute(anchor.getAttribute('href')) ?? '',
      image: backgroundImage(block.getAttribute('style')),
    });
  }

  const posts: PostBlock[] = [];
  for (const card of document.querySelectorAll('.article')) {
    const anchor = card.closest('a');
    const title = textOf(card.querySelector('h2'));
    if (!anchor || !title) continue;

    const meta = textOf(card.querySelector('p.text-center'));
    // The meta line is "BY Author | 13 Nov, 2026 | 5 min read". Split on the
    // pipe rather than on the spans, because the spans are layout, not meaning.
    const parts = meta ? meta.split('|').map((part) => part.trim()) : [];
    const author = parts[0]?.replace(/^BY\s+/i, '') ?? null;
    const date = parts[1] ?? null;
    const readTime = parts[2] ?? null;

    const excerptElement = [...card.querySelectorAll('p')].find(
      (paragraph) => paragraph !== card.querySelector('p.text-center'),
    );

    const image = card.querySelector('img.cover');

    posts.push({
      title,
      url: absolute(anchor.getAttribute('href')) ?? '',
      image: absolute(image?.getAttribute('src')),
      imageAlt: image?.getAttribute('alt') ?? null,
      author,
      date,
      readTime,
      excerpt: textOf(excerptElement),
      page,
    });
  }

  const guides: GuideBlock[] = [];
  for (const guide of document.querySelectorAll('a.guide')) {
    const title = textOf(guide.querySelector('h3'));
    if (!title) continue;
    guides.push({
      title,
      kicker: textOf(guide.querySelector('h4')),
      url: absolute(guide.getAttribute('href')) ?? '',
      image: absolute(guide.querySelector('img')?.getAttribute('src')),
    });
  }

  // The pagination lists the last page number; read it once so `--all` knows
  // when to stop without guessing.
  let lastPage: number | null = null;
  for (const link of document.querySelectorAll('.blog-pagination a')) {
    const match = (link.getAttribute('href') ?? '').match(/[?&]page=(\d+)/);
    if (match) lastPage = Math.max(lastPage ?? 0, Number.parseInt(match[1] as string, 10));
  }

  return { page, featured, posts, guides, lastPage };
}

async function fetchPage(page: number, options: CliOptions): Promise<string> {
  const cachePath = join(CACHE_DIR, `page-${page}.html`);

  if (!options.refresh) {
    try {
      return await readFile(cachePath, 'utf8');
    } catch {
      // Not cached yet.
    }
  }

  const url = `${BASE}/blog?page=${page}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
        redirect: 'follow',
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 2000;
        console.warn(`  ! page ${page}: HTTP ${response.status}, retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const html = await response.text();
      await writeFile(cachePath, html, 'utf8');
      return html;
    } catch (error) {
      lastError = error;
      console.warn(`  ! page ${page}: attempt ${attempt} failed — ${String(error)}`);
      await sleep(attempt * 1500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not fetch page ${page}`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDocument(input: {
  posts: readonly PostBlock[];
  featured: readonly FeaturedBlock[];
  guides: readonly GuideBlock[];
  pagesFetched: number;
  scrapedAt: string;
}): string {
  const { posts, featured, guides, pagesFetched, scrapedAt } = input;

  const featuredHtml = featured
    .map(
      (block) => `
        <a class="featured" href="${escapeHtml(block.url)}" target="_blank" rel="noreferrer">
          ${block.image ? `<img src="${escapeHtml(block.image)}" alt="" loading="lazy" />` : ''}
          <span class="featured-title">${escapeHtml(block.title)}</span>
        </a>`,
    )
    .join('');

  const guidesHtml = guides
    .map(
      (guide) => `
        <a class="guide" href="${escapeHtml(guide.url)}" target="_blank" rel="noreferrer">
          ${guide.image ? `<img src="${escapeHtml(guide.image)}" alt="" loading="lazy" />` : ''}
          <span class="guide-title">${escapeHtml(guide.title)}</span>
          ${guide.kicker ? `<span class="guide-kicker">${escapeHtml(guide.kicker)}</span>` : ''}
        </a>`,
    )
    .join('');

  const cardsHtml = posts
    .map(
      (post, index) => `
        <article class="card" data-title="${escapeHtml(post.title.toLowerCase())}" data-index="${index}">
          <a class="card-link" href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">
            <div class="card-media">
              ${post.image ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt ?? '')}" loading="lazy" />` : '<div class="card-media-empty">No image</div>'}
            </div>
            <div class="card-body">
              <h2 class="card-title">${escapeHtml(post.title)}</h2>
              <p class="card-meta">
                ${post.author ? `<span>${escapeHtml(post.author)}</span>` : ''}
                ${post.date ? `<span>${escapeHtml(post.date)}</span>` : ''}
                ${post.readTime ? `<span>${escapeHtml(post.readTime)}</span>` : ''}
              </p>
              ${post.excerpt ? `<p class="card-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
            </div>
          </a>
        </article>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>WedMeGood blog — ${posts.length} blocks</title>
<style>
  :root {
    --bg: #faf7f2;
    --surface: #ffffff;
    --ink: #1d1a16;
    --muted: #6f665a;
    --line: #e6ded2;
    --accent: #9b1c31;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
  }
  header {
    max-width: 1200px;
    margin: 0 auto;
    padding: 48px 24px 24px;
  }
  .eyebrow {
    margin: 0 0 8px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 0 8px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 400;
    letter-spacing: -0.02em;
  }
  .lede { margin: 0; color: var(--muted); max-width: 60ch; }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 24px;
  }
  .controls input {
    flex: 1 1 260px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
  }
  .controls input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .count { color: var(--muted); font-size: 14px; }
  .featured-row, .guide-row, .grid {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .featured-row, .guide-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .featured {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 220px;
    padding: 20px;
    border-radius: 14px;
    overflow: hidden;
    background: #2a241d;
    color: #fff;
    text-decoration: none;
  }
  .featured img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.75;
  }
  .featured-title {
    position: relative;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    line-height: 1.25;
  }
  .guide-row { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .guide {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 140px;
    padding: 16px;
    border-radius: 12px;
    overflow: hidden;
    background: #2a241d;
    color: #fff;
    text-decoration: none;
  }
  .guide img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.6;
  }
  .guide-title { position: relative; font-family: Georgia, serif; font-size: 20px; }
  .guide-kicker { position: relative; font-size: 11px; letter-spacing: 0.1em; opacity: 0.8; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
    padding-bottom: 64px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    overflow: hidden;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(29, 26, 22, 0.08); }
  .card-link { display: block; color: inherit; text-decoration: none; height: 100%; }
  .card-media { aspect-ratio: 16 / 10; background: #efe8dd; }
  .card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .card-media-empty {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--muted);
    font-size: 13px;
  }
  .card-body { padding: 16px 18px 20px; }
  .card-title {
    margin: 0 0 8px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 19px;
    font-weight: 400;
    line-height: 1.3;
  }
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 12px;
  }
  .card-meta span + span::before { content: "·"; margin-right: 6px; }
  .card-excerpt {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .empty { padding: 48px 24px; color: var(--muted); text-align: center; }
  footer {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }
</style>
</head>
<body>
<header>
  <p class="eyebrow">Reference extraction · ${pagesFetched} page${pagesFetched === 1 ? '' : 's'}</p>
  <h1>WedMeGood blog blocks</h1>
  <p class="lede">${posts.length} article cards, ${featured.length} featured blocks and ${guides.length} guide tiles, scraped ${escapeHtml(scrapedAt)}. Titles, links, images and listing metadata only — no article bodies.</p>
</header>
<div class="controls">
  <input id="search" type="search" placeholder="Filter by title…" aria-label="Filter by title" />
  <span class="count" id="count">${posts.length} shown</span>
</div>
${featuredHtml ? `<div class="featured-row">${featuredHtml}</div>` : ''}
${guidesHtml ? `<div class="guide-row">${guidesHtml}</div>` : ''}
<main class="grid" id="grid">${cardsHtml}</main>
<p class="empty" id="empty" hidden>No blocks match that filter.</p>
<footer>Source: wedmegood.com/blog. Scraped for reference; images remain the property of their owners.</footer>
<script>
  const search = document.getElementById('search');
  const cards = [...document.querySelectorAll('.card')];
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const match = !query || card.dataset.title.includes(query);
      card.hidden = !match;
      if (match) shown += 1;
    }
    count.textContent = shown + ' shown';
    empty.hidden = shown !== 0;
  });
</script>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(CACHE_DIR, { recursive: true });

  const posts: PostBlock[] = [];
  const featured: FeaturedBlock[] = [];
  const guides: GuideBlock[] = [];
  const seenPosts = new Set<string>();
  const seenFeatured = new Set<string>();
  const seenGuides = new Set<string>();

  let page = options.start;
  let lastPage: number | null = null;
  let pagesFetched = 0;

  const stopAt =
    options.pages === 'all' ? Number.POSITIVE_INFINITY : options.start + options.pages - 1;

  while (page <= stopAt) {
    if (lastPage !== null && page > lastPage) break;

    console.log(`Fetching page ${page}${lastPage ? ` of ${lastPage}` : ''}…`);
    const html = await fetchPage(page, options);
    const blocks = parsePage(html, page);
    pagesFetched += 1;
    lastPage = blocks.lastPage ?? lastPage;

    for (const block of blocks.featured) {
      if (seenFeatured.has(block.url)) continue;
      seenFeatured.add(block.url);
      featured.push(block);
    }

    for (const post of blocks.posts) {
      if (seenPosts.has(post.url)) continue;
      seenPosts.add(post.url);
      posts.push(post);
    }

    for (const guide of blocks.guides) {
      if (seenGuides.has(guide.url)) continue;
      seenGuides.add(guide.url);
      guides.push(guide);
    }

    console.log(
      `  page ${page}: ${blocks.posts.length} cards, ${blocks.featured.length} featured, ${blocks.guides.length} guides`,
    );

    if (options.limit !== null && posts.length >= options.limit) break;
    if (page < stopAt) await sleep(options.delayMs);
    page += 1;
  }

  const scrapedAt = new Date().toISOString();
  const payload = {
    source: `${BASE}/blog`,
    scrapedAt,
    pagesFetched,
    lastPage,
    counts: { posts: posts.length, featured: featured.length, guides: guides.length },
    featured,
    guides,
    posts,
  };

  await writeFile(join(OUT_DIR, 'posts.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(
    join(OUT_DIR, 'index.html'),
    renderDocument({ posts, featured, guides, pagesFetched, scrapedAt }),
    'utf8',
  );

  console.log('');
  console.log(`Wrote ${posts.length} posts, ${featured.length} featured, ${guides.length} guides.`);
  console.log(`  ${join(OUT_DIR, 'index.html')}`);
  console.log(`  ${join(OUT_DIR, 'posts.json')}`);
}

main().catch((error: unknown) => {
  console.error('Scrape failed:');
  console.error(error);
  process.exitCode = 1;
});
