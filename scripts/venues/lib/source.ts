/**
 * The normalised shape of one workbook row.
 *
 * It lives in `lib/` rather than in `extract.mts` because the other steps import
 * the type: importing a script module would run its `main()`.
 */

export type VenueCity = 'pune' | 'lonavala' | 'karjat' | 'mulshi' | 'panshet' | 'khadakwasla';

export interface SourceVenue {
  slug: string;
  name: string;
  venueType: string;
  starCategory: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  area: string;
  address: string | null;
  city: VenueCity;
  postalCode: string | null;
  eventTypes: string[];
  venueSpaces: string[];
  mapsUrl: string | null;
  sourceUrl: string | null;
  notes: string | null;
  sources: { workbook: string; sheet: string; row: number }[];
}
