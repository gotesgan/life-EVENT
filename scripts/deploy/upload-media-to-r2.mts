/**
 * Uploads the committed catalogue photographs to Cloudflare R2 and repoints
 * `listing_media.publicUrl` at the bucket.
 *
 * The seed and the venue importer reference files under `public/media/`, which
 * Next serves from the deployment. That works, but it ships ~67 MB of JPEGs with
 * every build and ties the catalogue to the app origin. This step moves the
 * bytes to R2 once and rewrites the stored URL, so the app serves media from the
 * bucket's CDN and the local copies become the source of truth for the upload
 * rather than the serving path.
 *
 * Idempotent by design: an object that already exists with the same byte length
 * is not re-uploaded, and a row whose `publicUrl` already points at the bucket is
 * not rewritten. A redeploy therefore costs one `HEAD` per media row, not a
 * 67 MB transfer.
 *
 * Opt-in on the same flag as the catalogue bootstrap, because a preview
 * deployment shares the production database unless its variables say otherwise.
 * Without the flag it exits 0 and does nothing.
 *
 * Run: pnpm tsx scripts/deploy/upload-media-to-r2.mts [--force]
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import {
  buildR2PublicUrl,
  createR2Client,
  isMissingObjectError,
  resolveR2Endpoint,
  type R2ClientConfig,
} from '@/lib/storage/r2-client';
import { mapWithConcurrency } from '../venues/lib/fetch.ts';

const PUBLIC_ROOT = resolve(process.cwd(), 'public');
const MEDIA_ROOT = join(PUBLIC_ROOT, 'media');

/** Enough parallelism to hide round-trip latency without hammering the bucket. */
const CONCURRENCY = 8;

const enabled =
  process.env.BOOTSTRAP_CATALOGUE_ON_DEPLOY === 'true' || process.argv.includes('--force');

/** Reports what would be uploaded without touching the bucket or the database. */
const dryRun = process.argv.includes('--dry-run');

if (!enabled) {
  console.log(
    'Skipping media upload: BOOTSTRAP_CATALOGUE_ON_DEPLOY is not "true" (pass --force to override).',
  );
  process.exit(0);
}

/**
 * Reads R2 configuration straight from `process.env`.
 *
 * `src/lib/env.ts` is `server-only`, so a script cannot use it; the shared
 * client and URL helpers in `src/lib/storage/r2-client.ts` are the part both
 * paths agree on.
 */
function readR2Config(): R2ClientConfig | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  const endpoint = resolveR2Endpoint({
    accountId: process.env.R2_ACCOUNT_ID,
    endpoint: process.env.R2_ENDPOINT,
  });

  if (!accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl || !endpoint) {
    return null;
  }

  return { accessKeyId, secretAccessKey, bucket, publicBaseUrl, endpoint };
}

const config = readR2Config();

if (config === null) {
  console.log(
    'Skipping media upload: R2 is not configured (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL and R2_ACCOUNT_ID/R2_ENDPOINT are required).',
  );
  process.exit(0);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

if (!connectionString) {
  console.error(
    [
      'Refusing to upload media: neither DIRECT_URL nor DATABASE_URL is set.',
      '',
      'The upload rewrites listing_media.publicUrl, so it needs the database.',
    ].join('\n'),
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const client = createR2Client(config);

// `process.exit` is typed `never`, but TypeScript does not carry that narrowing
// into the closures below, so bind the narrowed value once.
const r2: R2ClientConfig = config;

interface Counters {
  uploaded: number;
  skipped: number;
  missing: number;
  repointed: number;
}

async function headObject(key: string): Promise<{ sizeBytes: number } | null> {
  try {
    const output = await client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return { sizeBytes: output.ContentLength ?? 0 };
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const rows = await prisma.listingMedia.findMany({
    select: { id: true, storageKey: true, publicUrl: true, mimeType: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Syncing ${rows.length} media rows to R2…`);

  const counters: Counters = { uploaded: 0, skipped: 0, missing: 0, repointed: 0 };

  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const localPath = join(MEDIA_ROOT, row.storageKey);

    // `storageKey` comes from the database, but a bad row must not be able to
    // read outside the media directory.
    if (!localPath.startsWith(MEDIA_ROOT + sep)) {
      counters.missing += 1;
      console.warn(`  ! ${row.storageKey}: key escapes the media directory — skipped`);
      return;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(localPath);
    } catch {
      // No committed file. An admin upload already lives in R2, or the file is
      // gone; either way there is nothing to upload.
      if (row.publicUrl.startsWith('/')) {
        counters.missing += 1;
        console.warn(`  ! ${row.storageKey}: no local file and no R2 URL — skipped`);
      }
      return;
    }

    if (dryRun) {
      counters.uploaded += 1;
      return;
    }

    const existing = await headObject(row.storageKey);
    if (existing === null || existing.sizeBytes !== bytes.byteLength) {
      await client.send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: row.storageKey,
          Body: bytes,
          ContentType: row.mimeType,
          ContentLength: bytes.byteLength,
        }),
      );
      counters.uploaded += 1;
    } else {
      counters.skipped += 1;
    }

    const publicUrl = buildR2PublicUrl(r2.publicBaseUrl, row.storageKey);
    if (row.publicUrl !== publicUrl) {
      await prisma.listingMedia.update({ where: { id: row.id }, data: { publicUrl } });
      counters.repointed += 1;
    }
  });

  const verb = dryRun ? 'would upload' : 'uploaded';
  console.log(
    `Media synced: ${counters.uploaded} ${verb}, ${counters.skipped} already present, ` +
      `${counters.repointed} URLs repointed, ${counters.missing} skipped.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Media upload failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
