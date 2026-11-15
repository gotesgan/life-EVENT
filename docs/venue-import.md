# Venue import pipeline

How the two research workbooks in the repository root become catalogue listings with
photographs, packages and venue details.

```
All Data For Hotels.xlsx ─┐
Hinjewadi_…_Expanded.xlsx ─┴─► extract ─► source-venues.json
                                              │
                        venue websites ─► scrape ─► .cache/venues/*.json
                                              │
                        photographs ─────► images ─► public/media/venues/ + media.json
                                              │
                                       build ─► listings.json
                                              │
                                     import ─► PostgreSQL
```

Each step is a separate script so a bad fetch or a bad derivation can be re-run without
repeating the expensive parts. The committed artefacts are `data/venues/*.json` and
`public/media/venues/`; the scrape cache under `.cache/` is gitignored because it is
third-party content captured at a point in time.

## Commands

| Command               | What it does                                                                |
| --------------------- | --------------------------------------------------------------------------- |
| `pnpm venues:extract` | Workbooks → `data/venues/source-venues.json` (one record per venue)         |
| `pnpm venues:scrape`  | Websites → `.cache/venues/<slug>.json`                                      |
| `pnpm venues:images`  | Candidate URLs → `public/media/venues/<digest>/` + `data/venues/media.json` |
| `pnpm venues:build`   | Everything → `data/venues/listings.json`                                    |
| `pnpm venues:import`  | `listings.json` → database (idempotent by slug)                             |
| `pnpm venues`         | All five, in order                                                          |

Useful flags:

```bash
pnpm venues:scrape --limit=20 --concurrency=4      # a sample
pnpm venues:scrape --only=della-resorts --force    # one venue, ignore the cache
pnpm venues:scrape --city=lonavala                 # one destination
pnpm venues:images --per-venue=6 --force           # more photographs per venue
pnpm venues:build --draft                          # everything as DRAFT
pnpm venues:import --only=della-resorts --publish  # publish one listing
```

## What each step decides

**extract** normalises the workbooks. They disagree with each other — one has an address
column, the other only an area; one lists star categories, the other does not; the same
venue appears in several sheets. Records are merged on a slug of the name, and the most
specific website URL wins (a deep property page beats a bare brand domain). Sentinel prose
such as "Website link not verified" in the website column is dropped rather than guessed at.

**scrape** fetches the home page plus up to four internal pages that plausibly describe the
venue (weddings, banquets, gallery, packages, contact). Static `fetch` first; headless
Chrome (`channel: 'chrome'`, already installed) when the page needs JavaScript or returns 403. It records headings, paragraphs, photographs, phones, emails and rupee prices.

**images** downloads candidates, rejects anything that is not a landscape photograph
(icons, logos, award badges, tracking pixels, portrait crops, files under 45 KB), and
normalises what survives to the product's one ratio, 1600×900 JPEG. Files are named from a
digest of the slug, never the slug itself, because the trading name is withheld until a
visitor enquires (`docs/listing-privacy.md`).

**build** derives the listing fields. Every derivation is conservative: a capacity is only
recorded when the page states one, a price only when the venue publishes one. A venue with
no published price gets a single unpriced "Tailored quote" package rather than an invented
figure. A listing is only `PUBLISHED` when it has at least three photographs and some prose;
everything else is `DRAFT`.

**import** upserts by slug and rewrites every child collection, exactly as `prisma/seed.ts`
does, so a re-run repairs rather than duplicates. It also upserts the geography from
`prisma/seed-data/locations.ts`, which is why the Pune localities and the destination towns
(Lonavala, Karjat, Mulshi) live there rather than in the import data.

## Provenance and consent

These listings describe **real businesses**, scraped from their own public websites. That is
different from the seeded demo catalogue, which is entirely fictional.

- Every listing carries `verificationStatus: UNVERIFIED` and its provenance in
  `data/venues/listings.json` (`provenance.workbooks`, `provenance.finalUrl`,
  `provenance.scrapedAt`).
- Photographs are the venues' own, downloaded from their sites. They are stored so the
  catalogue can be reviewed and demonstrated; they are **not** licensed for republication.
  Before this catalogue goes live, each vendor must claim the listing and supply media they
  own, or grant permission in writing. Treat the scraped set as a working draft.
- Prices are only ever what the venue published, and they are published prices, not quotes.
  The importer never invents a number.
- The scraper is polite: one request at a time per host, a 20 s timeout, a 2-minute budget
  per venue, and no retry storms. Re-runs hit the cache unless `--force` is passed.

## Results of the first full run

| Metric                                  | Count |
| --------------------------------------- | ----- |
| Venues in the workbooks                 | 278   |
| With a usable website                   | 217   |
| Scraped successfully                    | 94    |
| Site returned 403/429/503               | 12    |
| Domain does not resolve or site is down | 111   |
| Venues with photographs                 | 61    |
| Photographs stored                      | 201   |
| Listings published                      | 46    |
| Listings held as drafts                 | 232   |
| Venues with a published price           | 2     |
| Venues with a stated capacity           | 32    |

Only two venues publish a price a machine can trust. That is the honest result, not a gap
in the pipeline: Indian venue sites quote per event. The other 44 published listings carry
an unpriced package that says so, plus the inclusions the venue confirmed.

Seven rows were held back automatically because the site they point at describes a
different property — a Zirakpur hotel, a Thailand resort, a Mumbai hotel — and one
(`hotelauroratowers.com`) now serves gambling spam. The guard is
`detectLocationConflict` / `looksLikeSpam` in `scripts/venues/lib/derive.ts`.

The 111 failures are mostly the `Pune all Venue` sheet, whose website column contains a
large number of domains that do not exist. They are not scraper bugs: `dig` returns NXDOMAIN
for them. Those venues still import as `DRAFT` listings with their workbook contact details
and no photographs.

## Adding a venue by hand

1. Add the row to `data/venues/source-venues.json` (or to a workbook and re-run `extract`).
2. `pnpm venues:scrape --only=<slug>`
3. `pnpm venues:images --only=<slug>`
4. `pnpm venues:build --only=<slug>`
5. `pnpm venues:import --only=<slug>`

## Tests

The pipeline's pure parts are covered by `tests/unit/venue-import.test.ts`: slug and URL
normalisation, price filtering, capacity extraction, space-name filtering, location
resolution and package derivation.
