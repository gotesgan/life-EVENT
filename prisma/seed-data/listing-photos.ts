/**
 * Real photography for the seeded listings.
 *
 * The previous seed drew abstract SVG "placeholder art" for every listing, so a
 * browse grid of twelve cards rendered four recoloured wireframe motifs. That is
 * the single defect the visual audit ranked most damaging (`current-state-audit`
 * §3.1): a marketplace bought on photography read as a wireframe with finished
 * typography.
 *
 * These are real photographs of weddings, venues, catering, florals and bridal
 * work, sourced from Unsplash and covered by the Unsplash License — free to use
 * for commercial and non-commercial purposes, no permission or attribution
 * required (https://unsplash.com/license). Every `unsplashId` below was read from
 * the live search results on unsplash.com and verified to return HTTP 200 with
 * landscape dimensions before being recorded here.
 *
 * Assets are downloaded once, committed under `public/media/seed/`, and served
 * from the same origin as the app (see `scripts/fetch-listing-photos.mts`). There
 * is no runtime dependency on Unsplash and no hot-linking: the seed references
 * the local file, so the demo is offline-safe and reproducible.
 *
 * The dataset is illustrative, not real inventory: the businesses are fictional
 * (see `docs/master-ui-redesign-plan.md` §G). The imagery is labelled by source
 * and the alt text describes the scene, not a claim about the business.
 */

import { createHash } from 'node:crypto';

export const PHOTO_WIDTH = 1600;
export const PHOTO_HEIGHT = 900;

/** The one media ratio the product uses, chosen once (guide §G): 16:9. */
export const PHOTO_RATIO_LABEL = '16 / 9';

export type PhotoVariant = 'cover' | 'gallery-2' | 'gallery-3';

export interface ListingPhotoSeed {
  variant: PhotoVariant;
  /** The Unsplash CDN id: the part after `photo-` in an `images.unsplash.com` URL. */
  unsplashId: string;
  /** Describes the photograph itself — never a claim the business did not make. */
  alt: string;
}

/**
 * The one photograph above the fold on the home page. Its counterpart used to be
 * a bare Unsplash URL hard-coded in `src/app/page.tsx`; it now ships as a local
 * asset like every other image (audit A12).
 */
export const HERO_PHOTO = {
  slug: 'home-hero',
  unsplashId: '1744804298431-57953e4eaba0',
  alt: 'A couple celebrating beneath a floral arch as confetti falls',
} as const;

