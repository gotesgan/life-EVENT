/**
 * Deploy-time catalogue bootstrap: reference data + the imported venue catalogue.
 *
 * Vercel runs `pnpm vercel-build` when that script exists (see package.json), so
 * this is what puts the listings into the deployed database. It is deliberately
 * *not* the full seed: `prisma/seed.ts` also writes demo users, demo enquiries
 * and audit rows, which must never reach a real catalogue. Only the reference
 * tables (locations, categories, event types, attributes, amenities) and the
 * venues from `data/venues/listings.json` are loaded here.
 *
 * Opt-in by design. A preview deployment shares the production database unless
 * its environment variables say otherwise, so a build that writes listings on
 * every branch would let a feature branch publish to the live catalogue. Set
 * `BOOTSTRAP_CATALOGUE_ON_DEPLOY=true` on the environment that should own the
 * catalogue and leave it unset everywhere else; the script exits 0 and does
 * nothing when it is absent.
 *
 * Publication mode:
 *   CATALOGUE_PUBLISH_MODE=all   (default) every listing goes live, including
 *                                the ones `venues:build` held back for having
 *                                fewer than three photographs or for tripping
 *                                the location-conflict / spam checks. Those
 *                                render the deterministic placeholder motif.
 *   CATALOGUE_PUBLISH_MODE=json  respect the statuses in listings.json, which
 *                                is the conservative choice: only listings with
 *                                three or more photographs go live.
 *
 * Run: pnpm tsx scripts/deploy/bootstrap-catalogue.mts [--force]
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { disconnectSeedClient, seedReferenceData } from '../../prisma/seed';
import type { ImportedListing } from '../venues/lib/listing';
import { disconnectImportClient, runImport } from '../venues/import.mts';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

if (!connectionString) {
  console.error(
    [
      'Refusing to bootstrap: neither DIRECT_URL nor DATABASE_URL is set.',
      '',
      'The deploy needs a direct PostgreSQL connection to write the catalogue.',
    ].join('\n'),
  );
  process.exit(1);
}

const enabled =
  process.env.BOOTSTRAP_CATALOGUE_ON_DEPLOY === 'true' || process.argv.includes('--force');

if (!enabled) {
  console.log(
    'Skipping catalogue bootstrap: BOOTSTRAP_CATALOGUE_ON_DEPLOY is not "true" (pass --force to override).',
  );
  process.exit(0);
}

// Both the seed and the importer refuse to write under NODE_ENV=production
// unless this is set. The deploy is the one caller that legitimately needs it,
// and it is gated on the opt-in above rather than on NODE_ENV.
process.env.ALLOW_SEED_IN_PRODUCTION = 'true';

const publishMode = process.env.CATALOGUE_PUBLISH_MODE === 'json' ? 'json' : 'all';

async function main(): Promise<void> {
  console.log(`Bootstrapping catalogue (publish mode: ${publishMode})…`);

  const reference = await seedReferenceData();
  console.log(
    `  reference data: ${reference.locations} locations, ${reference.categories} categories, ` +
      `${reference.eventTypes} event types, ${reference.attributeDefinitions} attributes, ` +
      `${reference.amenities} amenities`,
  );

  const listings: ImportedListing[] = JSON.parse(
    await readFile(join(process.cwd(), 'data/venues/listings.json'), 'utf8'),
  );

  const withoutPhotos = listings.filter((listing) => listing.media.length === 0).length;
  const heldBack = listings.filter((listing) => listing.publicationStatus !== 'PUBLISHED').length;

  if (publishMode === 'all' && heldBack > 0) {
    console.warn(
      [
        `  ! publishing ${heldBack} listings that venues:build held back as DRAFT.`,
        `    ${withoutPhotos} of ${listings.length} have no photographs and will render the`,
        '    placeholder motif. Set CATALOGUE_PUBLISH_MODE=json to respect the build gate.',
      ].join('\n'),
    );
  }

  const summary = await runImport({ publish: publishMode === 'all' });

  console.log(
    `Catalogue ready: ${summary.imported}/${summary.total} listings imported, ` +
      `${summary.published} published.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Catalogue bootstrap failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectImportClient();
    await disconnectSeedClient();
  });
