-- Drop the implicit `_ValueOptions` many-to-many between ListingAttributeValue
-- and AttributeOption.
--
-- Multi-select values are stored in `ListingAttributeValue.optionIds` (a text
-- array with a GIN index) and every write path uses that column. The join table
-- was created by the initial migration but is never written or read, so it is
-- dead weight that also misrepresents the storage model: it suggests the values
-- are relational when they are not.
--
-- Data safety: verified empty before dropping. This migration is destructive in
-- principle but not in practice -- if any rows exist, the DROP still succeeds and
-- nothing that the application reads is lost, because no code path queries this
-- table. The verify step below fails the migration if rows are present, so a
-- deployment that somehow does depend on it stops instead of discarding data.

-- DropForeignKey
ALTER TABLE "_ValueOptions" DROP CONSTRAINT IF EXISTS "_ValueOptions_A_fkey";

-- DropForeignKey
ALTER TABLE "_ValueOptions" DROP CONSTRAINT IF EXISTS "_ValueOptions_B_fkey";

-- Guard: refuse to drop a table that unexpectedly holds rows.
DO $$
DECLARE
  row_count bigint;
BEGIN
  IF to_regclass('"_ValueOptions"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM "_ValueOptions"' INTO row_count;
    IF row_count > 0 THEN
      RAISE EXCEPTION 'Refusing to drop "_ValueOptions": it holds % row(s). This table was believed unused; investigate before deploying this migration.', row_count;
    END IF;
  END IF;
END $$;

-- DropTable
DROP TABLE IF EXISTS "_ValueOptions";
