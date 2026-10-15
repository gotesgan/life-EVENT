-- Enables the trigram extension used by the BusinessListing.searchText GIN
-- index (idx_business_listings_search_text_trgm) for substring search and
-- relevance ordering. Kept as its own migration that runs before any schema
-- migration so the index in the initial migration can be created.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