export const LISTING_PHOTOS: Readonly<Record<string, readonly ListingPhotoSeed[]>> = {
  // --- Venues ------------------------------------------------------------
  'gulmohar-banjara-banquets': [
    {
      variant: 'cover',
      unsplashId: '1698934641149-93431f3bd4f7',
      alt: 'A banquet hall laid with round tables and chairs beneath chandeliers',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1759477274116-e3cb02d2b9d8',
      alt: 'An empty banquet hall set with red chairs around round tables',
    },
    {
      variant: 'gallery-3',
      unsplashId: '1712314947761-a8d718bd8c32',
      alt: 'A pillar-free hall of tables and chandeliers prepared for a reception',
    },
  ],
  'the-sandalwood-grand': [
    {
      variant: 'cover',
      unsplashId: '1675247488725-22d1b78e75db',
      alt: 'A ballroom set for dinner with chandeliers above the tables',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1549895058-36748fa6c6a7',
      alt: 'A chandelier lit above a white-panelled banqueting hall',
    },
    {
      variant: 'gallery-3',
      unsplashId: '1744805624890-9931ebb50428',
      alt: 'A ceremony set in front of a floral arch, chairs laid out on the lawn',
    },
  ],
  'tarang-resort-and-spa': [
    {
      variant: 'cover',
      unsplashId: '1782025419777-09e493453d9f',
      alt: 'White canvas tents pitched on a green lawn beside the water',
    },
  ],
  'vaatika-lawns-and-farmhouse': [
    {
      variant: 'cover',
      unsplashId: '1774814305525-c302b0dee3e7',
      alt: 'Rows of white chairs arranged on a wide green lawn',
    },
  ],
  'navrang-convention-centre': [
    {
      variant: 'cover',
      unsplashId: '1677129663241-5be1f17fe6fe',
      alt: 'A convention hall set with long rows of white-dressed tables',
    },
  ],

  // --- Photography & film -----------------------------------------------
  'smriti-frame-studios': [
    {
      variant: 'cover',
      unsplashId: '1519689950823-0a2251441815',
      alt: 'A photographer raising a camera to shoot a wedding',
    },
  ],
  'patang-photography': [
    {
      variant: 'cover',
      unsplashId: '1630526720753-aa4e71acf67d',
      alt: 'A couple in traditional wedding dress standing on a river rock',
    },
  ],
  'the-second-light-collective': [
    {
      variant: 'cover',
      unsplashId: '1611550287705-7ff8b459c8eb',
      alt: 'A camera operator on location with a DSLR',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1506355639690-a1f2a100689e',
      alt: 'A newly married couple standing together on a boulder',
    },
    {
      variant: 'gallery-3',
      unsplashId: '1617724975854-70b5d0cedb0a',
      alt: 'A bride and groom walking hand in hand along a beach',
    },
  ],
  'chitrakatha-films': [
    {
      variant: 'cover',
      unsplashId: '1629756048377-09540f52caa1',
      alt: 'A videographer holding a DSLR camera rig',
    },
  ],

  // --- Catering ----------------------------------------------------------
  'rasoi-raag-caterers': [
    {
      variant: 'cover',
      unsplashId: '1555244162-803834f70033',
      alt: 'A buffet counter of silver chafing dishes holding prepared dishes',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1680490964889-67a5ab8d8b54',
      alt: 'A server ladling a dish from a bowl on the catering line',
    },
    {
      variant: 'gallery-3',
      unsplashId: '1777613112895-139720bd43c9',
      alt: 'Several curries and sides served in clay pots',
    },
  ],
  'angara-live-kitchens': [
    {
      variant: 'cover',
      unsplashId: '1576470188240-c381bb6a8924',
      alt: 'A cook working a live fire counter at a food station',
    },
  ],

  // --- Beauty & styling --------------------------------------------------
  'mirage-beauty-studio': [
    {
      variant: 'cover',
      unsplashId: '1636023730877-233b9237d4ec',
      alt: 'A makeup artist working a brush across a client’s face',
    },
  ],
  'aadya-artistry': [
    {
      variant: 'cover',
      unsplashId: '1677691257363-eebd2abeafec',
      alt: 'A bride in a red and gold outfit after her bridal makeup',
    },
  ],
  'saffron-threads-styling': [
    {
      variant: 'cover',
      unsplashId: '1600685890506-593fdf55949b',
      alt: 'A bride with her hair and veil styled, wearing traditional gold jewellery',
    },
  ],

  // --- Decor & florals ---------------------------------------------------
  'phoolpatte-designs': [
    {
      variant: 'cover',
      unsplashId: '1746044159204-1c0dc41802ea',
      alt: 'A floral installation lit for an evening celebration',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1764670055753-1a190164b2ee',
      alt: 'Chairs and floral arrangements set out on a lawn for a ceremony',
    },
    {
      variant: 'gallery-3',
      unsplashId: '1769230361357-8278572302d2',
      alt: 'A table setting dressed in white flowers beside ceremony chairs',
    },
  ],
  'dhundh-floral-and-decor': [
    {
      variant: 'cover',
      unsplashId: '1772127822552-ce9ef537bdcf',
      alt: 'A decorated floral arch standing over a lawn ceremony',
    },
  ],

  // --- Entertainment -----------------------------------------------------
  'skyline-sound-djs': [
    {
      variant: 'cover',
      unsplashId: '1657208431551-cbf415b8ef26',
      alt: 'Stage spotlights cutting through haze over a dance floor',
    },
  ],
  'raag-bahar-live-band': [
    {
      variant: 'cover',
      unsplashId: '1541002610386-cbea235ba989',
      alt: 'A live band performing on a lit stage',
    },
  ],

  // --- Planning & stationery --------------------------------------------
  'sunheri-plans-weddings': [
    {
      variant: 'cover',
      unsplashId: '1744805624952-dab790f6b3bd',
      alt: 'A decorated table and chairs set out for a celebration',
    },
  ],
  'kaagaz-letterpress': [
    {
      variant: 'cover',
      unsplashId: '1633037773384-27d7ac0491e7',
      alt: 'A letterpress invitation suite with flowers and a silk ribbon',
    },
  ],

  // --- Rentals & transport ----------------------------------------------
  'raatrani-rovers': [
    {
      variant: 'cover',
      unsplashId: '1587750059638-e7e8c43b99fc',
      alt: 'A black chauffeur car waiting with its headlights lit',
    },
  ],
  // --- Corporate events --------------------------------------------------
  'meridian-conference-centre': [
    {
      variant: 'cover',
      unsplashId: '1675247488725-22d1b78e75db',
      alt: 'A ballroom set for dinner with chandeliers above the tables',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1549895058-36748fa6c6a7',
      alt: 'A chandelier lit above a white-panelled banqueting hall',
    },
  ],
  'orbit-business-hotel': [
    {
      variant: 'cover',
      unsplashId: '1677129663241-5be1f17fe6fe',
      alt: 'A convention hall set with long rows of white-dressed tables',
    },
  ],
  'northstar-corporate-catering': [
    {
      variant: 'cover',
      unsplashId: '1555244162-803834f70033',
      alt: 'A buffet counter of silver chafing dishes holding prepared dishes',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1680490964889-67a5ab8d8b54',
      alt: 'A server ladling a dish from a bowl on the catering line',
    },
  ],
  'signal-and-stage-av': [
    {
      variant: 'cover',
      unsplashId: '1657208431551-cbf415b8ef26',
      alt: 'Stage spotlights cutting through haze over a dance floor',
    },
  ],
  'summit-offsite-estate': [
    {
      variant: 'cover',
      unsplashId: '1782025419777-09e493453d9f',
      alt: 'White canvas tents pitched on a green lawn beside the water',
    },
    {
      variant: 'gallery-2',
      unsplashId: '1774814305525-c302b0dee3e7',
      alt: 'Rows of white chairs arranged on a wide green lawn',
    },
  ],
};

