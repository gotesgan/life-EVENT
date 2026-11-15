/**
 * Step 3 of the venue import pipeline: candidate URLs → local photographs.
 *
 * The scraper records image URLs; this downloads them, throws away everything
 * that is not a usable landscape photograph, and normalises what survives to the
 * product's one media ratio (16:9, 1600×900 — see `prisma/seed-data/listing-photos.ts`).
 *
 * Two deliberate choices:
 *
 *  * **Opaque file names.** A listing's trading name is withheld until a visitor
 *    enquires (`docs/listing-privacy.md`), and the slug is derived from that
 *    name. Files are therefore named from a digest of the slug, exactly as the
 *    seed does, so no `<img src>` spells the name out.
 *  * **`sips`, not a new dependency.** macOS ships an image converter; the
 *    project does not ship `sharp`. AGENTS.md records this preference.
 *
 * Run: pnpm tsx scripts/venues/images.mts [--only=slug] [--force] [--per-venue=4]
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { mapWithConcurrency } from './lib/fetch';
import type { ScrapeResult } from './lib/scrape';
import type { MediaManifest, VenuePhoto } from './lib/listing';

const run = promisify(execFile);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDirectory = join(root, '.cache/venues');
const mediaRoot = join(root, 'public/media/venues');
const manifestPath = join(root, 'data/venues/media.json');

const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 900;

/** Below this a file is a thumbnail, an icon or a spacer. */
const MIN_BYTES = 45_000;
const MIN_WIDTH = 1000;
/** Portrait and square crops lose too much of the subject at 16:9. */
const MIN_RATIO = 1.15;
/**
 * Hotel groups publish 2.9:1 banner strips (1856×638). Cropping one to 16:9 keeps
 * about 60% of its width, which is still a usable venue photograph, so the ceiling
 * is set above them rather than discarding the only imagery a site offers.
 */
const MAX_RATIO = 3.2;

/** A per-venue ceiling so one slow origin cannot stall the whole run. */
const VENUE_BUDGET_MS = 120_000;

/** CDN resize parameters that cap an image below the size we need. */
const RESIZE_PARAMS = [
  'w',
  'width',
  'h',
  'height',
  'q',
  'quality',
  'fit',
  'crop',
  'resize',
  'auto',
];

function withoutResizeParams(url: string): string | null {
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const parameter of RESIZE_PARAMS) {
      if (parsed.searchParams.has(parameter)) {
        parsed.searchParams.delete(parameter);
        changed = true;
      }
    }
    return changed ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface Dimensions {
  width: number;
  height: number;
}

async function sipsDimensions(path: string): Promise<Dimensions | null> {
  try {
    const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]);
    const width = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1] ?? 0);
    const height = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1] ?? 0);
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

