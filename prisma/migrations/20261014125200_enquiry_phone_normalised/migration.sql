-- Adds an indexable digits-only form of the contact phone number so duplicate
-- detection can match formatting variants with an index lookup rather than a
-- sequential scan.
--
-- Written by hand (not generated) so existing rows are backfilled rather than
-- failing the NOT NULL constraint:
--   prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

-- DropIndex
DROP INDEX "enquiries_contactPhone_createdAt_idx";

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN "contactPhoneNormalised" TEXT NOT NULL DEFAULT '';

UPDATE "enquiries"
SET "contactPhoneNormalised" = right(regexp_replace("contactPhone", '\D', '', 'g'), 10);

ALTER TABLE "enquiries" ALTER COLUMN "contactPhoneNormalised" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "enquiries_contactPhoneNormalised_createdAt_idx" ON "enquiries"("contactPhoneNormalised", "createdAt" DESC);