/**
 * The on-disk name of a seeded photograph.
 *
 * Listing files are named from a digest of the slug rather than from the slug
 * itself. The product withholds a listing's trading name until an enquiry is
 * sent, and the slug is derived from that name — a file called
 * `gulmohar-banjara-banquets-cover.jpg` would spell the withheld name out in
 * every `<img src>`, in the Open Graph image and in the network panel, which is
 * exactly the leak the mask exists to prevent.
 *
 * The digest is deterministic, so re-running the seed resolves the same file
 * name it wrote the first time. The one exception is the home-page hero, which
 * is not a listing and keeps its descriptive name.
 */
export function photoFileName(slug: string, variant: PhotoVariant): string {
  if (slug === HERO_PHOTO.slug) return `${slug}-${variant}.jpg`;
  const digest = createHash('sha256').update(slug).digest('hex').slice(0, 16);
  return `l-${digest}-${variant}.jpg`;
}

/** Browser-facing URL for a seeded photograph. */
export function photoPublicUrl(slug: string, variant: PhotoVariant): string {
  return `/media/seed/${photoFileName(slug, variant)}`;
}

/** Object-storage key, mirroring the local driver's layout. */
export function photoStorageKey(slug: string, variant: PhotoVariant): string {
  return `seed/${photoFileName(slug, variant)}`;
}

/**
 * The CDN URL the fetch script downloads from. Cropped to the product's 16:9 at
 * source, so no listing image is centre-cropped by `object-fit` at render time.
 */
export function unsplashDownloadUrl(unsplashId: string): string {
  return (
    `https://images.unsplash.com/photo-${unsplashId}` +
    `?fm=jpg&fit=crop&w=${PHOTO_WIDTH}&h=${PHOTO_HEIGHT}&q=78`
  );
}
