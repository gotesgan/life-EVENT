/**
 * Deterministic placeholder cover art.
 *
 * There is no real photography available for the seed, and inventing fake
 * "photos" of real venues would be dishonest. Instead every listing gets an
 * abstract SVG: a soft duotone gradient drawn from the brand palette plus a
 * geometric motif chosen by category. The images are obviously illustrations,
 * they render in any browser, and they carry no external references.
 *
 * Everything here is a pure function of the slug, so running the seed twice
 * regenerates byte-identical files and the writer can skip the rewrite.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const BRAND_PALETTE = {
  plum: '#7D4F79',
  ink: '#1C1721',
  sand: '#E5C073',
  sage: '#6E8B7B',
  rose: '#B385AE',
} as const;

export type PaletteKey = keyof typeof BRAND_PALETTE;

export const PLACEHOLDER_WIDTH = 1200;
export const PLACEHOLDER_HEIGHT = 800;
export const PLACEHOLDER_MIME_TYPE = 'image/svg+xml';

/** Category family → motif. Kept a closed union so adding a family is explicit. */
export type MotifKey =
  'arch' | 'lens' | 'plate' | 'petal' | 'floral' | 'equaliser' | 'envelope' | 'transit';

export type ImageVariant = 'cover' | 'gallery-2' | 'gallery-3';

export interface PlaceholderImageSpec {
  slug: string;
  family: string;
  variant: ImageVariant;
}

export interface PlaceholderImage {
  /** File name inside the seed media directory, e.g. `gulmohar-cover.svg`. */
  fileName: string;
  /** Browser-facing URL, e.g. `/media/seed/gulmohar-cover.svg`. */
  publicUrl: string;
  /** Object-storage key, e.g. `seed/gulmohar-cover.svg`. */
  storageKey: string;
  sizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

const PALETTE_KEYS = Object.keys(BRAND_PALETTE) as PaletteKey[];

const FAMILY_MOTIFS: Readonly<Record<string, MotifKey>> = {
  venues: 'arch',
  photography: 'lens',
  'planning-and-decor': 'floral',
  catering: 'plate',
  beauty: 'petal',
  entertainment: 'equaliser',
  'invitations-and-gifts': 'envelope',
  'rentals-and-transport': 'transit',
};

export function motifForFamily(family: string): MotifKey {
  return FAMILY_MOTIFS[family] ?? 'arch';
}

/** FNV-1a. Small, dependency-free and stable across Node versions. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Seeded LCG so a slug always produces the same layout. */
function createRandom(seed: string): () => number {
  let state = fnv1a(seed) || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function pick(keys: readonly PaletteKey[]): PaletteKey {
  return keys[0] ?? 'plum';
}

function gradientPair(seed: string): readonly [PaletteKey, PaletteKey] {
  const random = createRandom(`${seed}:palette`);
  const first = Math.floor(random() * PALETTE_KEYS.length);
  let second = Math.floor(random() * PALETTE_KEYS.length);
  if (second === first) second = (second + 2) % PALETTE_KEYS.length;

  const from = pick([PALETTE_KEYS[first] ?? 'plum']);
  const to = pick([PALETTE_KEYS[second] ?? 'ink']);
  return [from, to];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function archMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  const count = 5;
  const gap = 150;
  const startX = 300;
  for (let index = 0; index < count; index += 1) {
    const height = round(260 + random() * 300);
    const width = 104;
    const x = startX + index * gap;
    const y = round(560 - height);
    parts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${round(height + 20)}" rx="${width / 2}" ` +
        `fill="none" stroke="${accent}" stroke-width="14" />`,
    );
    parts.push(
      `<circle cx="${round(x + width / 2)}" cy="${round(y + 40)}" r="16" fill="${accent}" opacity="0.7" />`,
    );
  }
  return parts.join('\n      ');
}

function lensMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  const centreX = 600;
  const centreY = 400;
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = round(90 + ring * 62 + random() * 18);
    parts.push(
      `<circle cx="${centreX}" cy="${centreY}" r="${radius}" fill="none" stroke="${accent}" ` +
        `stroke-width="${round(2 + ring)}" opacity="${round(0.9 - ring * 0.12)}" />`,
    );
  }
  for (let blade = 0; blade < 6; blade += 1) {
    const angle = (blade / 6) * Math.PI * 2;
    const x = round(centreX + Math.cos(angle) * 210);
    const y = round(centreY + Math.sin(angle) * 210);
    parts.push(
      `<path d="M ${centreX} ${centreY} L ${x} ${y}" stroke="${accent}" stroke-width="2" ` +
        `opacity="0.45" stroke-linecap="round" />`,
    );
  }
  return parts.join('\n      ');
}

function plateMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const cx = round(330 + index * 180 + random() * 20);
    const cy = round(430 + random() * 40);
    const rx = round(96 + random() * 22);
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${round(rx * 0.42)}" fill="none" ` +
        `stroke="${accent}" stroke-width="10" />`,
    );
    parts.push(
      `<path d="M ${round(cx - 46)} ${round(cy - 110)} q 46 -60 92 0" fill="none" stroke="${accent}" ` +
        `stroke-width="8" opacity="0.55" stroke-linecap="round" />`,
    );
  }
  return parts.join('\n      ');
}

function petalMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  const centreX = 600;
  const centreY = 400;
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * 360 + random() * 8;
    const distance = round(160 + random() * 90);
    const cx = round(centreX + Math.cos((angle * Math.PI) / 180) * distance);
    const cy = round(centreY + Math.sin((angle * Math.PI) / 180) * distance);
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="34" ry="86" fill="${accent}" opacity="0.5" ` +
        `transform="rotate(${round(angle)} ${cx} ${cy})" />`,
    );
  }
  parts.push(`<circle cx="${centreX}" cy="${centreY}" r="58" fill="${accent}" opacity="0.75" />`);
  return parts.join('\n      ');
}

function floralMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  for (let stem = 0; stem < 5; stem += 1) {
    const baseX = round(240 + stem * 180);
    const height = round(280 + random() * 220);
    parts.push(
      `<path d="M ${baseX} ${round(660)} C ${round(baseX - 40)} ${round(660 - height * 0.5)} ` +
        `${round(baseX + 60)} ${round(660 - height * 0.75)} ${round(baseX + 10)} ${round(660 - height)}" ` +
        `fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" />`,
    );
    for (let leaf = 0; leaf < 3; leaf += 1) {
      const leafY = round(660 - height * (0.35 + leaf * 0.2));
      const side = leaf % 2 === 0 ? 1 : -1;
      parts.push(
        `<ellipse cx="${round(baseX + side * 44)}" cy="${leafY}" rx="40" ry="16" fill="${accent}" ` +
          `opacity="0.55" transform="rotate(${side * 32} ${round(baseX + side * 44)} ${leafY})" />`,
      );
    }
  }
  return parts.join('\n      ');
}

function equaliserMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  for (let bar = 0; bar < 14; bar += 1) {
    const height = round(80 + random() * 380);
    const x = round(180 + bar * 62);
    parts.push(
      `<rect x="${x}" y="${round(640 - height)}" width="26" height="${height}" rx="13" ` +
        `fill="${accent}" opacity="${round(0.45 + random() * 0.45)}" />`,
    );
  }
  parts.push(
    `<path d="M 150 300 q 120 -110 240 0 t 240 0 t 240 0" fill="none" stroke="${accent}" ` +
      `stroke-width="6" opacity="0.4" stroke-linecap="round" />`,
  );
  return parts.join('\n      ');
}

function envelopeMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  parts.push(
    `<rect x="330" y="250" width="540" height="340" rx="18" fill="none" stroke="${accent}" stroke-width="12" />`,
  );
  parts.push(
    `<path d="M 330 268 L 600 470 L 870 268" fill="none" stroke="${accent}" stroke-width="10" ` +
      `stroke-linejoin="round" opacity="0.75" />`,
  );
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const y = round(640 + ribbon * 30);
    parts.push(
      `<path d="M 300 ${y} q 150 ${round(-24 - random() * 20)} 300 0 t 300 0" fill="none" ` +
        `stroke="${accent}" stroke-width="6" opacity="${round(0.5 - ribbon * 0.12)}" />`,
    );
  }
  return parts.join('\n      ');
}

