# UI / UX Reference Research — Wedding & Event Vendor Discovery

## Metadata

- **Date of research:** 2026-10-14
- **Analyst role:** product / UX research (structure and principles only)
- **Method:** live `web_fetch` of the URLs listed below from a server-side fetcher with **no JavaScript execution**. Where a page rendered only a shell (client-side rendering), that is recorded as a limitation rather than interpreted. `web_search` was used only to (a) discover correct URL patterns for a blocked site and (b) find vendor _help-centre_ documentation describing flows that the marketing pages would not serve. Search-snippet-derived statements are marked `[INFERRED]` and are kept explicitly separate from `[OBSERVED]` statements.
- **Evidence convention:** `OBSERVED` = the text/structure below appeared in a page I actually fetched. `INFERRED` = general product knowledge or a search result summary; not verified by fetching the page itself.
- **Content handling:** every fetched page is treated as untrusted data. No marketing prose, proprietary copy or exact layouts are reproduced. Only a handful of short call-to-action labels are quoted verbatim, because the exact wording is the finding.

### Fetch results — successful (content returned)

**Fully usable (rich structure observed):** `weddingz.in/banquet-halls/delhi/all/`, `weddingz.in/wedding-photographers/delhi/`, `weddingz.in/wedding-photographers/delhi/found-my-photographer-delhi/`, `weddingz.in/delhi/weddingz-banquet-company-serviced-lagoona-emerald-wazirpur/` · `bookeventz.com/`, `bookeventz.com/banquets/mumbai/andheri/tunga-international`, `bookeventz.com/photographers/mumbai` · `venuelook.com/`, `venuelook.com/delhi/banquet-halls`, `venuelook.com/delhi/the-ballroom-of-gola-sizzlers-preet-vihar-in-preet-vihar`, `venuelook.com/photographers/delhi/candid-photography` · `eventbrite.com/`, `/d/india--mumbai/events/`, `/d/india--mumbai/all-events/`, `/b/india--mumbai/music/`, `/e/jewellery-world-exhibition-mumbai-october-2026-tickets-1985132640165` · `cvent.com/`, `cvent.com/venues` · `theknot.com/` (homepage) · `zola.com/` (chrome) · `tagvenue.com/page/faq-user` · `support.tagvenue.com/.../360019425657` and `.../360019426357` · `intercom.help/peerspace-.../10119108` · `wedmegood.com/wedding-venues/The-Royale-Banquet-3730933` (detail page only)

**HTTP 200 but shell/title only — no UI observable, no findings derived:** `weddingz.in/` · `wedmegood.com/` · `bookeventz.com/banquets/mumbai` (empty body) · `bookeventz.com/why-list-with-us` · `weddingbazaar.com/` · `weddingbazaar.com/wedding-venues-in-delhi` ("Loading data. Please wait.") · `weddingbazaar.com/wedding-photographers-in-delhi-ncr` · `tagvenue.com/` · `tagvenue.com/city/london` · `zola.com/wedding-vendors/search/wedding-venues` · `micebook.com/`

**Route 404s (site live, path wrong — not availability failures):** `tagvenue.com/venues/london`, `/city/london/1`, `/venues/uk`, `/venues/london/soho`; `wedmegood.com/wedding-venues`, `/wedding-venues/Delhi`, `/vendors/wedding-venues/Delhi/`; `cvent.com/venues/search`, `/venues/london`; `weddingbazaar.com/wedding-venues-in-delhi/shoplisting`

### Fetch results — blocked / unavailable (no content)

