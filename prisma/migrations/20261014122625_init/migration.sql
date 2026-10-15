-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('COUNTRY', 'STATE', 'CITY', 'LOCALITY');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PER_EVENT', 'PER_PERSON', 'PER_PLATE', 'PER_DAY', 'PER_HOUR', 'PER_PACKAGE');

-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "FilterControl" AS ENUM ('CHECKBOX', 'RADIO', 'MULTI_SELECT', 'SINGLE_SELECT', 'RANGE', 'SLIDER', 'BOOLEAN', 'DATE', 'TEXT');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'SHARED_WITH_PROVIDER', 'CONVERTED', 'LOST', 'CANCELLED', 'DUPLICATE', 'SPAM');

-- CreateEnum
CREATE TYPE "EnquiryActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'NOTE_ADDED', 'CUSTOMER_UPDATED', 'CONTACT_DISCLOSED', 'DUPLICATE_FLAGGED', 'PROVIDER_RESPONSE_RECORDED', 'CANCELLED_BY_CUSTOMER');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WEB');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "cityId" TEXT,
    "preferredContactMethod" "ContactMethod" NOT NULL DEFAULT 'EMAIL',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "heroImageUrl" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "iconKey" TEXT,
    "heroImageUrl" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "AttributeDataType" NOT NULL,
    "unit" TEXT,
    "helpText" TEXT,
    "placeholder" TEXT,
    "minNumber" DOUBLE PRECISION,
    "maxNumber" DOUBLE PRECISION,
    "maxLength" INTEGER,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleOnProfile" BOOLEAN NOT NULL DEFAULT true,
    "isComparable" BOOLEAN NOT NULL DEFAULT false,
    "filterControl" "FilterControl",
    "groupLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_options" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" VARCHAR(64) NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "groupLabel" TEXT,
    "iconKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_listings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "about" TEXT,
    "primaryCategoryId" TEXT NOT NULL,
    "primaryLocationId" TEXT NOT NULL,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "contactPersonName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactWhatsapp" TEXT,
    "websiteUrl" TEXT,
    "showPhone" BOOLEAN NOT NULL DEFAULT false,
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "showWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "showWebsite" BOOLEAN NOT NULL DEFAULT true,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "priceUnit" "PriceUnit",
    "capacityMin" INTEGER,
    "capacityMax" INTEGER,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_categories" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listing_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_event_types" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,

    CONSTRAINT "listing_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_service_areas" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "listing_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_media" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_services" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "priceUnit" "PriceUnit",
    "durationMinutes" INTEGER,
    "includes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_packages" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER,
    "priceUnit" "PriceUnit",
    "minGuests" INTEGER,
    "maxGuests" INTEGER,
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_spaces" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacitySeated" INTEGER,
    "capacityStanding" INTEGER,
    "areaSqft" INTEGER,
    "isIndoor" BOOLEAN NOT NULL DEFAULT true,
    "isOutdoor" BOOLEAN NOT NULL DEFAULT false,
    "layoutOptions" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_attribute_values" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "optionId" TEXT,
    "optionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_amenities" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "listing_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "customerUserId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactCityId" TEXT,
    "contactMethod" "ContactMethod" NOT NULL DEFAULT 'EMAIL',
    "eventTypeId" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventDateFlexible" BOOLEAN NOT NULL DEFAULT true,
    "guestCount" INTEGER,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "requirements" TEXT,
    "referralSource" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "isPotentialDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "assignedAdminId" TEXT,
    "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "consentPolicyVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "source" "EnquirySource" NOT NULL DEFAULT 'WEB',
    "submittedIpHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_listings" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedAdminId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "firstContactedAt" TIMESTAMP(3),
    "sharedWithProviderAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "providerResponseNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_activities" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "enquiryListingId" TEXT,
    "type" "EnquiryActivityType" NOT NULL,
    "fromStatus" "EnquiryStatus",
    "toStatus" "EnquiryStatus",
    "message" TEXT,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_notes" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "enquiryListingId" TEXT,
    "authorUserId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "enquiryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ValueOptions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ValueOptions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_path_key" ON "locations"("path");

-- CreateIndex
CREATE INDEX "locations_type_isActive_name_idx" ON "locations"("type", "isActive", "name");

-- CreateIndex
CREATE INDEX "locations_parentId_idx" ON "locations"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_parentId_slug_key" ON "locations"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_path_key" ON "categories"("path");

