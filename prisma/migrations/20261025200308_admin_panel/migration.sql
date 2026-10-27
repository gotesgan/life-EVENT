-- CreateEnum
CREATE TYPE "VendorInviteStatus" AS ENUM ('SENT', 'OPENED', 'SUBMITTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MetaEventStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "vendor_applications" ADD COLUMN     "citySlug" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "submitted" JSONB,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "vendor_invites" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "applicationId" TEXT,
    "listingId" TEXT,
    "status" "VendorInviteStatus" NOT NULL DEFAULT 'SENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_event_logs" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventId" TEXT,
    "status" "MetaEventStatus" NOT NULL,
    "httpStatus" INTEGER,
    "error" TEXT,
    "enquiryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invites_tokenHash_key" ON "vendor_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "vendor_invites_status_createdAt_idx" ON "vendor_invites"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "vendor_invites_applicationId_idx" ON "vendor_invites"("applicationId");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "email_logs_status_createdAt_idx" ON "email_logs"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "meta_event_logs_createdAt_idx" ON "meta_event_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "meta_event_logs_status_createdAt_idx" ON "meta_event_logs"("status", "createdAt" DESC);
