/**
 * Downloads the listing photography declared in
 * `prisma/seed-data/listing-photos.ts` into `public/media/seed/`.
 *
 * Run once after cloning (or when adding a listing):
 *
 *   pnpm tsx scripts/fetch-listing-photos.mts
 *
 * The downloaded JPEGs are committed, so the app, the seed and the test suite
 * never touch the network. Pass `--force` to re-download files that are already
 * present and valid.
 *
 * Source: Unsplash. License: https://unsplash.com/license (free for commercial
 * and non-commercial use, no attribution required).
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HERO_PHOTO,
  LISTING_PHOTOS,
  PHOTO_HEIGHT,
  PHOTO_WIDTH,
  photoFileName,
  unsplashDownloadUrl,
  type ListingPhotoSeed,
} from '../prisma/seed-data/listing-photos';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDirectory = join(root, 'public', 'media', 'seed');
const force = process.argv.includes('--force');

interface Target {
  slug: string;
  photo: ListingPhotoSeed;
}

const targets: Target[] = [
  ...Object.entries(LISTING_PHOTOS).flatMap(([slug, photos]) =>
    photos.map((photo) => ({ slug, photo })),
  ),
  {
    slug: HERO_PHOTO.slug,
    photo: {
      variant: 'cover',
      unsplashId: HERO_PHOTO.unsplashId,
      alt: HERO_PHOTO.alt,
    },
  },
];

const JPEG_SOI = 0xff;
const JPEG_MARKER = 0xd8;

function looksLikeJpeg(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === JPEG_SOI && buffer[1] === JPEG_MARKER;
}

async function readJpegSize(path: string): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await readFile(path);
    if (!looksLikeJpeg(buffer)) return null;

    // Walk the JPEG segment markers to find the SOF frame, which carries the
    // dimensions. Enough to confirm the file is a real, complete JPEG.
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

async function download(url: string): Promise<Buffer> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/jpeg,image/*;q=0.8' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!looksLikeJpeg(buffer)) {
        throw new Error('response was not a JPEG');
      }
      return buffer;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function run(): Promise<void> {
  await mkdir(mediaDirectory, { recursive: true });

  const written: string[] = [];
  const skipped: string[] = [];
  const failed: { file: string; reason: string }[] = [];

  // Small concurrency so we are polite to the CDN.
  const queue = [...targets];
  const workers = Array.from({ length: 4 }, async () => {
    for (;;) {
      const target = queue.shift();
      if (!target) return;
      const fileName = photoFileName(target.slug, target.photo.variant);
      const destination = join(mediaDirectory, fileName);

      if (!force) {
        const size = await readJpegSize(destination);
        if (size && size.width === PHOTO_WIDTH && size.height === PHOTO_HEIGHT) {
          skipped.push(fileName);
          continue;
        }
      }

      const url = unsplashDownloadUrl(target.photo.unsplashId);
      try {
        const buffer = await download(url);
        await writeFile(destination, buffer);
        const size = await readJpegSize(destination);
        if (!size || size.width !== PHOTO_WIDTH || size.height !== PHOTO_HEIGHT) {
          throw new Error(
            `unexpected dimensions ${size ? `${size.width}x${size.height}` : 'unknown'}`,
          );
        }
        const { size: bytes } = await stat(destination);
        written.push(`${fileName} (${Math.round(bytes / 1024)} KB)`);
      } catch (error) {
        failed.push({
          file: fileName,
          reason: error instanceof Error ? error.message : String(error),
        });
        console.error(`FAIL ${fileName}  ${url}`);
        console.error(`     ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  await Promise.all(workers);

  console.log(
    `\n${written.length} downloaded, ${skipped.length} already present, ${failed.length} failed.`,
  );
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
  if (failed.length) {
    console.error('\nFailed:');
    for (const { file, reason } of failed) console.error(`  - ${file}: ${reason}`);
    process.exitCode = 1;
  }
}

await run();