-- CreateIndex
CREATE INDEX "categories_parentId_isActive_sortOrder_idx" ON "categories"("parentId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parentId_slug_key" ON "categories"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "event_types_slug_key" ON "event_types"("slug");

-- CreateIndex
CREATE INDEX "event_types_isActive_sortOrder_idx" ON "event_types"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_code_key" ON "attribute_definitions"("code");

-- CreateIndex
CREATE INDEX "attribute_definitions_dataType_idx" ON "attribute_definitions"("dataType");

-- CreateIndex
CREATE INDEX "category_attributes_categoryId_isFilterable_sortOrder_idx" ON "category_attributes"("categoryId", "isFilterable", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_attributes_categoryId_attributeId_key" ON "category_attributes"("categoryId", "attributeId");

-- CreateIndex
CREATE INDEX "attribute_options_attributeId_isActive_sortOrder_idx" ON "attribute_options"("attributeId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_options_attributeId_value_key" ON "attribute_options"("attributeId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");

-- CreateIndex
CREATE INDEX "amenities_isActive_sortOrder_idx" ON "amenities"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "business_listings_slug_key" ON "business_listings"("slug");

-- CreateIndex
CREATE INDEX "business_listings_publicationStatus_isFeatured_publishedAt_idx" ON "business_listings"("publicationStatus", "isFeatured", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "business_listings_publicationStatus_priceMin_idx" ON "business_listings"("publicationStatus", "priceMin");

-- CreateIndex
CREATE INDEX "business_listings_publicationStatus_capacityMax_idx" ON "business_listings"("publicationStatus", "capacityMax");

-- CreateIndex
CREATE INDEX "business_listings_primaryCategoryId_publicationStatus_price_idx" ON "business_listings"("primaryCategoryId", "publicationStatus", "priceMin");

-- CreateIndex
CREATE INDEX "business_listings_primaryLocationId_publicationStatus_idx" ON "business_listings"("primaryLocationId", "publicationStatus");

-- CreateIndex
CREATE INDEX "business_listings_verificationStatus_publicationStatus_idx" ON "business_listings"("verificationStatus", "publicationStatus");

-- CreateIndex
CREATE INDEX "business_listings_publicationStatus_updatedAt_idx" ON "business_listings"("publicationStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "business_listings_searchText_idx" ON "business_listings" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "listing_categories_categoryId_isPrimary_idx" ON "listing_categories"("categoryId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "listing_categories_listingId_categoryId_key" ON "listing_categories"("listingId", "categoryId");

-- CreateIndex
CREATE INDEX "listing_event_types_eventTypeId_idx" ON "listing_event_types"("eventTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_event_types_listingId_eventTypeId_key" ON "listing_event_types"("listingId", "eventTypeId");

-- CreateIndex
CREATE INDEX "listing_service_areas_locationId_idx" ON "listing_service_areas"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_service_areas_listingId_locationId_key" ON "listing_service_areas"("listingId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_media_storageKey_key" ON "listing_media"("storageKey");

-- CreateIndex
CREATE INDEX "listing_media_listingId_status_sortOrder_idx" ON "listing_media"("listingId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "listing_media_listingId_isCover_idx" ON "listing_media"("listingId", "isCover");

-- CreateIndex
CREATE INDEX "listing_media_status_createdAt_idx" ON "listing_media"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listing_services_listingId_isActive_sortOrder_idx" ON "listing_services"("listingId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "listing_packages_listingId_isActive_sortOrder_idx" ON "listing_packages"("listingId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "venue_spaces_listingId_sortOrder_idx" ON "venue_spaces"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "listing_attribute_values_attributeId_valueNumber_idx" ON "listing_attribute_values"("attributeId", "valueNumber");

-- CreateIndex
CREATE INDEX "listing_attribute_values_attributeId_valueBoolean_idx" ON "listing_attribute_values"("attributeId", "valueBoolean");

-- CreateIndex
CREATE INDEX "listing_attribute_values_attributeId_optionId_idx" ON "listing_attribute_values"("attributeId", "optionId");

-- CreateIndex
CREATE INDEX "listing_attribute_values_attributeId_valueText_idx" ON "listing_attribute_values"("attributeId", "valueText");

-- CreateIndex
CREATE INDEX "listing_attribute_values_optionIds_idx" ON "listing_attribute_values" USING GIN ("optionIds");

-- CreateIndex
CREATE UNIQUE INDEX "listing_attribute_values_listingId_attributeId_key" ON "listing_attribute_values"("listingId", "attributeId");

-- CreateIndex
CREATE INDEX "listing_amenities_amenityId_idx" ON "listing_amenities"("amenityId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_amenities_listingId_amenityId_key" ON "listing_amenities"("listingId", "amenityId");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_referenceCode_key" ON "enquiries"("referenceCode");

-- CreateIndex
CREATE INDEX "enquiries_customerUserId_createdAt_idx" ON "enquiries"("customerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiries_status_createdAt_idx" ON "enquiries"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiries_contactEmail_createdAt_idx" ON "enquiries"("contactEmail", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiries_contactPhone_createdAt_idx" ON "enquiries"("contactPhone", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiries_assignedAdminId_status_idx" ON "enquiries"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "enquiries_eventTypeId_createdAt_idx" ON "enquiries"("eventTypeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiries_createdAt_idx" ON "enquiries"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "enquiry_listings_listingId_status_createdAt_idx" ON "enquiry_listings"("listingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "enquiry_listings_assignedAdminId_status_idx" ON "enquiry_listings"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "enquiry_listings_status_createdAt_idx" ON "enquiry_listings"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_listings_enquiryId_listingId_key" ON "enquiry_listings"("enquiryId", "listingId");

-- CreateIndex
CREATE INDEX "enquiry_activities_enquiryId_createdAt_idx" ON "enquiry_activities"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "enquiry_activities_enquiryListingId_createdAt_idx" ON "enquiry_activities"("enquiryListingId", "createdAt");

-- CreateIndex
CREATE INDEX "enquiry_activities_enquiryId_isCustomerVisible_createdAt_idx" ON "enquiry_activities"("enquiryId", "isCustomerVisible", "createdAt");

-- CreateIndex
CREATE INDEX "enquiry_notes_enquiryId_createdAt_idx" ON "enquiry_notes"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "enquiry_notes_enquiryListingId_createdAt_idx" ON "enquiry_notes"("enquiryListingId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_key_windowStart_key" ON "rate_limit_buckets"("key", "windowStart");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_enquiryId_idx" ON "idempotency_keys"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- CreateIndex
CREATE INDEX "_ValueOptions_B_index" ON "_ValueOptions"("B");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_listings" ADD CONSTRAINT "business_listings_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_listings" ADD CONSTRAINT "business_listings_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_listings" ADD CONSTRAINT "business_listings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_categories" ADD CONSTRAINT "listing_categories_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_categories" ADD CONSTRAINT "listing_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_event_types" ADD CONSTRAINT "listing_event_types_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_event_types" ADD CONSTRAINT "listing_event_types_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_service_areas" ADD CONSTRAINT "listing_service_areas_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_service_areas" ADD CONSTRAINT "listing_service_areas_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_services" ADD CONSTRAINT "listing_services_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_packages" ADD CONSTRAINT "listing_packages_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_spaces" ADD CONSTRAINT "venue_spaces_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_attribute_values" ADD CONSTRAINT "listing_attribute_values_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_attribute_values" ADD CONSTRAINT "listing_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_attribute_values" ADD CONSTRAINT "listing_attribute_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "attribute_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_contactCityId_fkey" FOREIGN KEY ("contactCityId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_listings" ADD CONSTRAINT "enquiry_listings_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_listings" ADD CONSTRAINT "enquiry_listings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "business_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_listings" ADD CONSTRAINT "enquiry_listings_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_activities" ADD CONSTRAINT "enquiry_activities_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_activities" ADD CONSTRAINT "enquiry_activities_enquiryListingId_fkey" FOREIGN KEY ("enquiryListingId") REFERENCES "enquiry_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_activities" ADD CONSTRAINT "enquiry_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_enquiryListingId_fkey" FOREIGN KEY ("enquiryListingId") REFERENCES "enquiry_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ValueOptions" ADD CONSTRAINT "_ValueOptions_A_fkey" FOREIGN KEY ("A") REFERENCES "attribute_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ValueOptions" ADD CONSTRAINT "_ValueOptions_B_fkey" FOREIGN KEY ("B") REFERENCES "listing_attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;
