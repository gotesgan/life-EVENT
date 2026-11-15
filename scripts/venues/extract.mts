/**
 * Step 1 of the venue import pipeline: workbooks → `data/venues/source-venues.json`.
 *
 * The two spreadsheets are the operator's research, not a schema. They disagree
 * with each other (one has an address column, the other only an area; one lists
 * star categories, the other does not), they repeat venues across sheets, and
 * they contain sentinel prose such as "Website link not verified" in columns
 * that otherwise hold URLs. This step normalises all of that into one record per
 * venue, keeping the provenance of every row it merged.
 *
 * Run: pnpm tsx scripts/venues/extract.mts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readWorkbook } from './lib/xlsx';
import type { SourceVenue, VenueCity } from './lib/source';
import {
  collapseWhitespace,
  normaliseEmail,
  normalisePhone,
  normaliseWebsite,
  slugify,
  splitList,
} from './lib/text';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputPath = join(root, 'data/venues/source-venues.json');

const WORKBOOKS = [
  { file: 'All Data For Hotels.xlsx', sheets: ['Pune all Venue ', 'Destinastion Wedding '] },
  {
    file: 'Hinjewadi_Pune_Venue_Database_Expanded.xlsx',
    sheets: ['Hinjewadi Venues', 'Earlier Pune Shortlist'],
  },
] as const;

/** Header text → canonical field. Keys are lowercased and trimmed. */
const HEADER_ALIASES: Record<string, keyof RawRow> = {
  'company name': 'name',
  venue_name: 'name',
  website: 'websiteUrl',
  website_url: 'websiteUrl',
  'phone number': 'phone',
  phone: 'phone',
  location: 'area',
  area: 'area',
  address: 'address',
  email: 'email',
  venue_type: 'venueType',
  star_category: 'starCategory',
  event_types: 'eventTypes',
  venue_spaces: 'venueSpaces',
  maps_url: 'mapsUrl',
  source_url: 'sourceUrl',
  notes: 'notes',
};

interface RawRow {
  name?: string;
  websiteUrl?: string;
  phone?: string;
  area?: string;
  address?: string;
  email?: string;
  venueType?: string;
  starCategory?: string;
  eventTypes?: string;
  venueSpaces?: string;
  mapsUrl?: string;
  sourceUrl?: string;
  notes?: string;
}

function inferCity(text: string): VenueCity {
  const haystack = text.toLowerCase();
  if (/lonavala|khandala|tungarli|kune village|valvan|gold valley/.test(haystack))
    return 'lonavala';
  if (/karjat|khalapur|khandpe|neral|bhivpuri/.test(haystack)) return 'karjat';
  if (/mulshi|tamhini|lavasa|dasve|palse|khubavali/.test(haystack)) return 'mulshi';
  if (/panshet|velhe|koshimghar|malkhed/.test(haystack)) return 'panshet';
  if (/khadakwasla|sinhgad|gorhe|khadakwadi/.test(haystack)) return 'khadakwasla';
  return 'pune';
}

function inferVenueType(name: string, explicit: string | undefined): string {
  const given = collapseWhitespace(explicit ?? '');
  if (given) return given;

  // Order matters: "Cloud 99 Banquet | Restaurant | Bar" is a banquet venue that
  // also runs a restaurant, so the banquet test has to win.
  const haystack = name.toLowerCase();
  if (/resort|retreat|villa|camp|farm/.test(haystack)) return 'Resort';
  if (/hotel|inn|suites|residency|towers/.test(haystack)) return 'Hotel';
  if (/club/.test(haystack)) return 'Club';
  if (/lawn|garden|farmhouse/.test(haystack)) return 'Lawn / farmhouse';
  if (/banquet|hall|karyalay|karyalaya|sabhagruha|bhavan|convention|palace/.test(haystack)) {
    return 'Banquet hall';
  }
  if (/restaurant|dining|bar|lounge|cafe/.test(haystack)) return 'Restaurant';
  return 'Venue';
}

/**
 * The destination sheet puts a full postal address in its "Location" column and
 * leaves the address column empty. Detect that shape rather than storing a
 * 60-character address as the venue's neighbourhood.
 */
function looksLikeAddress(value: string): boolean {
  return /\b\d{6}\b/.test(value) && value.split(',').length >= 3;
}

/** The first comma-separated segment of an address is the locality. */
function localityFromAddress(address: string): string {
  const first = collapseWhitespace(address.split(',')[0] ?? '');
  return first || 'Pune';
}

/**
 * Prefers the most specific URL when two rows describe the same venue: a deep
 * link to the property page beats the bare brand domain the other sheet lists.
 */
function websiteSpecificity(url: string | null): number {
  if (!url) return -1;
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/$/, '').length + parsed.search.length;
  } catch {
    return -1;
  }
}

function postalCodeFrom(address: string | null): string | null {
  const match = address ? /\b(\d{6})\b/.exec(address) : null;
  return match?.[1] ?? null;
}

