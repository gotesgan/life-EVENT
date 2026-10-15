-- Makes Location.slug globally unique so a location is addressable by a single
-- clean URL segment. The composite (parentId, slug) index is replaced because
-- it did not prevent duplicates at the root level (NULL parentId) and made
-- lookup-by-slug ambiguous.
--
-- Generated with:
--   prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

-- DropIndex
DROP INDEX "locations_parentId_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");
