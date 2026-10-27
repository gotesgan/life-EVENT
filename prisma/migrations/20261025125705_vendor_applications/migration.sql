-- CreateEnum
CREATE TYPE "VendorApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "vendor_applications" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactPhoneNormalised" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'NEW',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_applications_status_createdAt_idx" ON "vendor_applications"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "vendor_applications_contactPhoneNormalised_idx" ON "vendor_applications"("contactPhoneNormalised");
