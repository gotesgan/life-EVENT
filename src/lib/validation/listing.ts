import { z } from 'zod';
import {
  cuidListSchema,
  emailSchema,
  idSchema,
  moneySchema,
  optionalText,
  requiredText,
  slugSchema,
} from '@/lib/validation/common';
import { PriceUnit } from '@/generated/prisma/enums';

const priceUnitSchema = z.enum(PriceUnit);

const httpUrlSchema = z
  .string()
  .trim()
  .max(300)
  .refine((value) => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), {
    message: 'Enter a full URL starting with http:// or https://',
  });

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

const listingServiceSchema = z.object({
  id: idSchema.optional(),
  name: requiredText(2, 120),
  description: optionalText(1200),
  priceFrom: moneySchema.nullable().optional(),
  priceTo: moneySchema.nullable().optional(),
  priceUnit: priceUnitSchema.nullable().optional(),
  durationMinutes: z.coerce.number().int().min(0).max(10_080).nullable().optional(),
  includes: z.array(z.string().trim().max(160)).max(30).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const listingPackageSchema = z.object({
  id: idSchema.optional(),
  name: requiredText(2, 120),
  description: optionalText(2000),
  price: moneySchema.nullable().optional(),
  priceUnit: priceUnitSchema.nullable().optional(),
  minGuests: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  maxGuests: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  inclusions: z.array(z.string().trim().max(160)).max(40).default([]),
  exclusions: z.array(z.string().trim().max(160)).max(40).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const venueSpaceSchema = z.object({
  id: idSchema.optional(),
  name: requiredText(2, 120),
  description: optionalText(1200),
  capacitySeated: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  capacityStanding: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  areaSqft: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  isIndoor: z.boolean().default(true),
  isOutdoor: z.boolean().default(false),
  layoutOptions: z.array(z.string().trim().max(80)).max(20).default([]),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/**
 * Attribute values arrive as a loosely-typed payload because the *meaning* of
 * each field depends on the attribute definition's data type, which only the
 * server knows. `AttributeService.validateValues()` performs the second,
 * semantic validation against the category's declared attributes.
 */
export const attributeValueInputSchema = z.object({
  attributeId: idSchema,
  valueText: z.string().trim().max(600).nullable().optional(),
  valueNumber: z.coerce.number().min(-1_000_000).max(1_000_000_000).nullable().optional(),
  valueBoolean: z.boolean().nullable().optional(),
  valueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
    .nullable()
    .optional(),
  optionValue: z.string().trim().max(64).nullable().optional(),
  optionValues: z.array(z.string().trim().max(64)).max(30).optional(),
});

export const listingAttributeValuesSchema = z.object({
  values: z.array(attributeValueInputSchema).max(80),
});

const listingBaseSchema = z.object({
  name: requiredText(2, 140),
  slug: slugSchema.optional(),
  tagline: optionalText(180),
  description: optionalText(4000),
  about: optionalText(8000),

  /**
   * Featured placement is an editorial decision an administrator makes; it was
   * previously writable only by the seed script, so the "Featured" ribbon and
   * the `featured=true` filter could never be operated.
   */
  isFeatured: z.boolean().optional(),

  primaryCategoryId: idSchema,
  categoryIds: cuidListSchema(8).default([]),
  primaryLocationId: idSchema,
  serviceAreaIds: cuidListSchema(40).default([]),
  eventTypeIds: cuidListSchema(20).default([]),
  amenityIds: cuidListSchema(30).default([]),

  contactPersonName: optionalText(120),
  contactPhone: optionalText(24),
  contactEmail: emailSchema.optional(),
  contactWhatsapp: optionalText(24),
  websiteUrl: httpUrlSchema.optional(),
  showPhone: z.boolean().default(false),
  showEmail: z.boolean().default(false),
  showWhatsapp: z.boolean().default(false),
  showWebsite: z.boolean().default(true),

  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  postalCode: optionalText(12),
  latitude: latitudeSchema.nullable().optional(),
  longitude: longitudeSchema.nullable().optional(),

  priceMin: moneySchema.nullable().optional(),
  priceMax: moneySchema.nullable().optional(),
  priceUnit: priceUnitSchema.nullable().optional(),
  capacityMin: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  capacityMax: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),

  services: z.array(listingServiceSchema).max(30).optional(),
  packages: z.array(listingPackageSchema).max(20).optional(),
  venueSpaces: z.array(venueSpaceSchema).max(20).optional(),
});

export const listingCreateSchema = listingBaseSchema
  .refine(
    (value) => value.priceMin == null || value.priceMax == null || value.priceMin <= value.priceMax,
    { message: 'Minimum price cannot be higher than maximum price', path: ['priceMax'] },
  )
  .refine(
    (value) =>
      value.capacityMin == null ||
      value.capacityMax == null ||
      value.capacityMin <= value.capacityMax,
    {
      message: 'Minimum capacity cannot be higher than maximum capacity',
      path: ['capacityMax'],
    },
  );

export const listingUpdateSchema = listingBaseSchema
  .partial()
  .refine(
    (value) => value.priceMin == null || value.priceMax == null || value.priceMin <= value.priceMax,
    { message: 'Minimum price cannot be higher than maximum price', path: ['priceMax'] },
  )
  .refine(
    (value) =>
      value.capacityMin == null ||
      value.capacityMax == null ||
      value.capacityMin <= value.capacityMax,
    {
      message: 'Minimum capacity cannot be higher than maximum capacity',
      path: ['capacityMax'],
    },
  );

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;

/** Admin listing list filters. */
export const adminListingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  publicationStatus: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
  categoryId: idSchema.optional(),
  locationId: idSchema.optional(),
  isFeatured: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional(),
});

export type AdminListingQuery = z.infer<typeof adminListingQuerySchema>;

export const mediaPresignSchema = z.object({
  filename: requiredText(1, 200),
  contentType: z.string().trim().min(3).max(80),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
});

export const mediaCompleteSchema = z.object({
  altText: requiredText(3, 200),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isCover: z.boolean().default(false),
});

export const mediaReorderSchema = z.object({
  items: z
    .array(z.object({ mediaId: idSchema, sortOrder: z.coerce.number().int().min(0).max(999) }))
    .min(1)
    .max(60),
});

export const listingStatusActionSchema = z.object({
  reason: optionalText(400),
});

export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;
