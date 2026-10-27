# Withheld venue identity (the enquiry gate)

A listing's trading name and contact channels are **not public**. They are withheld until the
visitor has sent an enquiry for that listing. This is a product decision, not a UI preference:
the marketplace's job is to capture attributable enquiries, and a page that publishes the
business's own name lets a visitor walk around it.

The rule, stated plainly:

> A visitor can see everything a business has published — prices, capacity, facilities,
> photographs, packages — but the trading name and the contact details appear only after that
> visitor has sent an enquiry about that business.

## What a visitor sees before enquiring

| Surface              | Public form                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| Card / grid          | `Banquet hall in Andheri East`, a lock glyph, “Name shown after enquiry” |
| Profile heading      | the same anonymous label; the enquiry rail states once what unlocks it   |
| Profile contact      | “Name & contact details”, no channel rendered at all                     |
| Prose                | the trading name replaced with “this business” / “This business”         |
| Named halls/packages | brand words removed, e.g. `Gulmohar Grand Hall` → `Grand Hall`           |
| Image URLs           | opaque digests, e.g. `/media/seed/l-21ec9f4e70e1015f-cover.jpg`          |
| URL                  | opaque reference, e.g. `/vendors/ul_cmvnu50oz00kiwd1rebzgidvh`           |
| `<title>`, OG tags   | always the anonymous label, even for a revealed visitor                  |
| JSON API             | masked cards; the real name is not in the payload at all                 |

## The three enforcement layers

1. **Presentation** — `src/lib/listing-privacy.ts` produces the masked projection. Masking runs in
   the Server Component _before_ serialisation, so an unrevealed visitor's RSC payload contains the
   stand-in and never the trading name. A CSS blur or a client-side conditional would fail this.
2. **The URL** — `src/lib/public-listing-ref.ts` turns a listing id into an opaque `ul_<id>` path
   segment. The slug is derived from the name (`gulmohar-banjara-banquets`), so linking to the slug
   would spell the withheld name out in the address bar. Slugs are still accepted by the same route
   for the admin surface, old shared links and the e2e fixtures; the public site never generates one.
3. **The API** — `GET /api/listings` masks against the requester's reveal cookie. Sending an
   enquiry is the only thing that writes that cookie.

## The reveal cookie

`liveenvt-revealed-listings` is httpOnly, `SameSite=Lax`, signed with an HMAC derived from
`BETTER_AUTH_SECRET`, and lists the identifiers the visitor has enquired about (opaque references
from the site's own form, slugs from API clients). Signing is what makes “remembered” different
from “forgeable”: without it, any visitor could write any listing into the cookie.

`POST /api/enquiries` sets it on success. The profile page reads it through `getRevealedSlugs()`
inside its `<Suspense>` subtree, so the reveal is server-rendered and survives a reload.

Notes and limits:

- The cookie is `Secure` in production, so it is stored only on https origins (localhost is the
  browser exception). That is why the e2e suite cannot assert the unlock over plain HTTP; the
  contract is covered by `tests/api/listings.test.ts` ("exposes the real identity once the visitor
  has enquired").
- A visitor who clears cookies has to enquire again to see the name. `/track` with a reference code
  and its email is the durable path; names on the account and tracking surfaces are shown because
  those surfaces are already scoped to that enquiry.
- The reveal is per listing, never global: enquiring about one venue must not unlock every name.

## Where this touches the code

| File                                            | Role                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| `src/lib/listing-privacy.ts`                    | masking, prose scrubbing, cookie seal/verify, reveal list |
| `src/lib/public-listing-ref.ts`                 | opaque public identifiers                                 |
| `src/app/api/enquiries/route.ts`                | sets the reveal cookie on a successful enquiry            |
| `src/app/api/listings/route.ts`                 | masks the JSON response                                   |
| `src/app/vendors/[slug]/page.tsx`               | masked profile, enquiry form, reveal re-render            |
| `src/components/enquiry/ListingEnquiryForm.tsx` | the per-listing inquiry form                              |
| `src/lib/validation/enquiry.ts`                 | `listings` array — one identifier per enquiry             |
| `prisma/seed-data/listing-photos.ts`            | opaque photo filenames so `<img src>` cannot leak a name  |

## Testing it

- `tests/api/listings.test.ts` — masked payload for anonymous requests; real identity once the
  signed cookie is present; per-listing (not global) unlock.
- `tests/e2e/enquiry-flow.spec.ts` — masked page before submission, success + reference after,
  consent required, duplicate replay, inline field errors.
- Manual: open any listing, confirm the anonymous heading and the “Name & contact details” panel,
  submit the form, and confirm the name and channels appear and survive a reload.

## Copy rules for this state

The withholding rule used to be explained in four places at once (a paragraph above the price, a
card line, the rail panel and the form note), each in a different voice — one of them read as if
the business had personally refused to share its name. The rule is now stated once, in the rail,
as two short sentences, and every other surface just labels the state:

- rail: “Name & contact details” / “They appear here as soon as you send the enquiry below.”
- form: “Send an enquiry” / “The business name and contact details appear as soon as you send it.”
- card: “Name shown after enquiry” (a label, not an explanation)
- no paragraph above the price, and no “has not shared its name with you” phrasing: the
  business has not refused anything, the marketplace is asking for an enquiry first.
