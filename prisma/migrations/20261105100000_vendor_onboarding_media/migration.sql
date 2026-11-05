CREATE TABLE "vendor_onboarding_media" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "applicationId" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMenu" BOOLEAN NOT NULL DEFAULT false,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_onboarding_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_onboarding_media_storageKey_key" ON "vendor_onboarding_media"("storageKey");
CREATE INDEX "vendor_onboarding_media_inviteId_status_sortOrder_idx" ON "vendor_onboarding_media"("inviteId", "status", "sortOrder");
CREATE INDEX "vendor_onboarding_media_applicationId_status_sortOrder_idx" ON "vendor_onboarding_media"("applicationId", "status", "sortOrder");

ALTER TABLE "vendor_onboarding_media" ADD CONSTRAINT "vendor_onboarding_media_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "vendor_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_onboarding_media" ADD CONSTRAINT "vendor_onboarding_media_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "vendor_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