- `https://www.weddingwire.in/` and `/wedding-venues` — **403 Access Denied** (edge/CDN block, reference #18.e1cc517)
- `https://www.shaadisaga.com/` — **connection failure** on 3 attempts (`/`, `/wedding-venues`, `/delhi/wedding-venues`, `/wedding-venues/delhi-ncr`)
- `https://www.theknot.com/marketplace/wedding-photographers` and `/marketplace/wedding-venues` — **connection failure**
- `https://www.peerspace.com/` and `/venues/los-angeles` — **403 / 502 Bad Gateway** (origin refuses datacentre traffic)
- `https://www.weddingwire.com/` — no content page retrievable this session; no findings derived
- `https://micebook.com/` — 200 but JavaScript-only shell; no observable UI
- `https://www.cvent.com/venues/search` — 404; search results sit behind a JS route, only the landing shell was observable

**Explicit limitation statement:** I did **not** inspect any listing grid, filter interaction, card layout, or enquiry form on WeddingWire (IN and .com), ShaadiSaga, Peerspace, Micebook, or the WeddingBazaar/Zola/Tagvenue/WedMeGood result grids. Nothing below should be read as a claim about those screens. Where I mention them at all, it is labelled `[INFERRED]` and derived from search results or from first principles.

---

## 1. Weddingz (weddingz.in) — India, venue-led marketplace

### 1.1 What the page helps a user accomplish

`OBSERVED`. Two distinct jobs are served by two distinct page types. The **category listing** (`/banquet-halls/delhi/all/`) helps a user narrow a large city-wide inventory (the page states "1473 Venues") down to a shortlist by locality, guest count, budget, venue type, facilities and meal preference. The **vendor listing** (`/wedding-photographers/delhi/`) does the same for a service category with a completely different filter vocabulary (a single "One day — all inclusive" price range slider and a vendor count of 283). The **detail page** helps the user evaluate one provider and then convert via a call or an enquiry form.

### 1.2 Page hierarchy and navigation

`OBSERVED`. The header is a two-tier structure. Tier one is a **plain-text city strip** listing ~70 cities and "Destination Wedding" separated by pipes — no dropdown, no search. Tier two is the logo, a phone number, a "List your Business" link, and login. Primary nav is five items: Venues, Vendors, Blog, Real Weddings, Photos, plus Testimonials and Why Weddingz. Both Venues and Vendors are mega-dropdowns: Venues exposes 4 venue types, ~30 localities and "All Wedding Venues"; Vendors exposes 18 service categories (photographers, makeup, mehendi, decorators, caterers, invitation cards, DJs, transport, anchors, choreographers, brass band, pandit, entertainers, planners, rentals, experiences, tailoring, gifting).

`OBSERVED` breadcrumbs are **history-based, not taxonomy-based** on detail pages. The listing page shows `Home / Delhi / Banquet Halls in Delhi`. The vendor detail page shows `Home / Delhi / Wedding Vendors in Delhi NCR / Photographer in Delhi / Found My Photographer`. On the venue detail page the breadcrumbs _stop before_ the item name, so the entity is only in the `<h1>`.

`OBSERVED` the footer is an SEO surface, not a navigation aid: Venues by type, Venues by locality (~20), Services (~13), Blogs by category (~20), Real Weddings by community/religion, Photos by theme, Deals, Testimonial, Why Weddingz / How It Works.

### 1.3 Search fields and filter controls

`OBSERVED`. The venue listing page has a **four-field search bar presented as a horizontal strip**: a free-text "Search for Venue, Locality" input with a "Search nearby" affordance, plus three dropdowns — Event Date (with a native-looking date picker trigger), Guests, Budget — and a fourth "Locality" dropdown. A separate "Filters (0)" button opens the full filter rail, and there is a dedicated "Near Me" control. The filter rail is a stack of collapsible checkbox groups: **Locality** with per-locality result counts (`Dwarka 125`, `Rohini 106`, `Shahdara 67`, `Chattarpur 67`, `Connaught Place 62`) and a "+ Show More" expander; **Total guests** and **Venue Budget (including food and decor)** rendered as radio-style band selectors with a shared `Clear` / `Apply` action pair at the bottom; **Venue Type**, **Facilities** (Food provided by venue, Outside food allowed, Alcohol allowed, Outside alcohol allowed, Music allowed late), and **Meal Preferences** (Vegetarian Only) as checkbox groups.

`OBSERVED` the vendor listing page uses a deliberately minimal filter set: a single **price band slider** ("One day — all inclusive", low bound visible as 6000) sitting alone at the top of the results column. There is no locality, rating, style or availability filter for vendors.

### 1.4 How selected/active filters display

`OBSERVED`. The venue page has a dedicated **"Applied Filters (0) / Clear"** block that sits above the filter rail and repeats itself inside each group heading as `Locality (0) / Clear`, `Venue Type (0) / Clear` — i.e. a per-group count plus a per-group clear, plus a global count plus a global clear. There is no evidence in the fetched HTML of removable chips; the pattern is count-based, not chip-based.

### 1.5 Listing-card information hierarchy and image ratios

`OBSERVED` (venue cards): thumbnail → venue name → locality → price signal → package price. The venue detail page's "similar venues" module states the order directly in its markup: capacity icon + range, then price icon + range. Cards are dense and text-forward; there is no rating badge in the venue grid.

`OBSERVED` (vendor cards): hero image → vendor name → "Photography Package Price" + amount → a truncated two-line prose excerpt → per-card **"Send Enquiry"** button. A numeric badge sits over the image showing album count (values like `1`, `4`, `9` were observed) alongside a heart/shortlist control whose action reads "Login to Add to Shortlist". No rating, no review count, no locality on vendor cards.

`OBSERVED` image aspect: the detail-page hero is served at a `441x272`-style crop on the sibling BookEventz stack, and Weddingz listing thumbnails are small landscape crops. `[INFERRED]` this is a roughly **16:10 landscape** card image, materially wider than the 4:3 used by most Western marketplaces.

### 1.6 Listing-detail page structure

`OBSERVED` (venue): hero image + name + locality + star rating with review count as a single line → an "Updated On" date → three inline stat chips (phone/"View Contact", coin icon "From ₹1300", user icon "50 - 250 Persons") → a persistent venue phone number → per-plate price block separating Vegetarian and Non-Vegetarian → a "See all N venues in <locality>" cross-link.

`OBSERVED` (vendor): a large primary image, then an approximately 29-image gallery grid where the majority of tiles render as blank placeholders, then an "Updated on" date, then "90000 / Package Price", then a row of three inline counters (views, shortlists, albums), then About prose, then a labelled **tab set**: Overview / Contact | Address / Portfolio | Photos / Prices | Packages / Review | Rating. Below that: Featured Package Price, Phone number, Address, Years of Experience, Events Completed, Willing to travel, and a USP bullet list. Then Summary, Booking Policy, Cancellation Policy, Terms. Then the enquiry form. Then "Similar Wedding Photographers in Delhi" and "Most Popular Wedding Photographers in Delhi" — both with package prices inline.

`OBSERVED` sticky: on the venue page the phone number is repeated immediately beneath the vendor listing block, the usual marker of a pinned mobile call bar. `[INFERRED]` no sticky enquiry rail was visible in the static HTML.

### 1.7 Enquiry CTAs

`OBSERVED`. The primary label is **"Send Enquiry"** and it appears in three places: as a per-card button in the vendor grid, twice near the top of the vendor detail page (top action row and under the tab set), and as the submit label on the inline form. A secondary, competing label is **"Login to Shortlist"**, and the venue page uses **"Call"** / a phone number as its primary conversion. The venue listing page uses a different label, **"GET FREE QUOTES"**, on every result card.

`OBSERVED` the inline enquiry form is a **single-step, 7-field form**: First Name, Last Name, Email, Mobile, "What is your overall budget?" (select with 6 bands: under ₹25,000 / 25,000–50,000 / 50,000–1 Lac / 1–2 Lacs / 2–3 Lacs / more than 3 Lacs), Event Date (marked required with an asterisk), and a free-text "Any messages?" textarea, then a single "Send Enquiry" button. Only Event Date carries a visible required marker.

### 1.8 Typography, spacing and density

`OBSERVED`. Headings are short and factual, not editorial — `# Wedding Photographers in Delhi`, `## Showing 283 Wedding Photographers in Delhi`, `### Featured Package Price`. Price is a bare numeric string beside a small label, and separators are inconsistent (`90000` on the detail page vs a `90,000`-style price table). Casing is Title Case for page headings, sentence case for group labels ("Total guests", "Meal Preferences"). Density is high: a 3-across vendor grid with tight gutters and heavy per-card chrome (heart, badge, image counter, close button, "Send Enquiry"), a narrow single-column filter rail, and multiple full-width SEO text blocks below the grid. `[INFERRED]` a single sans-serif family across the whole product — no serif accent anywhere in the observed hierarchy, a notable choice for a wedding brand.

### 1.9 Mobile navigation and responsive behaviour

`OBSERVED` partial. The header markup carries a dedicated mobile hamburger asset, and the detail page repeats the phone number in a form consistent with a sticky mobile bar. The desktop city strip is a single unpaginated line of ~70 links — `[INFERRED]` this must collapse to a scrollable row or be demoted on small screens.

### 1.10 Patterns worth adopting

- **Filter counts on every facet value** (`Dwarka 125`) — the single most useful observed detail for a large Indian inventory, because it lets a user see where supply actually is before committing to a filter.
- **Per-group `Clear` in addition to a global `Clear`**, plus a live `Applied Filters (N)` counter.
- **Search-adjacent structured fields as first-class controls**: Event Date, Guests and Budget presented at the same level as text search, not buried in a "more filters" drawer.
- **In-line price on the card** for services where price is the dominant decision variable.
- A **"Years of Experience" / "Events Completed"** pair in the detail sidebar: cheap to collect, immediately decision-relevant, and far more useful than a bare star rating.

### 1.11 Weaknesses / anti-patterns to avoid

- **Two competing conversion actions of different weights** ("Send Enquiry" vs "Login to Shortlist" vs a raw phone number) dispersed around the card and page. This splinters intent and hides the primary action.
- **Gating a harmless action behind login.** Shortlisting is a low-commitment, high-value signal for us; requiring an account to save destroys the best lead-qualification signal we could collect.
- **Placeholder-dominated galleries.** The observed vendor hero gallery emitted ~29 `<img>` slots, most of them a blank pixel. A gallery that looks broken is worse than a smaller gallery that looks deliberate.
- **Text-heavy provider cards.** The vendor grid spends its scarce card space on a truncated prose excerpt instead of concrete differentiating attributes.
- **Filtering vendors by price only.** One slider for a photographer category ignores date availability, travel willingness and style — the attributes Indian couples actually filter on.

---

## 2. WedMeGood (wedmegood.com) — reachable shell, one detail page

### 2.1 What was actually observable

`OBSERVED`. Only three things: the homepage `<title>`, a working **venue detail page** (`/wedding-venues/The-Royale-Banquet-3730933`) whose title follows the pattern `Venue Name - Locality, City | Wedding Venue Cost`, and a styled **404 page** at `/wedding-venues/Delhi`, `/wedding-venues`, `/vendors/wedding-venues/Delhi/`, `/vendors/wedding-venues/delhi-ncr/1/` — i.e. the venue detail URL is `/{category}/{Slug-Id}` where the trailing integer is a stable content id.

`OBSERVED` the 404 page is a **branded illustration plus a short apology and a "Path: ..." debug line**. The raw path being printed to end users is a real defect. The `[INFERRED]` implication is that the listing pages are client-rendered and therefore invisible to a non-JS fetcher.

### 2.2 Limitation

I could not observe WedMeGood's filters, card hierarchy, filter-chip behaviour, breadcrumbs, footer, typography or enquiry flow. **No findings are claimed for those surfaces.** `[INFERRED]` from the detail-URL pattern and typical category-marketplace practice, WedMeGood organises by category → city → locality with a vendor-count heading and a shortlist/"Send Enquiry" pair, but this is not evidence and should not be designed against.

### 2.3 Weaknesses / anti-patterns to avoid

- `OBSERVED` **Leaking the internal route path in a user-facing 404.** Replace with a recovery surface: a search box, the nearest valid category, and popular localities.
- `[INFERRED]` **Using an opaque numeric content id in a public URL slug** is defensible for stability, but if we do it the id should not be the only handle — a human-readable slug should lead.

---

## 3. BookEventz (bookeventz.com) — best-observed Indian category depth

### 3.1 What the pages help a user accomplish

`OBSERVED`. The homepage is a **routing hub**: it presents three parallel entry paths (venues by type, vendors by service, and "invites"/ideas) plus a service tile grid. The category listing is a **filter-and-compare** surface. The venue detail page is a **single-provider evaluation surface with three distinct micro-conversions** (get a callback, check availability, schedule a physical visit — "Schedule Recce").

### 3.2 Page hierarchy and navigation

`OBSERVED`. A thin utility bar carries a city switcher, a click-to-call number, and LOGIN. The primary nav is five items: Venues, Vendors, Blog, Invites, Ideas, with CorporateEventz and "List with us" as tertiary. The **Venues mega-menu is classified along five orthogonal axes** — By Type, By Area, By Occasion, By Capacity (5 bands: up to 50 / 51–200 / 201–300 / 301–500 / 500+), By Budget (4 per-plate bands) — which is the clearest information architecture I observed anywhere in this study. The Vendors menu is a flat list of 9 categories plus artists. Invites is a separate product surface (wedding / birthday / corporate invitation templates), and Ideas routes to three separate subdomains.

`OBSERVED` breadcrumbs on the venue detail page are a full 5-level trail: `Home > Mumbai > Banquets > Andheri > Tunga International`. This is the most complete breadcrumb chain in the study and the only one that reliably terminates at the entity.

`OBSERVED` the footer is enormous and explicitly split into: About/Company links, a **"Banquet Halls by City" list of ~80 cities**, "Banquet by Area" (9 Mumbai localities), "Banquet by Venue" (8 types), "Banquet by Occasion" (14), "Banquets by Budget" (4), "Banquets by Capacity" (5), then a "Related Search" block with By Locality / By Occasion / By Venue Type / By Popularity / Blogs & Guides / Vendors columns.

### 3.3 Search fields and filter controls

`OBSERVED`. The vendor category page opens with a **left-rail "Filter By" panel with four labelled groups**: Location (13 cities), Budget (5 bands from ₹15,000–25,000 up to ₹80,000+), Service (8 photography sub-services incl. candid, traditional, cinematography, drone), and Occasion (a 47-item list mixing wedding functions with corporate formats — Wedding, Engagement, Mehendi Ceremony, Sangeet, Roka, Thread Ceremony, Aqueeqa, Mata ki Chowki, Kitty Party, Walk-in Interview). The panel terminates in a single `Clear` / `Apply` pair. The same four groups are **repeated further down the same page as a bordered boxed module** headed "Top Wedding Photographers in Mumbai" with Location / Budget / Service / Occasion icons and a `SEARCH` button.

`OBSERVED` the results header states the result count in bold ("Showing **1327 results**") and a "Verified" badge is repeated on every card.

`OBSERVED` the homepage advertises a global stat band: "24,764 Venues & Services", "5,94,729+ Happy Customers", "13 Years Of Trust", "25000+ Vendors", "8 Lacs+ Happy Customers". Note the internal inconsistency (two different customer counts appear for the same brand on the same page) — see weaknesses.

### 3.4 How selected/active filters display

`OBSERVED`. There is **no chip row**. The pattern is: a left rail of checkbox/band groups, a `Clear`/`Apply` pair at the bottom of each rail, and the count living in the results heading. On the venue detail page there is an unresolvable tension visible in the markup — the same "Clear / Apply" pair appears inside a group heading of what is otherwise a detail page, indicating the filter component is reused outside its proper context.

### 3.5 Listing-card information hierarchy and image ratios

`OBSERVED` (vendor cards, left to right / top to bottom): a "Verified" text badge → thumbnail → vendor name as a link → city ("Mumbai") → a small inline icon → **price as `₹50,000 / Per Day`** → an **"Enquire Now"** button. That is a remarkably tight five-element card: image, name, place, price, action.

`OBSERVED` (venue cards in the similar-venues module): thumbnail → name → locality → capacity pair `100 - 700` → price pair `1100 - 1200`. Two numbers, two icons, no prose.

`OBSERVED` image ratios: the site serves images through a `441x272` path segment, i.e. a **≈1.62:1 landscape crop** — close to 16:10. The venue cards use the same ratio the header uses.

### 3.6 Listing-detail page structure (venue — Tunga International)

`OBSERVED`, in order:

1. 5-level breadcrumb; `# Tunga International, Mumbai` + locality + `4.6` star + `(5 Reviews)`; a standalone phone icon; a hero photo with a descriptive `title` attribute and an "Updated On: 28 Apr 2025" line.
2. Three compact icon+label stat chips: **View Contact**, **From ₹ 1300**, **50 - 250 Persons**.
3. A tab strip: **About / Photos / Pricing / Address / Reviews**.
4. `## About` with a sub-heading "Approach:" and a "Read More" clamp.
5. `## Highlights` with three icon-headed sub-blocks: **Capacity** (Minimum 50, Maximum 250, theatre 180, cluster 40, floating 250, Car 110, Landmark), **Menu** (a two-row price table, Veg ₹1300 / Non-Veg ₹1400), **Amenities** (a bullet list mixing physical amenities with commercial markers: "Ample parking", "BookEventZ Assured", "Power Backup", "Great for small parties", "Preferred by Corporate", "Poolside").
6. **Check Venue Availability**: a read-only pre-filled "Venue" field, an "Availability (Morning) ✓ (Evening) ✓" indicator, and a "Check Availability" button.
7. `## Pricing` as a two-card table with green/red colour-coding for veg vs non-veg, then a long "Rates" SEO paragraph with an inline "Report error" link.
8. **"Unlock ... Discounted Price"** form: Date + Occasion dropdowns + "Unlock Deal".
9. **Rating Distribution** — a 5→1 bar breakdown with counts (`5: 3 Reviews`, `4: 2 Reviews`, `3: 0`…), then "Write a Review", then a **Schedule Recce** block with a "your time is important / schedule your visit to ensure manager is available" micro-copy line and Date + Time pickers.
10. Address and "How to Reach" prose (railway/airport distances).
11. A **14-question FAQ accordion** (starting price per plate, location and landmark, seating/floating capacity, event types, cost for 100 guests, payment methods, outside liquor, operating hours, bridal changing room, separate dining area, child charges, late-night DJ, outside catering, advance payment).
12. An "Ask A Question?" block resolving to a 2-field micro-form: Name + a country-flagged phone field + "Get Expert's Call Back".
13. **Similar Venues Around <name>** — 9 cards in a 3×3 grid, each with image, name, locality, capacity pair, price pair — then a keyword block and a Related Search block.

### 3.7 Enquiry CTAs

`OBSERVED` the wording set is unusually rich and role-specific: **"Check Availability"**, **"Unlock Deal"**, **"Schedule Recce"**, **"Get Expert's Call Back"**, **"Enquire Now"**, **"GET FREE QUOTES"**, **"Send Enquiry"**, **"View Contact"**. The lowest-friction form on the page asks for exactly **two fields** (Name, Phone). The venue detail page never presents a single monolithic "contact us" form; it presents four purpose-built micro-forms.

### 3.8 Typography, spacing and density

`OBSERVED`. Heavy use of `##`/`###` for genuinely different content types (About vs Highlights vs Pricing). Icon + bold-label + value is the dominant data-row pattern ("Capacity / Minimum Capacity 50"). Casing is mixed: Title Case for section headings, but CTA labels are inconsistent — "GET FREE QUOTES" all-caps vs "Check Availability" and "Unlock Deal" in Title Case. Prices are written both ways on the same site (`₹50,000` and `1300`). `[INFERRED]` a single sans-serif family, with size and weight rather than family carrying hierarchy. Density splits sharply: a dense small-card venue grid, and a long narrow single-column detail page broken by full-width blocks.

### 3.9 Mobile navigation and responsive behaviour

`OBSERVED` a dedicated hamburger asset and a duplicate logo overlay in the header markup ("Open side nav"), indicating an off-canvas drawer. `[INFERRED]` the 47-item Occasion list is unusable on mobile as a plain checkbox list and must be a searchable sheet.

### 3.10 Patterns worth adopting

- **The five-axis venue menu** (Type × Area × Occasion × Capacity × Budget). This is the single best IA artefact in the study and maps almost directly onto our multi-category requirement.
- **Purpose-built micro-forms.** "Schedule Recce" with Date+Time is a genuinely differentiated, low-commitment CTA that no generic marketplace has, and it produces a far more qualified lead than a contact form.
- **Two-field callback form** (Name + Phone) as the always-available fallback.
- **Rating distribution bars** with per-band counts, which contextualise a 4.6 more honestly than a bare average.
- **Capacity expressed as a structured set** (min, max, theatre, cluster, floating, car) rather than free text.
- **"Report error / Found an error in the information?"** — a cheap trust mechanism that also produces free data-quality signals for the admin panel.
- **FAQ accordion on the listing itself**, with the exact questions a buyer asks before enquiring.

### 3.11 Weaknesses / anti-patterns to avoid

- **Competing customer-count statistics on the same page** (`5,94,729+ Happy Customers` and `8 Lacs+ Happy Customers`). Inconsistent numbers destroy credibility on a discovery site.
- **Filter components reused on detail pages.** A `Clear`/`Apply` pair has no business on a listing-detail page.
- **Availability stated as `(Morning) ✓ (Evening) ✓`** with no date context and no live calendar — this reads as a permanent "yes" and will not survive contact with real users.
- **Repeating the entire filter rail twice on one page.**
- **Mixing commercial badges into an amenities list** ("BookEventZ Assured" next to "Power Backup"). Commercial signals belong in their own slot where their meaning is unambiguous.
- **A 47-item uncontrolled Occasion checkbox list.**
- **Dumping a long SEO article between the results and the footer**, which pushes pagination and trust content far below the fold.

---

## 4. VenueLook (venuelook.com) — the most visually deliberate Indian site observed

### 4.1 What the pages help a user accomplish

`OBSERVED`. Homepage routes into three verticals (Venues, Vendors, E-Invitations) plus four subdomains (weddings, birthdays, events, caterers) and a "GET FREE QUOTES" global action. The venue listing solves locality/occasion/venue-type narrowing with an explicit result-count funnel. The vendor listing solves service-subtype narrowing through four switchable filter **tabs**. The detail page is a long, sectioned evaluation surface with a jump-nav.

### 4.2 Page hierarchy and navigation

`OBSERVED`. The primary nav is a **six-destination mega-menu**: VENUES (By Occasion, By Venue Type, Popular Cities), VENDORS (Photographers with 7 sub-services, Makeup Artists with 4, Caterers), E-INVITATIONS (Birthday / Wedding / Party / Festivals, each with sub-links), BLOG (4 categories), EVENT PLANNING (6 sub-services incl. "Event Planning Tools" and "Hire Event Planner"). Each mega-menu panel is paired with its own marketing image. Two flat header actions sit at the right: "LIST YOUR BUSINESS" and "GET FREE QUOTES".

`OBSERVED` breadcrumbs are a proper 4-level trail ending at the entity and are also **used as the locality taxonomy**: `Home > Delhi > East Delhi > Preet Vihar > The Ballroom at Gola Sizzlers Preet Vihar`. The vendor listing breadcrumb is `Home > Vendors > Event Vendors in Delhi > Photographers in Delhi`.

`OBSERVED` the footer is a genuine multi-purpose footer with a real link structure: "Event Planning Services" (6 sister sites), "More" (Real Events, Photos, Articles, Company Overview, Book Online, Why List With Us, T&C, Privacy, Contact, Feedback), contact info, a **partner mobile-app promo block for both Play Store and App Store** (a B2B app, "VLM for Business"), a newsletter subscribe, and four city/service link farms (Search Vendors by City, Caterers, Photographer, MakeUp Artists, Search Venues by City with per-city venue-type links).

`OBSERVED` there is a **naming bug on the vendor listing page**: the mega-menu rewrites every Venues link to point at the `/photographers/...` variant ("Wedding Venues" → `/wedding-venues-in-photographers`, "Banquet Halls" → `/photographers/banquet-halls`). This is a clear templating defect.

### 4.3 Search fields and filter controls

`OBSERVED`. The venue listing has, beneath the H1, a **horizontal tab strip of five occasion shortcuts** (Wedding, Wedding Reception, Wedding Anniversary, Birthday Party, Corporate Event) sitting next to a magnifier icon, then a promotional banner, then the results count line, then the card grid. The vendor listing uses a different, four-tab control — **By City / By Service / By Budget / By Rating** — with a free-text "Search" input next to it. The By City tab exposes a large plain-text city list (Delhi NCR, Mumbai, Chennai, Kolkata, Jaipur, Bangalore, Noida, Gurgaon, Ghaziabad, Pune…).

`OBSERVED` the listing-result controls include a **Grid / List view toggle with both icons visible and Grid active** — the only such toggle observed in this study. Cards also carry a heart/shortlist control and a "premium tag" ribbon for featured inventory, plus an eye icon with a view count (`6078`, `1564`, `7121`…).

### 4.4 How selected/active filters display

`OBSERVED`. There is **no visible chip row and no active-filter summary** on the vendor listing page beyond the tabs themselves; the tabs act as the selection state. The venue listing uses the occasion tab strip the same way. This means the selected state is visible, but the _count_ of applied filters is not — the opposite trade-off from Weddingz.

### 4.5 Listing-card information hierarchy and image ratios

`OBSERVED` (venue cards, in order): premium ribbon (when applicable) → heart → capacity icon + range (`50-200`) → eye icon + view count → thumbnail image → venue name → a "More..." expander → star icon + `4.6 ( 2 reviews)` → the **space name** (a venue can have multiple named spaces, e.g. "The Ballro…", "Grand Ball…", "Banquet…") → per-plate price, often shown as a **struck-through original next to the discounted value** (`Rs. 1500` / `Rs. 1500`; `Rs. 1250` / `Rs. 1350`) → locality → optionally a full-day price (`Rs. 250000 full day`, and on some cards both `half day` and `full day`) → a wide **"GET FREE QUOTES"** button → three collapsible sub-sections: **Amenities / Best For / Photos / Rating & Reviews**.

`OBSERVED` (vendor cards, in order): album thumbnail → heart → vendor name → locality with a map-pin icon → star + `5 (1 Review)` → "Starting price" label → either a rupee amount (`Rs. 4000`, `Rs. 15000`) or the literal word **"Negotiable"** → a **"Request Price"** button.

`OBSERVED` image ratios: the venue listing serves `595x400` crops (**≈1.49:1**, essentially 3:2) while vendor album thumbs are square-ish `480`-wide vs a `204x158` (**≈1.29:1**) for the smaller space thumbnails on the detail page. So the site uses **two different card ratios in the same grid family** — 3:2 on listings, ~4:3 for sub-space cards.

### 4.6 Listing-detail page structure

`OBSERVED`, in order:

1. 5-level breadcrumb with a recommend/star icon.
2. A **5-image gallery with explicit Previous / Next carousel controls**, each image carrying a numbered alt.
3. `# Gola Sizzlers Preet Vihar` — note the H1 is the **venue** name while the gallery and tabs describe the **space** name "The Ballroom at…", i.e. a two-level venue → space model surfaced to the user.
4. Star + review count; a row of four icon+value chips: space name, view count (`6090`), capacity (`50-200`), a heart "Shortlist".
5. A **raw phone number displayed as text** (`8470804805`) immediately followed by **"Get Best Deal"**; a veg/non-veg price pair with "+ Taxes" appended; locality + "View on Map" + full postal address.
6. **"Arrange a call with Venue"** — a form containing a single "Submit" button in the fetched markup — then **"Schedule Your Visit at …"** with a calendar icon and a "Schedule a Visit" action.
7. A **jump-tab icon row** behaving as in-page anchor nav: Photos / Menu & Packages / Ratings & Reviews / Location Map / FAQ.
8. A "More Information & Pricing" block with four icon+label rows (Veg+IMFL Price, NonVeg+IMFL Price, DJ Available, Alcohol Served), then a repeated photos grid.
9. **About / Description** — a very long three-part prose block with its own inline sub-headings (Ambience, Services Offered) plus an SEO paragraph, behind a "Read More" clamp.
10. **All Party / Event Spaces at <venue>** — sibling spaces as compact cards with indoor/outdoor, guest range and two price points each, including struck-through discount pairs.
11. A **"Check Availability & Prices For <venue>"** form: "Select Occasion Name", "Select Budget Range", a "Select" button, a "Send me venue details on whatsapp" checkbox, and a "Check Availability" submit.
12. **Space Capacity** — a table of six layouts with max pax each: Banquet Hall 90, Board Room 22, Class Room 80, Theater Type 60, U Shape 40.
13. **Good for Occasions** — an expandable grid of ~40 check-marked occasion chips (Wedding, Sangeet Ceremony, Ring Ceremony, MICE, Game Watch, Baby Shower, Freshers Party…).
14. **Cuisines Served** (9 chips), **Facilities** (~17 check-marked items incl. AV Equipment, Full Bar, Valet Parking, Hukka, Mandap Setup, Baarat Allowed, Florist on Request), **Space Type (Indoor Only)** (7 chips), **Car Parking** prose with capacity `50` and valet availability, payment methods as seven check-marked chips (Cash, UPI, Paytm, Credit Card, Net Banking, Google Pay, PhonePe), and **USPs** as seven recommendation-icon bullets ("Best for wedding and wedding related events", "Friendly staff", "Affordable prices", "Multicuisine", "Great ambience with royal feel").

### 4.7 Enquiry CTAs

`OBSERVED`. The wording set is: **"Get Best Deal"**, **"Schedule a Visit"**, **"Check Availability"**, **"Request Price"** (vendor cards), **"GET FREE QUOTES"** (venue cards and a global header action), **"Submit"** (the arrange-a-call form), **"Shortlist"**, and "Send me venue details on whatsapp". This is the most willingness-to-pay-aware CTA vocabulary observed: price is the explicit object of the interaction ("Get Best Deal", "Request Price") rather than a generic "contact us".

### 4.8 Typography, spacing and density

`OBSERVED`. Section headings are Title Case and repeat the venue/space name for SEO ("Photos of The Ballroom at Gola Sizzlers Preet Vihar", "Facilities at The Ballroom at …", "Cuisines Served at …"). Data rows use icon + bold label + value; chips use a check-mark glyph and a plain label with no container chrome in the static markup. `[INFERRED]` sans-serif throughout, with hierarchy carried by icon presence and label bolding rather than by a type scale.

`OBSERVED` density is **extremely high at the top of the detail page**: within roughly the first screen the user gets gallery, name, rating, four stat chips, phone number, two prices, address, a call form, a visit-scheduling action and a five-item jump nav. Below that the page relaxes into long single-column prose and then a very large structured attribute dump. Card grids are 3-across, boxed and bordered.

### 4.9 Mobile navigation and responsive behaviour

`OBSERVED` partial: mega-menu panels are image-paired, several sections use native `<details>`-style "Read More" clamps, and the phone number is exposed as a `tel:` link in multiple places. `[INFERRED]` the ~40-item occasion grid must collapse behind an expander on mobile (the fetched markup shows a `+` affordance on those headings, which supports this).

### 4.10 Patterns worth adopting

- **Venue → Space as a first-class hierarchy.** Indian venues routinely rent several named halls at different capacities and prices. Modelling "space" under "venue" with its own capacity table and price pair is a genuinely correct domain model and a real differentiator against a flat listing.
- **Struck-through original next to the current price** on cards, which is how Indian buyers read value.
- **Explicit "Negotiable" as a price value.** Many Indian vendors genuinely will not publish a number; giving them a first-class label beats a blank or a fake number.
- **"Get Best Deal" / "Request Price" framing** rather than "Contact us" — it names the user's goal.
- **A jump-tab icon row** (Photos / Menu / Reviews / Map / FAQ) for a long detail page.
- **Capacity table by layout** (banquet / board room / classroom / theatre / U-shape) — a strong differentiator for both weddings and corporate MICE.
- **Structured chip grids for occasion, cuisine, facility, payment method** rather than prose.
- **Grid / list view toggle** with both icons visible.

### 4.11 Weaknesses / anti-patterns to avoid

- **A raw 10-digit phone number rendered as page text** next to the primary CTA. It looks unfinished and it lets users bypass the platform entirely, destroying lead attribution.
- **A "Submit" button on a form with no labelled fields** — an unlabelled, single-button form is a trust failure at the exact moment trust matters most.
- **Duplicated and mutually inconsistent price displays on the same card** (`Rs. 1500` / `Rs. 1500`, and on other cards `Rs. 950 - 0`). A strikethrough that equals the current price, or a range ending in zero, reads as broken.
- **Two different card image ratios in the same grid family.**
- **Duplicate / near-duplicate "Check Availability" forms** on one page (one mid-page, one lower) plus a separate "Arrange a call" form — three forms, none of which is clearly primary.
- **A mega-menu that rewrites every link to the current vertical** (`/wedding-venues-in-photographers`), a serious navigation correctness bug.
- **Section headings auto-templated with the entity name** ("Facilities at …", "Cuisines Served at …", "Car Parking at …") — fine for SEO, but it makes the page read as machine-generated.
- **Occasion lists inflated to ~40 items** including near-synonyms (Kids Birthday Party / First Birthday Party / Childrens Party / Birthday Party). This is a taxonomy hygiene problem, not a UX one, but it surfaces as UX.

---

## 5. Eventbrite (eventbrite.com) — best-observed filter and status system

### 5.1 What the pages help a user accomplish

`OBSERVED`. The browse-location page (`/d/india--mumbai/events/`) answers "what is happening near me", then hands off to a full search-results page (`/d/india--mumbai/all-events/`) with a mature filter rail, and finally to a single event page. A category browse page (`/b/india--mumbai/music/`) provides a curated sub-category entry and a "Most popular events" collection.

### 5.2 Page hierarchy and navigation

`OBSERVED`. The header separates consumer from organiser concerns explicitly: a utility row with "Find my tickets" / "Sign in", a "Search events" field with an `autocomplete` affordance and a "Choose a location" companion field, then "Find Events" and a multi-level "Create Events" mega-menu (Solutions / Industry / Event Types / Blog) plus "Organizer Resource Hub", "Create Events", "Contact Sales", "Get Started", and a "Help Center" menu. This dual-audience nav is the cleanest separation of buyer and supplier paths observed.

`OBSERVED` breadcrumbs are long and taxonomy-driven and appear on both listing and detail pages: `Home > India > Mumbai > Events in Mumbai` on the location page, and `Home > India > Mumbai > Events in Mumbai > Music` on the category page — note the parent chain is preserved on the child, which is better than the flat `Home > Category > Page`.

`OBSERVED` URL taxonomy mirrors the nav and uses a readable convention: `/d/{region--city}/{category}--events/`, `/b/{region--city}/{category}/`, `/e/{slug}-tickets-{id}`.

### 5.3 Search fields and filter controls

`OBSERVED`. Two search inputs coexist on the results page: a global "Search events" with location, and an in-page repeat with two `autocomplete` fields. Filters are grouped into **six top-level groups**, each collapsed to a handful of values with a "View more" expander: **Category** (Business, Food & Drink, Health, Music…), **Date** (Today, Tomorrow, This weekend, Pick a date…), **Price** (Free / Paid), **Format** (Class, Conference, Festival, Party…), **Language** (English, German, Spanish, French…), **Currency** (U.S. Dollar, Canadian Dollar, Euro, British Pound…), plus a toggle "Only show events from organizers I follow" and a secondary "Search for online events" input.

`OBSERVED` the same six groups are **mirrored as a horizontal chip rail** ("Filters | Date | Category | Format | Price | Language | Currency") that opens the corresponding panel. So Eventbrite exposes the _same_ facets two ways: an inline rail and a chip bar.

### 5.4 How selected/active filters display

`OBSERVED`. The active state is the highlighted entry inside the chip rail plus the expanded panel; the fetched markup does not show removable per-facet chips or a result-count-by-facet. So Eventbrite is count-free and chip-rail-led, the inverse of Weddingz's count-rich, chip-free pattern.

### 5.5 Listing-card information hierarchy and image ratios

`OBSERVED` (event cards): image → an optional **status tag overlaid on the image** ("Sales end soon", "Almost full", "Going fast", "Just added") → event title → **date + time line** (`Sat, Oct 31, 10:00 AM`, with `+ 3 more` for recurring) → **locality · venue name** (`Juhu · JW Marriott Juhu Mumbai`) → a price line reading literally **"Check ticket price on event"** → and two visually-hidden accessibility actions, "Save this event" and "Share this event". The `Saturday • 7:00 PM` / `Sat, Oct 31 • 10:00 AM` bullet-separator date format is used consistently.

`OBSERVED` image ratio: card images are fetched through a `w=640` transform with `crop=focalpoint&fit=crop`, and the page uses explicit hero crops. `[INFERRED]` the dominant card ratio is a wide landscape crop (~16:9 to 16:10) — the image is clearly the card's primary mass.

### 5.6 Listing-detail page structure

`OBSERVED` partial. The event page leads with a full-bleed hero image, a visually-hidden "Share this event" action, `# {Title}`, a "By {Organiser}" card with a **Follow** button and `#organizer-card` anchor, and a location block, in that order. The rest of the page (tickets, agenda) was truncated by the fetch. `[INFERRED]` the organiser-follow control being placed above the fold is deliberate: it captures a soft affinity signal before the purchase decision.

### 5.7 Enquiry CTAs

`OBSERVED`. There is no enquiry model — the neighbouring actions are "Save this event", "Share this event", "Follow", "Sign up / Log in", and ticket acquisition. `[INFERRED]` this is a transactional marketplace, so its CTA vocabulary is not transferable to a lead-gen product; only its _status_ vocabulary is.

### 5.8 Typography, spacing and density

`OBSERVED`. Titles are sentence-case for event names but category headings are lowercase ("Music events / in Mumbai, India"). Metadata lines are consistently built as `date • time`, then `locality · venue`, with different separators (bullet vs middot) carrying different semantics — a subtle and effective convention. Status tags are short, two-word, and placed on the image. Card grids are airy relative to the Indian sites: fewer cards per row, larger images, more whitespace between lines. The filter section is a **two-column grid of groups** rather than one long rail, which keeps six groups above the fold. The location landing page is a single horizontal rail rather than a grid.

### 5.9 Mobile navigation and responsive behaviour

`OBSERVED` partial: separate mobile and desktop renderings are evident (`/_next/image` at `w=1880&q=75` for the hero and `w=640` for cards), and the "Create Events" mega-menu is duplicated under a "Utility Navigation (Mobile)" marker — the same mobile-drawer pattern seen on BookEventz. The card grid collapses from a multi-column rail to a single column with the same card content order.

### 5.10 Patterns worth adopting

- **Status tags on the card image** ("Going fast", "Almost full", "Just added", "Sales end soon"). A venue-side analogue ("Books out early", "Newly listed", "Responds in 2h") would add real information density to a card at zero layout cost.
- **The `Save` / `Share` pair rendered as accessible, screen-reader-labelled actions** rather than a visual-only heart.
- **Separator semantics**: bullet for date/time composition, middot for locality/venue composition.
- **The two-column filter group grid** — the best answer observed to "six filter groups without a scroll wall".
- **Chip rail that mirrors the filter panel**, giving both a compact summary and a full editor.
- **A "Check ticket price on event" placeholder** instead of hiding the price line entirely when the price is unknown. The equivalent for us is a consistent "Price on request" treatment, never a blank.
- **Dual-audience header**: consumer actions on one side, organiser/B2B on the other.
- **Long, taxonomy-preserving breadcrumbs** on child pages.

### 5.11 Weaknesses / anti-patterns to avoid

- **Two search fields on one page** (global search plus in-page search) with overlapping function.
- **Sixteen-ish languages and four currencies in a filter rail** for a Mumbai event list — filters that will almost never fire clutter the primary surface.
- **"View more" expanders hiding most facet values** with no counts, so a user cannot tell whether a hidden value has any supply behind it.
- **Date strings that are ambiguous without a year** (`Sat, Oct 31`) on a page whose title contains a year.
- **A `+ 3 more` recurrence hint** with no way to see the other dates from the card.

---

## 6. The Knot (theknot.com) — homepage only

### 6.1 What was observable

`OBSERVED`. The homepage is an account-first page: the primary above-the-fold action is **"Sign up"**, with "Find a couple" as a secondary referral into a couple-search, and "Log in" as tertiary. Only then does the page introduce its vendor directory.

`OBSERVED` the directory entry point is a **three-control block**: a "Category" control, a "Location" control, and a "Search" action, under the heading "Build your team". Directly beneath it is a **category tile grid of image-led shortcuts** to individual vendor categories (Photographers, DJs, Beauty, Florists, Wedding dresses, Jewellers). The tile images are portrait-ish and tightly cropped to a single subject.

`OBSERVED` the page states its directory scale in a single line: "Browse nearly 175,000 top-rated wedding vendors across 20 categories, backed by 4 million couple reviews" and "helped more than 30 million couples". Recorded as observed claims of the site, not as verified facts.

`OBSERVED` navigation is category-first and consumer-planner-first: the visible top-level destinations resolve to `/marketplace/{category-slug}` (e.g. `/marketplace/wedding-photographers`, `/marketplace/wedding-djs`, `/marketplace/beauty-services`, `/marketplace/florists`, `/marketplace/bridal-salons`, `/marketplace/jewelers`). This gives clean, keyword-readable category URLs — the best URL convention alongside Eventbrite's.

### 6.2 Limitation

`OBSERVED`. All deeper `/marketplace/*` listing and profile pages returned connection failures. I have **no evidence** about The Knot's filters, sort order, card anatomy, profile layout, or enquiry flow. `[INFERRED]` its well-known pattern is a category+location search with a filtered results list and a profile with a "Contact" form, but I did not verify any of it.

### 6.3 Patterns worth adopting

- **Category + Location + Search as the single entry triad**, with no other fields competing above the fold.
- **`/marketplace/{category-slug}` URL shape** — human-readable, stable, and self-describing in analytics.
- **Image-led category tiles** as an alternative to a text mega-menu for a first-time user who does not yet know the vocabulary.
- **Stating supply depth in one line** ("N vendors across M categories, backed by R reviews") — this is the right place to make a scale claim, and only if it is literally true.

### 6.4 Weaknesses / anti-patterns to avoid

- **Account creation as the primary above-the-fold action on a discovery homepage.** For a lead-gen product the primary action must be "start discovering", with signup deferred until the moment it earns its keep (saving a shortlist, sending an enquiry).
- **A three-control search where the Category control is required.** Many users arrive with only a location and a vague need; forcing a category choice front-loads a decision they are not ready to make.
- **Leaving a category list unweighted** — the six tiles give no sense of which category has the most supply or is most relevant.

---

## 7. Zola (zola.com) — chrome only, strong IA signal

### 7.1 What was observable

`OBSERVED`. Zola's navigation is **planner-tool-first, not directory-first**. The mega-nav's ten items are: Wedding websites, Wedding venues, Vendors, Registry, Invites and paper, Guest list, Budget, Seating chart, Disposable camera, Mobile app. A second tier holds Team-Z advisors, Expert Advice, Honeymoons, FAQs, Contact us. The search field is a single omnibus input whose placeholder is **"Find gifts, vendors, couples..."** — one box serving three audiences (gift buyer, vendor hunter, wedding guest). A persistent app-download interstitial ("It's easier on the Zola app") appears above the content, and "Zola for vendors" is a separate, plainly labelled destination.

`OBSERVED` the resolved vendor-search page is `/wedding-vendors/search/wedding-venues` with `<title>` "The Best 10 Wedding Venues", but the results grid itself is client-rendered and did not appear. The homepage does expose `/wedding-vendors` and `/wedding-vendors/search/wedding-venues` as distinct destinations and uses a `/wedding-planning/{tool}` convention for planning utilities.

`OBSERVED` the footer/utility area is dense with account sub-navigation on an unauthorised visit: Information, Orders you've placed, Ratings and reviews, Zola store credit, Email preferences, Password and security — rendered inside a drawer, with cross-brand entries (Zola Baby, Zola Home). This is an account drawer, not a marketing footer.

### 7.2 Limitation

No filters, cards, profile pages or enquiry flows were observable. `[INFERRED]` Zola's directory is a smaller, curated, US-only surface.

### 7.3 Patterns worth adopting

- **Omnibus search with a three-audience placeholder.** For us the equivalent is a single box that accepts a vendor name, a category, or a locality — and says so in the placeholder.
- **Planning-tool navigation adjacent to directory navigation.** Guest list, Budget and Seating chart sit at the same level as Vendors. This is a strong signal that a pure directory feels thin to long-horizon users; a lightweight "your enquiry list / budget tracker" surface could play the same role for us without becoming a booking tool.
- **A separately-named vendor-facing destination** ("Zola for vendors"), visually distinct from the consumer nav.

### 7.4 Weaknesses / anti-patterns to avoid

- **An app-download interstitial above the content on a mobile web session.** It interrupts the exact task the user came for.
- **Breadth leakage in the nav**: Zola Baby and Zola Home in the same drawer as wedding vendors dilutes the proposition.
- **One search box silently serving three different result types** (gifts vs vendors vs couples). If we do an omnibus box, the result page must visibly partition the result types rather than blending them.

---

## 8. Cvent (cvent.com) — enterprise/B2B reference

### 8.1 What the pages help a user accomplish

`OBSERVED`. Two clearly separated jobs. The corporate site sells a platform and ends in "Request a demo". The `/venues` supplier-network landing serves the buyer side of venue sourcing — search, shortlist, request, book — and states its commercial model explicitly on the page: "No commission, no charges, no fees."

### 8.2 Page hierarchy and navigation

`OBSERVED`. The corporate nav is a **four-menu enterprise IA**: Event solutions (grouped into three sub-clusters — Plan / Run / Measure and scale your event, 6–7 links each), Hospitality solutions (grouped by outcome in all-caps: WIN MICE BUSINESS / CONVERT RFPs / MANAGE EVENT BOOKINGS / IMPROVE MICE BUSINESS, plus a separate WIN CORPORATE TRAVEL group), Your role (Who you are / Your industry / Your format / Your event), and Resources (Explore / Learn / Get help). **Every mega-menu carries a promo card** with one headline statistic and one link. Utility nav is three items: Request demo, Find event venues, Log in.

`OBSERVED` the `/venues` product landing has its own **five-item nav** (Venues, Promotions, Destinations, Discover, Luxury) plus Settings, Sign up and Log in — a separate sub-brand surface, not a section of the corporate site. Breadcrumbs are absent from both pages; the nav carries all orientation.

### 8.3 Search fields and filter controls

`OBSERVED` (`/venues`). Below the H1 "Discover and Book the Perfect Event Space" sits a **primary search block with a mode toggle between plain "Search" and "AI Search"**, and exactly **three structured fields**: Location, Event dates, Event size. That is the whole primary surface — three fields and a mode switch. There is no result count, no facet rail and no sort control on the landing page (results live behind the JS route that 404'd for me).

`OBSERVED` the same page exposes a **three-step "How to get started" explainer** — "Search: Share event details, find venues, and add them to your list" → "Send request: Review your selected venues and send request" → "Booking: Compare proposals and book your ideal event space" — plus a "Learn more" link to a support article.

### 8.4 How selected/active filters display

`OBSERVED`. Not observable on the landing page (no filters). `[INFERRED]` from the support documentation pattern, the venue-network filter UI is a results-page concern.

### 8.5 Listing-card information hierarchy and image ratios

`OBSERVED` (promo modules, which is all the landing page shows): a 16:9-served hero image (`?d=1920&f=webp`, with a separate `_small` variant) → an `### H3` headline → one line of supporting copy → a **"Learn more"** text link. Cards are sparse and text-light by design, and the image carries a heavy visual weight.

### 8.6 Listing-detail page structure

`OBSERVED` partial. A "Cvent Spotlight" module exists for venue/chain-level promotion (title, two lines of copy, "Learn more", full-width image) — a sponsored placement that reads as editorial, not as an ad. The actual venue profile page was not fetchable.

### 8.7 Enquiry CTAs

`OBSERVED`. The corporate CTA set is **"Request demo"**, **"Explore the platform"**, **"Contact sales"**, **"Log in"**, plus in-product **"Search"** and **"Learn more"**. The venue-network flow's verb is **"Send request"** and it is explicitly framed as a _comparison_ step ("Compare proposals and book"). There is no free-form "enquiry" form on the landing surface; the request flow is a defined multi-step object.

### 8.8 Typography, spacing and density

`OBSERVED`. The most typographically confident site observed. Headings are large, short claims ("Expect more from your events™", "More bookings. Fewer gaps.", "No commission, no charges, no fees."), each with one supporting sentence. Sub-cluster labels inside mega-menus are **ALL CAPS structural labels** with sentence/title-case links beneath — a clean two-level type signal. Statistic lines are set as full sentences ("8.3 million events managed. Zero shortcuts taken."). Density is the **lowest in this study**: wide multi-column mega-menu panels with generous padding, a single centred claim plus one search block in the hero, and few, large, well-spaced promo modules. `[INFERRED]` a single sans-serif family with a wide weight range, using the ™ mark as a typographic accent.

### 8.9 Mobile navigation and responsive behaviour

`OBSERVED`. A separate "Utility Navigation (Mobile)" block duplicates the desktop utility nav, and the mega-menus are re-emitted for mobile, indicating a drawer with the same four-group structure.

### 8.10 Patterns worth adopting

- **Three-field primary search** (Location / Dates / Size) with everything else deferred. This is the right shape for a first interaction on our venue vertical.
- **An explicit mode toggle between keyword search and a natural-language/"describe your event" search.** For a multi-category product this is a credible way to help a user who cannot name the category they need.
- **A three-step "How it works" strip on the search landing** (Search → Request → Compare). It sets expectations that we are a lead-gen platform, not a checkout, before the user has invested effort.
- **Stating the commercial model plainly** ("no commission, no charges, no fees"). For India, "we do not charge couples" is a real trust differentiator and belongs high on the page.
- **Mega-menu promo cards** with one headline statistic and one link — a way to surface supply depth exactly where the user is choosing a direction.
- **Grouping mega-menu items by outcome** ("Attract meeting planners" / "Convert RFPs") rather than by product name; for us, grouping the admin-facing or vendor-facing nav by job is worth copying.
- **ALL-CAPS for structural group labels**, sentence case for actual links.

### 8.11 Weaknesses / anti-patterns to avoid

- **Total filter opacity on the landing surface.** A user cannot tell what will be filterable before committing to the search.
- **A "Learn more" link where a real filter explanation belongs.** Help-centre deflection on the primary task surface.
- **Five parallel nav items plus a Settings menu on the venue sub-brand** — the sub-brand nav is nearly as heavy as the parent's.
- **No breadcrumbs anywhere** on a site with a genuinely deep destination hierarchy.

---

## 9. Tagvenue (tagvenue.com) and Peerspace (peerspace.com) — via official help documentation

Because both marketing sites refused datacentre traffic (Tagvenue renders client-side; Peerspace returns 403/502), the only reliable evidence is their **own help-centre documentation**, which describes the live search and enquiry UI in operational detail. These are labelled as documentation-derived.

### 9.1 Tagvenue — search, filters, enquiry

`OBSERVED` (support documentation). The **search entry has exactly three fields, two of which are mandatory**: Event Type (chosen from a pre-populated list), Location (a city), and **Number of Guests, which the documentation states "you must enter … before starting your search"**. There is no date in the primary search; the date is a results-page filter.

`OBSERVED` the results page then offers a **sort/refine bar** with Event Type (dropdown), Price (**a slider**, chosen as an approximate budget), People (a count plus a **standing-vs-sitting** toggle), and a date selector. A separate "Filters" affordance opens six further groups: **Catering and drinks** (catering options, speciality menus, alcohol policies), **Facilities** (wifi, sound system, etc.), **Allowed events** (e.g. whether the venue is licensed for weddings), **Parking & Accommodation**, **Super Venue** (a quality badge filter), and **Cancellation Flexibility**.

`OBSERVED` results can be viewed as a list or on a **map with hoverable markers that preview each venue**, and the map zooms to an area.

`OBSERVED` the **venue profile page places contact on the right-hand side**: the user fills in event details and clicks **"Enquire Now"**, which messages the venue manager, who is expected to reply "within 24 to 48 hours". The documentation states explicitly that this is _not_ a confirmed booking. A **heart on the right-hand side** favourites the venue for comparison. Booking (for venues that support it) is a **12-step form sequence**: choose venue → booking form → event type → date → number of guests → time slot → "Request to book" → add credit card → read and accept the space's rules → optional message to the venue → review and "Request to book" → a temporary hold on funds.

`OBSERVED` the value-prop page introduces a **"Supervenue" badge** described as a guarantee of customer service, and a testimonial pattern showing initials in a circle, a name, a `5.0` score, and a short quote — a compact, credible review unit.

### 9.2 Peerspace — search, filters, enquiry

`OBSERVED` (support documentation). Search begins with three fields: **Activity Type** (a typeahead over a pre-populated list), **Location** (city, ZIP or neighbourhood, with a map view that can be zoomed), and **Dates/Times** — and the documentation explicitly notes that the date field **may be left empty** if the user does not have a specific date. After search, the results page adds: a **"What kind of space are you looking for?" image carousel** with `<` / `>` controls where clicking a space type **prioritises** it in the results (note: it does not hard-filter); **Price** as predefined ranges _or_ a custom range; **Attendees** as predefined ranges _or_ an exact count; and a **"More Filters"** group containing Keyword, additional space types, an **"Instant Book"** toggle (show only listings that do not require host confirmation), and **Features** (e.g. bathtub, cyclorama, pool).

`OBSERVED` results can be viewed as a listing view or a map view, and clicking a listing reveals details, rules, pricing, amenities and reviews. Contact is via a **"Message Host" button located under the host's profile photo on each listing page**, described as having "no financial obligation". A separate booking calendar flow ends in **"Submit"**. Users can save spaces into a named **"Board"** to view later or share.

### 9.3 Patterns worth adopting

- **A hero space-type carousel that re-prioritises rather than hard-filters.** For a first-time user who is browsing rather than searching, this is a gentler entry than an empty results state.
- **Optional date in primary search.** Indian couples frequently have a muhurat window, not a single date; making date optional but strongly prompted in the search bar is the right default. Tagvenue's mandatory guest count is the better _required_ field for venues.
- **Standing vs sitting as a first-class toggle** for venue capacity — directly applicable to Indian banquet halls.
- **"Instant Book" style availability toggles** — for us the analogue is "Responds within 24h" or "Instant availability confirmation", which is a genuine filterable quality signal for lead-gen.
- **An explicit quality badge as a filterable facet** ("Supervenue"), not just a decoration on a card. If we introduce a verified/premium tier, it must be filterable and its criteria stated.
- **A comparison shortlist** (Tagvenue heart-favourites; Peerspace "Boards"). Both treat _collecting_ as the core mid-funnel behaviour.
- **Enquiry panel anchored on the right of the profile**, with event details captured before send, and an explicit expectation of response time ("24 to 48 hours"). Setting that expectation is probably the single cheapest trust win available to a lead-gen platform.
- **A documented multi-step request flow** where each step is one question.
- **Compact testimonial unit**: initials avatar + name + numeric score + one sentence.

### 9.4 Weaknesses / anti-patterns to avoid

- **Tagvenue's 12-step booking flow with a credit-card step and a temporary funds hold.** This is the wrong shape for us and is the clearest thing to diverge from: our enquiry must be one screen.
- **Requiring the guest count before search can begin** — couples often do not know it yet; make it a strong suggestion, not a gate.
- **A price slider as the only budget control.** Indian budgets are banded (`₹500–700 per plate`), and a slider cannot express "per plate" vs "per day" vs "package".
- **A space-type carousel that only re-prioritises** may confuse users who expect a click on a space type to filter. If we use priority rather than filtering, that must be stated.
- **Help-centre-documented flows** imply the UI itself does not explain itself. Our flow should be legible without a support article.

---

## Synthesis

**What recurs across the sites I actually fetched:** `OBSERVED` **Location → Category → Results** is the universal entry triad (BookEventz, Weddingz, VenueLook, The Knot, Zola, Cvent, Tagvenue, Peerspace, Eventbrite). Two filter philosophies dominate: count-rich/chip-free (Weddingz) versus chip-rail/count-free (Eventbrite), with VenueLook using tabs and no summary at all. Landscape card images dominate (observed ratios ~1.29:1 to 16:9; Indian sites cluster 3:2–16:10, Western sites nearer 16:9). Detail pages are long, single-column and section-stacked, and the navigable ones use a tab strip or jump-nav. Enquiry ranges from 2 fields (BookEventz callback) to a 12-step booking flow (Tagvenue). Price presentation is the weakest area everywhere — equal struck-through prices, `Rs. 950 - 0` ranges, bare numbers, "Check ticket price on event", "Negotiable".

**14 actionable recommendations**, each tied to the evidence above:

1. **Adopt BookEventz's five-axis venue menu: Type × Area × Occasion × Capacity × Budget.** The clearest multi-dimensional IA observed; keep Occasion to a curated ~12-item wedding/social/corporate set rather than BookEventz's 14-plus-47 sprawl.

2. **Show a live count on every facet value, plus a `Filters (N) / Clear all` counter and a removable chip row.** Weddingz's `Dwarka 125` tells a user where supply exists before they spend effort; Eventbrite's chip rail makes applied state legible. We should have both — no observed site does.

3. **Put structured fields in the search bar: Location, Event Date, Guests, Budget — only Location required.** Weddingz and BookEventz both surface date/guests/budget at search level. Tagvenue's mandatory guest count is defensible for venues but not for photographers, so make it progressive.

4. **Build the venue → space hierarchy into the product, not just the data model.** VenueLook's "All Party / Event Spaces at <venue>" module with per-space capacity and price is the most domain-correct idea observed. Indian venues rent named halls; a flat listing produces wrong enquiries.

5. **One landscape card ratio (16:10) everywhere, never mixed within a grid.** Observed ratios ranged 1.29:1–16:9; VenueLook mixes 3:2 and ~4:3 in one grid. Enforce via a single image transform.

6. **Fix the listing card to a five-element anatomy**: image (with optional status ribbon) → name → locality + one differentiating attribute → price or "Price on request" → one primary action. BookEventz's `Verified / name / Mumbai / ₹50,000 per day / Enquire Now` and VenueLook's `name / locality / rating / Starting price / Request Price` are the two best models observed; the fixed anatomy prevents Weddingz-style density creep.

7. **Replace "Contact us" with purpose-specific CTAs**: **"Request price"** / **"Get best deal"** for price-led enquiry, **"Check availability"** for date-led enquiry, **"Send enquiry"** as the in-form confirm. Ban raw phone numbers as page text (VenueLook renders `8470804805` beside its CTA) — phone must be a tracked, gated action.

8. **One-screen enquiry of 5–6 fields: Name, Phone, Event date, City/locality, Budget band, Message.** Weddingz's 7-field single step works; Tagvenue's 12-step booking form is the anti-pattern. Also keep BookEventz's **two-field callback** (Name + Phone) as an always-available fallback.

9. **State the response expectation beside the enquiry button.** Tagvenue documents "24 to 48 hours"; no Indian site observed does this. "Vendors typically reply within X hours" is a near-free trust gain — provided the number is real and surfaced in the admin panel.

10. **Give the detail page a sticky icon jump-nav** (Photos / Pricing / Reviews / Location / FAQ), modelled on VenueLook's icon row and BookEventz's tab strip. Observed detail pages run to 20-plus sections; without a spine the lower half is unreachable.

11. **Make shortlisting first-class, login-free, and countable.** Weddingz gates it behind `Login to Add to Shortlist` and shows `shortlisted by 0 customers`, wasting the strongest qualification signal in the funnel. Tagvenue (heart) and Peerspace (Boards) treat collecting as core. Let anonymous users shortlist locally, then attach contact details at send.

12. **Introduce a status/trust chip system** modelled on Eventbrite's image tags and Tagvenue's Supervenue badge: "Verified", "Responds in <2h", "Books out early", "New", "Price on request". Any paid tier must be a **filterable facet with published criteria**, never an unexplained ribbon.

13. **Set an honest price policy and apply it everywhere**: struck-through original only when it genuinely differs; a first-class **"Negotiable"** label; no ragged ranges; consistent "Price on request" instead of a blank; `₹` with Indian digit grouping everywhere (BookEventz alternates `₹50,000` and `1300`). Also use icons + bold labels + values for attribute rows and chip grids for set-valued attributes, as BookEventz and VenueLook both do.

14. **Plan the responsive collapse for the two lists that will break**: the ~70-city selector and the ~40-item occasion list. Use a searchable bottom-sheet with recently-used values pinned — not a scrollable checkbox wall.

---

## Deliberate divergences

1. **No phone number as page text and no click-to-call as the primary CTA.** VenueLook renders a bare 10-digit number beside "Get Best Deal"; BookEventz and Weddingz repeat phone numbers throughout. Copying this destroys lead attribution, makes the platform feel like classifieds, and teaches users to route around us. Show a tracked "Call" action only after an enquiry exists.

2. **No login wall on shortlisting or on starting an enquiry.** Weddingz's `Login to Add to Shortlist` and The Knot's sign-up-first homepage front-load friction. Our value in the moment is lowering the cost of expressing interest; capture identity at _submit_, once the user has decided.

3. **One enquiry form, one screen — never a booking flow.** Tagvenue's 12-step request-to-book with a card step and a funds hold is the clearest anti-pattern in this study. We are not a booking/payment marketplace, and the form should be short enough to never need a progress indicator.

4. **We will not inflate the taxonomy.** BookEventz lists ~47 occasions placing `Walk-in Interview` beside `Sangeet Ceremony`; VenueLook lists ~40 including four near-synonymous birthday variants. Keep a curated primary taxonomy (wedding functions, social celebrations, corporate/MICE) and treat the long tail as _tags_, not filter values.

5. **We will not publish inconsistent or unverifiable scale claims.** BookEventz shows two different customer counts on one page. Show exactly one count per page, only when computed from real data, and label it (e.g. "1,240 verified vendors in Delhi NCR").

6. **We will not put commercial badges inside amenity lists.** BookEventz places "BookEventZ Assured" between "Ample parking" and "Power Backup". Trust markers need a dedicated, explained slot or they read as filler and devalue the real amenities beside them.

7. **We will use a serif accent and a real type scale rather than one sans at many sizes.** Every site observed carries hierarchy by size and weight inside a single sans, and SEO-templated headings ("Facilities at <venue>") make pages read as machine-generated. A display serif for editorial and category headings, a clean sans for UI and data, and hand-written section headings is the cheapest way not to look templated — while keeping data blocks in sans.

8. **We will not force a category choice before search.** The Knot's required Category control and Tagvenue's required guest count both front-load a decision. Allow Location-only and natural-language entry as first-class modes, backed by a Cvent-style "describe your event" toggle.

9. **Design the admin panel as a true operator surface, not a mirror of the site.** Cvent is the only reference here, and it separates corporate, supplier and venue surfaces with distinct navs and CTAs. Our admin needs its own IA and density, exposing provenance and quality signals (enquiry volume, response time, price-accuracy flags, the "report an error" queue BookEventz already collects publicly) as first-class objects rather than fields buried in a vendor record.

10. **Adopt a map/list duality with hover previews, but keep list view default.** Tagvenue and Peerspace both document map views with hoverable venue previews; no Indian site observed offers one — a genuine differentiator. But Indian venue decisions turn on locality familiarity, price and capacity, so list stays the default view.

11. **Make "price on request" a designed state with a reason, not a gap.** Every site observed leaves the unknown-price case unresolved (a blank line, "Negotiable", "Check ticket price on event"). Make it a deliberate chip ("Price on request — 3 of 5 similar vendors published") so the absence itself carries information.

12. **No app-download interstitial above the content.** Zola opens a mobile session with "It's easier on the Zola app" above the fold. Surface the app only after a user has shortlisted or enquired, when it has an obvious job.

13. **Keep the top of the funnel short and SEO prose strictly below pagination.** BookEventz inserts a long SEO article between the grid and the footer and repeats its filter rail twice on one page; VenueLook stacks four SEO link farms in the footer. Keep one filter surface, put pagination immediately after results, and confine long-form content to a separate, linkable guide surface.

---

## Source URLs

**Fetched successfully — rich structure observed:**

- https://weddingz.in/banquet-halls/delhi/all/ · https://weddingz.in/wedding-photographers/delhi/ · https://weddingz.in/wedding-photographers/delhi/found-my-photographer-delhi/ · https://weddingz.in/delhi/weddingz-banquet-company-serviced-lagoona-emerald-wazirpur/
- https://www.bookeventz.com/ · https://www.bookeventz.com/banquets/mumbai/andheri/tunga-international · https://www.bookeventz.com/photographers/mumbai
- https://www.venuelook.com/ · https://www.venuelook.com/delhi/banquet-halls · https://www.venuelook.com/delhi/the-ballroom-of-gola-sizzlers-preet-vihar-in-preet-vihar · https://www.venuelook.com/photographers/delhi/candid-photography
- https://www.eventbrite.com/ · https://www.eventbrite.com/d/india--mumbai/events/ · https://www.eventbrite.com/d/india--mumbai/all-events/ · https://www.eventbrite.com/b/india--mumbai/music/ · https://www.eventbrite.com/e/jewellery-world-exhibition-mumbai-october-2026-tickets-1985132640165
- https://www.cvent.com/ · https://www.cvent.com/venues
- https://www.theknot.com/ · https://www.zola.com/ · https://www.wedmegood.com/wedding-venues/The-Royale-Banquet-3730933
- https://www.tagvenue.com/page/faq-user · https://support.tagvenue.com/hc/en-gb/articles/360019425657-How-do-I-find-the-right-Venue-for-my-Booking · https://support.tagvenue.com/hc/en-gb/articles/360019426357-How-do-I-book-the-Venue
- https://intercom.help/peerspace-108cf19aff8e/en/articles/10119108-how-do-i-find-the-right-space-for-my-booking

**Fetched, HTTP 200, shell/title only (no UI observable, no findings derived):**

- https://weddingz.in/ · https://www.wedmegood.com/ · https://www.bookeventz.com/banquets/mumbai · https://www.bookeventz.com/why-list-with-us
- https://www.weddingbazaar.com/ · https://www.weddingbazaar.com/wedding-venues-in-delhi · https://www.weddingbazaar.com/wedding-photographers-in-delhi-ncr
- https://www.tagvenue.com/ · https://www.tagvenue.com/city/london · https://www.zola.com/wedding-vendors/search/wedding-venues · https://micebook.com/

**Blocked, refused, or unusable (recorded as limitations — no findings derived):**

- https://www.weddingwire.in/ and /wedding-venues — 403 Access Denied
- https://www.shaadisaga.com/ — connection failure (also `/wedding-venues`, `/delhi/wedding-venues`, `/wedding-venues/delhi-ncr`)
- https://www.theknot.com/marketplace/wedding-photographers and /marketplace/wedding-venues — connection failure
- https://www.peerspace.com/ and /venues/los-angeles — 403 / 502 Bad Gateway
- https://www.weddingwire.com/ — no content page retrievable this session

**404s / path failures (site reachable, route wrong):** `https://www.tagvenue.com/venues/london`, `https://www.tagvenue.com/city/london/1`, `https://www.tagvenue.com/venues/uk`, `https://www.tagvenue.com/venues/london/soho`, `https://www.wedmegood.com/wedding-venues`, `https://www.wedmegood.com/wedding-venues/Delhi`, `https://www.wedmegood.com/vendors/wedding-venues/Delhi/`, `https://www.cvent.com/venues/search`, `https://www.cvent.com/venues/london`, `https://www.weddingbazaar.com/wedding-venues-in-delhi/shoplisting`.