function readRows(sheetName: string, rows: string[][]): RawRow[] {
  const headerRow = rows.find((row) => row.some((cell) => cell && cell.trim()));
  if (!headerRow) return [];

  const columns = new Map<number, keyof RawRow>();
  headerRow.forEach((cell, index) => {
    const key = HEADER_ALIASES[collapseWhitespace(cell).toLowerCase()];
    if (key) columns.set(index, key);
  });

  const records: RawRow[] = [];
  for (const row of rows.slice(rows.indexOf(headerRow) + 1)) {
    const record: RawRow = {};
    for (const [index, key] of columns) {
      const value = collapseWhitespace(row[index] ?? '');
      if (value) record[key] = value;
    }
    // The Pune sheet repeats its header mid-table; treat it as a row, not a venue.
    if (!record.name || /^company name$/i.test(record.name)) continue;
    records.push(record);
  }
  return records;
}

/** Fills empty fields on `target` from `source`; never overwrites a known value. */
function mergeInto(target: SourceVenue, source: SourceVenue): void {
  const fill = <K extends keyof SourceVenue>(key: K): void => {
    if (target[key] === null || target[key] === undefined || target[key] === '') {
      target[key] = source[key];
    }
  };
  if (websiteSpecificity(source.websiteUrl) > websiteSpecificity(target.websiteUrl)) {
    target.websiteUrl = source.websiteUrl;
  }
  fill('phone');
  fill('email');
  fill('address');
  fill('mapsUrl');
  fill('sourceUrl');
  fill('notes');
  fill('starCategory');
  if (target.area === 'Pune Region / General' && source.area !== 'Pune Region / General') {
    target.area = source.area;
  }
  if (target.eventTypes.length === 0) target.eventTypes = source.eventTypes;
  if (target.venueSpaces.length === 0) target.venueSpaces = source.venueSpaces;
  if (target.venueType === 'Venue' && source.venueType !== 'Venue') {
    target.venueType = source.venueType;
  }
  target.sources.push(...source.sources);
}

async function main(): Promise<void> {
  const venues = new Map<string, SourceVenue>();

  for (const workbook of WORKBOOKS) {
    const buffer = await readFile(join(root, workbook.file));
    const sheets = readWorkbook(buffer);

    for (const sheet of sheets) {
      if (!(workbook.sheets as readonly string[]).includes(sheet.name)) continue;

      for (const [index, row] of readRows(sheet.name, sheet.rows).entries()) {
        const name = collapseWhitespace(row.name ?? '');
        const slug = slugify(name);
        if (!slug) continue;

        const rawArea = collapseWhitespace(row.area ?? '');
        const addressFromArea = !row.address && looksLikeAddress(rawArea);
        const address = row.address
          ? collapseWhitespace(row.address)
          : addressFromArea
            ? rawArea
            : null;
        const area = addressFromArea ? localityFromAddress(rawArea) : rawArea || 'Pune';
        const city = inferCity(`${address ?? ''} ${area} ${name}`);

        const venue: SourceVenue = {
          slug,
          name,
          venueType: inferVenueType(name, row.venueType),
          starCategory: row.starCategory ? collapseWhitespace(row.starCategory) : null,
          websiteUrl: normaliseWebsite(row.websiteUrl),
          phone: normalisePhone(row.phone),
          email: normaliseEmail(row.email),
          area,
          address,
          city,
          postalCode: null,
          eventTypes: splitList(row.eventTypes),
          venueSpaces: splitList(row.venueSpaces),
          mapsUrl: row.mapsUrl ? collapseWhitespace(row.mapsUrl) : null,
          sourceUrl: row.sourceUrl ? collapseWhitespace(row.sourceUrl) : null,
          notes: row.notes ? collapseWhitespace(row.notes) : null,
          sources: [{ workbook: workbook.file, sheet: sheet.name.trim(), row: index + 2 }],
        };

        const existing = venues.get(slug);
        if (existing) mergeInto(existing, venue);
        else venues.set(slug, venue);
      }
    }
  }

  const list = [...venues.values()].sort((a, b) => a.name.localeCompare(b.name));
  // Derived after merging: a row that only contributed an address still has to
  // produce a postal code on the merged record.
  for (const venue of list) venue.postalCode = postalCodeFrom(venue.address);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(list, null, 2)}\n`, 'utf8');

  const withWebsite = list.filter((venue) => venue.websiteUrl).length;
  const byCity = new Map<string, number>();
  for (const venue of list) byCity.set(venue.city, (byCity.get(venue.city) ?? 0) + 1);

  console.log(`Wrote ${list.length} venues to data/venues/source-venues.json`);
  console.log(`  with a usable website: ${withWebsite}`);
  console.log(`  by city: ${[...byCity].map(([city, count]) => `${city}=${count}`).join(', ')}`);
}

await main();
