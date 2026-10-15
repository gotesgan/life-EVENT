/**
 * The one list of tables a test harness clears before it seeds.
 *
 * This is shared rather than duplicated because the two harnesses must agree:
 * Vitest's global setup and Playwright's global setup both reset the test
 * database, and a table added to one list but not the other leaves rows behind
 * that make the seed fail for a reason that looks like a code defect.
 *
 * That is not hypothetical. Playwright leaves its own fixtures behind (a draft
 * listing created to test the publish guard, which deliberately has no cover
 * image). The Vitest global setup then seeded *without* clearing first, and the
 * seed's own "every listing has a cover" invariant aborted the run before a
 * single test executed. Clearing first makes either suite runnable after the
 * other, in any order.
 *
 * `TRUNCATE ... CASCADE` is used rather than ordered DELETEs so a forgotten
 * table cannot fail on a foreign key.
 */
export const TRUNCATE_ALL_SQL =
  'TRUNCATE TABLE "enquiry_notes", "enquiry_activities", "enquiry_listings", "enquiries", ' +
  '"listing_attribute_values", "listing_amenities", "listing_event_types", "listing_service_areas", ' +
  '"listing_media", "listing_services", "listing_packages", "venue_spaces", "listing_categories", ' +
  '"business_listings", "category_attributes", "attribute_options", "attribute_definitions", ' +
  '"amenities", "event_types", "categories", "customer_profiles", "sessions", "accounts", ' +
  '"verifications", "idempotency_keys", "rate_limit_buckets", "audit_logs", "users", "locations" ' +
  'RESTART IDENTITY CASCADE';

/**
 * The advisory lock both harnesses take before clearing and seeding.
 *
 * Serialises two overlapping processes — a CI retry, a developer running the
 * suite twice, or one suite following another — so that one process's TRUNCATE
 * cannot land in the middle of another's seed.
 */
export const SEED_LOCK_KEY = 918_273_645;