async function download(url: string, destination: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.8',
        referer: new URL(url).origin,
      },
    });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_BYTES) return false;

    await writeFile(destination, buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resamples proportionally so both sides cover 1600×900, then centre-crops.
 *
 * `sips --resampleHeightWidth` would stretch the photograph; scaling one side
 * and cropping keeps the subject's proportions intact.
 */
async function normalise(source: string, destination: string): Promise<Dimensions | null> {
  const original = await sipsDimensions(source);
  if (!original) return null;

  const scale = Math.max(TARGET_WIDTH / original.width, TARGET_HEIGHT / original.height);
  const width = Math.round(original.width * scale);
  const height = Math.round(original.height * scale);

  const resizeArgs =
    width >= height ? ['--resampleHeight', String(height)] : ['--resampleWidth', String(width)];

  try {
    await run('sips', [
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      '70',
      ...resizeArgs,
      source,
      '--out',
      destination,
    ]);
    await run('sips', [
      '--cropToHeightWidth',
      String(TARGET_HEIGHT),
      String(TARGET_WIDTH),
      destination,
      '--out',
      destination,
    ]);
  } catch {
    return null;
  }

  return sipsDimensions(destination);
}

/** Stable, name-free directory and file names — see the module comment. */
function digest(slug: string): string {
  return createHash('sha256').update(slug).digest('hex').slice(0, 16);
}

function altText(venueType: string, area: string, index: number, total: number): string {
  const subject = venueType.toLowerCase().includes('hotel')
    ? 'Hotel'
    : venueType.toLowerCase().includes('resort')
      ? 'Resort'
      : venueType.toLowerCase().includes('lawn')
        ? 'Lawn venue'
        : 'Banquet venue';
  return `${subject} in ${area} — venue photograph ${index + 1} of ${total}`;
}

async function processVenue(
  scrape: ScrapeResult,
  venueType: string,
  area: string,
  perVenue: number,
  force: boolean,
): Promise<VenuePhoto[]> {
  const directory = join(mediaRoot, digest(scrape.slug));
  const existing = force
    ? []
    : (await readdir(directory).catch(() => [])).filter((file) => file.endsWith('.jpg'));

  if (existing.length >= Math.min(perVenue, 3) && !force) {
    const photos: VenuePhoto[] = [];
    for (const [index, file] of existing.sort().slice(0, perVenue).entries()) {
      const path = join(directory, file);
      const dimensions = await sipsDimensions(path);
      const { size } = await stat(path);
      photos.push({
        file,
        publicUrl: `/media/venues/${digest(scrape.slug)}/${file}`,
        storageKey: `venues/${digest(scrape.slug)}/${file}`,
        width: dimensions?.width ?? TARGET_WIDTH,
        height: dimensions?.height ?? TARGET_HEIGHT,
        sizeBytes: size,
        alt: altText(venueType, area, index, existing.length),
        sourceUrl: '',
      });
    }
    return photos;
  }

  await mkdir(directory, { recursive: true });
  const scratch = join(tmpdir(), `venues-${digest(scrape.slug)}`);
  await mkdir(scratch, { recursive: true });

  const accepted: { path: string; ratio: number; width: number; sourceUrl: string }[] = [];
  const deadline = Date.now() + VENUE_BUDGET_MS;

  for (const [index, url] of scrape.images.entries()) {
    if (accepted.length >= perVenue || Date.now() > deadline) break;

    const raw = join(scratch, `raw-${index}`);
    if (!(await download(url, raw))) continue;

    let dimensions = await sipsDimensions(raw);
    let sourceUrl = url;

    // A CDN that serves `?w=980` is holding back a larger original. Ask for it
    // once before rejecting the photograph for being too small.
    if (dimensions && dimensions.width < TARGET_WIDTH) {
      const fullSize = withoutResizeParams(url);
      if (fullSize && (await download(fullSize, raw))) {
        const fullDimensions = await sipsDimensions(raw);
        if (fullDimensions && fullDimensions.width > dimensions.width) {
          dimensions = fullDimensions;
          sourceUrl = fullSize;
        }
      }
    }

    if (!dimensions || dimensions.width < MIN_WIDTH) continue;

    const ratio = dimensions.width / dimensions.height;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) continue;

    const normalised = join(scratch, `out-${index}.jpg`);
    const result = await normalise(raw, normalised);
    if (!result) continue;

    accepted.push({ path: normalised, ratio, width: result.width, sourceUrl });
  }

  // Order is the scraper's relevance order, not the ratio order: a gallery
  // photograph of the banquet hall at 1.4:1 is a better cover than a perfectly
  // 16:9 shot of a dosa from the restaurant page.
  const photos: VenuePhoto[] = [];
  for (const [index, candidate] of accepted.slice(0, perVenue).entries()) {
    const file = `v-${digest(scrape.slug)}-${String(index + 1).padStart(2, '0')}.jpg`;
    const destination = join(directory, file);
    await writeFile(destination, await readFile(candidate.path));
    const { size } = await stat(destination);
    photos.push({
      file,
      publicUrl: `/media/venues/${digest(scrape.slug)}/${file}`,
      storageKey: `venues/${digest(scrape.slug)}/${file}`,
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      sizeBytes: size,
      alt: altText(venueType, area, index, Math.min(accepted.length, perVenue)),
      sourceUrl: candidate.sourceUrl,
    });
  }

  await rm(scratch, { recursive: true, force: true });
  return photos;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length);
  const perVenue = Number(
    argv.find((argument) => argument.startsWith('--per-venue='))?.slice('--per-venue='.length) ?? 4,
  );
  const force = argv.includes('--force');
  const concurrency = Number(
    argv
      .find((argument) => argument.startsWith('--concurrency='))
      ?.slice('--concurrency='.length) ?? 4,
  );

  const venues: { slug: string; venueType: string; area: string }[] = JSON.parse(
    await readFile(join(root, 'data/venues/source-venues.json'), 'utf8'),
  );
  const bySlug = new Map(venues.map((venue) => [venue.slug, venue]));

  const files = (await readdir(cacheDirectory).catch(() => [])).filter((file) =>
    file.endsWith('.json'),
  );
  const scrapes: ScrapeResult[] = [];
  for (const file of files) {
    const scrape: ScrapeResult = JSON.parse(await readFile(join(cacheDirectory, file), 'utf8'));
    if (scrape.status !== 'ok' || scrape.images.length === 0) continue;
    if (only && scrape.slug !== only) continue;
    scrapes.push(scrape);
  }

  const manifest: MediaManifest = {};
  let done = 0;

  await mapWithConcurrency(scrapes, concurrency, async (scrape) => {
    const venue = bySlug.get(scrape.slug);
    const photos = await processVenue(
      scrape,
      venue?.venueType ?? 'Venue',
      venue?.area ?? 'Pune',
      perVenue,
      force,
    );
    if (photos.length > 0) manifest[scrape.slug] = photos;
    done += 1;
    console.log(`[${done}/${scrapes.length}] ${scrape.slug}: ${photos.length} photographs`);
  });

  // Merge with the previous manifest so a `--only` run does not drop the rest.
  const previous: MediaManifest = await readFile(manifestPath, 'utf8')
    .then((raw) => JSON.parse(raw) as MediaManifest)
    .catch(() => ({}));
  const merged = { ...previous, ...manifest };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const total = Object.values(merged).reduce((sum, photos) => sum + photos.length, 0);
  console.log(
    `\n${Object.keys(merged).length} venues, ${total} photographs → data/venues/media.json`,
  );
}

await main();