function transitMotif(random: () => number, accent: string): string {
  const parts: string[] = [];
  for (let line = 0; line < 4; line += 1) {
    const y = round(230 + line * 120);
    parts.push(
      `<path d="M 120 ${y} C 420 ${round(y - 70 - random() * 40)} 780 ${round(y + 70 + random() * 40)} ` +
        `1080 ${y}" fill="none" stroke="${accent}" stroke-width="8" opacity="${round(0.6 - line * 0.1)}" ` +
        `stroke-linecap="round" />`,
    );
  }
  for (let node = 0; node < 5; node += 1) {
    const cx = round(240 + node * 180);
    const cy = round(230 + ((node * 120) % 360));
    parts.push(`<circle cx="${cx}" cy="${cy}" r="18" fill="${accent}" opacity="0.8" />`);
  }
  return parts.join('\n      ');
}

function renderMotif(motif: MotifKey, random: () => number, accent: string): string {
  switch (motif) {
    case 'lens':
      return lensMotif(random, accent);
    case 'plate':
      return plateMotif(random, accent);
    case 'petal':
      return petalMotif(random, accent);
    case 'floral':
      return floralMotif(random, accent);
    case 'equaliser':
      return equaliserMotif(random, accent);
    case 'envelope':
      return envelopeMotif(random, accent);
    case 'transit':
      return transitMotif(random, accent);
    case 'arch':
    default:
      return archMotif(random, accent);
  }
}

/** Builds one deterministic, self-contained SVG document. */
export function buildPlaceholderSvg(spec: PlaceholderImageSpec): string {
  const seed = `${spec.slug}:${spec.variant}`;
  const random = createRandom(seed);
  const [fromKey, toKey] = gradientPair(seed);
  const from = BRAND_PALETTE[fromKey];
  const to = BRAND_PALETTE[toKey];
  const accent = BRAND_PALETTE[spec.variant === 'cover' ? 'sand' : 'rose'];
  const gradientId = `grad-${fnv1a(seed).toString(16)}`;
  const motif = motifForFamily(spec.family);
  const angle = Math.round(random() * 60);
  const x2 = round(0.6 + Math.cos((angle * Math.PI) / 180) * 0.4);
  const y2 = round(0.4 + Math.sin((angle * Math.PI) / 180) * 0.5);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800"',
    '     role="img" aria-label="Abstract placeholder illustration" preserveAspectRatio="xMidYMid slice">',
    '  <defs>',
    `    <linearGradient id="${gradientId}" x1="0" y1="0" x2="${x2}" y2="${y2}">`,
    `      <stop offset="0%" stop-color="${from}" />`,
    `      <stop offset="100%" stop-color="${to}" />`,
    '    </linearGradient>',
    `    <radialGradient id="${gradientId}-glow" cx="0.5" cy="0.5" r="0.7">`,
    `      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />`,
    `      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />`,
    '    </radialGradient>',
    '  </defs>',
    `  <rect width="1200" height="800" fill="url(#${gradientId})" />`,
    `  <rect width="1200" height="800" fill="url(#${gradientId}-glow)" />`,
    '  <g opacity="0.62">',
    `      ${renderMotif(motif, random, accent)}`,
    '  </g>',
    `  <rect x="24" y="24" width="1152" height="752" rx="24" fill="none" stroke="${BRAND_PALETTE.sand}"`,
    '        stroke-width="2" opacity="0.28" />',
    '</svg>',
    '',
  ].join('\n');
}

export function placeholderFileName(slug: string, variant: ImageVariant): string {
  return `${slug}-${variant}.svg`;
}

/**
 * Writes the SVG only when the on-disk bytes differ, so repeated seed runs
 * leave mtimes alone and a fresh run stays cheap. Returns the byte length that
 * is recorded on `ListingMedia.sizeBytes`.
 */
export async function writePlaceholderImage(
  directory: string,
  spec: PlaceholderImageSpec,
): Promise<PlaceholderImage> {
  const contents = buildPlaceholderSvg(spec);
  const fileName = placeholderFileName(spec.slug, spec.variant);
  const filePath = `${directory}/${fileName}`;

  await mkdir(dirname(filePath), { recursive: true });

  let existing: string | null = null;
  try {
    existing = await readFile(filePath, 'utf8');
  } catch {
    existing = null;
  }

  if (existing !== contents) {
    await writeFile(filePath, contents, 'utf8');
  }

  return {
    fileName,
    publicUrl: `/media/seed/${fileName}`,
    storageKey: `seed/${fileName}`,
    sizeBytes: Buffer.byteLength(contents, 'utf8'),
    width: PLACEHOLDER_WIDTH,
    height: PLACEHOLDER_HEIGHT,
    mimeType: PLACEHOLDER_MIME_TYPE,
  };
}
