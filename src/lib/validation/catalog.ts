import { z } from 'zod';
import { AttributeDataType, FilterControl, LocationType } from '@/generated/prisma/enums';
import { idSchema, optionalText, requiredText, slugSchema } from '@/lib/validation/common';

const attributeDataTypeSchema = z.enum(AttributeDataType);
const filterControlSchema = z.enum(FilterControl);
const locationTypeSchema = z.enum(LocationType);

/**
 * Catalogue administration.
 *
 * These schemas are what make "new categories without rebuilding the app"
 * real: an administrator creates an attribute definition, binds it to a
 * category with the desired behaviour, and the search API immediately returns
 * it as a filter the frontend renders.
 */

export const categoryCreateSchema = z.object({
  name: requiredText(2, 120),
  slug: slugSchema.optional(),
  parentId: idSchema.nullable().optional(),
  shortDescription: optionalText(240),
  description: optionalText(4000),
  iconKey: optionalText(60),
  heroImageUrl: optionalText(300),
  metaTitle: optionalText(70),
  metaDescription: optionalText(170),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const eventTypeCreateSchema = z.object({
  name: requiredText(2, 80),
  slug: slugSchema.optional(),
  description: optionalText(400),
  iconKey: optionalText(60),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const eventTypeUpdateSchema = eventTypeCreateSchema.partial();

export const locationCreateSchema = z.object({
  name: requiredText(2, 120),
  slug: slugSchema.optional(),
  type: locationTypeSchema,
  parentId: idSchema.nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  heroImageUrl: optionalText(300),
  description: optionalText(2000),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const locationUpdateSchema = locationCreateSchema.partial();

export const amenityCreateSchema = z.object({
  code: slugSchema,
  label: requiredText(2, 80),
  groupLabel: optionalText(60),
  iconKey: optionalText(60),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const amenityUpdateSchema = amenityCreateSchema.partial();

export const attributeDefinitionCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores'),
  label: requiredText(2, 80),
  dataType: attributeDataTypeSchema,
  unit: optionalText(24),
  helpText: optionalText(240),
  placeholder: optionalText(80),
  minNumber: z.coerce.number().nullable().optional(),
  maxNumber: z.coerce.number().nullable().optional(),
  maxLength: z.coerce.number().int().min(1).max(2000).nullable().optional(),
  isGlobal: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const attributeDefinitionUpdateSchema = attributeDefinitionCreateSchema.partial();

/**
 * Binding an attribute to a category. This is the record that decides whether a
 * filter shows up for a category, whether it is required on the admin form, and
 * which control the frontend renders.
 */
export const categoryAttributeBindSchema = z.object({
  attributeId: idSchema,
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  isVisibleOnProfile: z.boolean().default(true),
  isComparable: z.boolean().default(false),
  /// Marks an attribute as a highlight on search-result cards. Previously absent
  /// from this schema, so Zod stripped it and the admin editor could never save
  /// the flag even though the column existed.
  showOnCard: z.boolean().default(false),
  filterControl: filterControlSchema.nullable().optional(),
  groupLabel: optionalText(60),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const categoryAttributeUpdateSchema = categoryAttributeBindSchema
  .omit({ attributeId: true })
  .partial();

export const attributeOptionCreateSchema = z.object({
  attributeId: idSchema,
  value: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, numbers, dashes and underscores'),
  label: requiredText(1, 80),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const attributeOptionUpdateSchema = attributeOptionCreateSchema
  .omit({ attributeId: true })
  .partial();

/** Public catalogue lookups. */
export const categoryListQuerySchema = z.object({
  includeInactive: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .default(false),
});

export const locationListQuerySchema = z.object({
  type: locationTypeSchema.optional(),
  parentId: idSchema.optional(),
  q: z.string().trim().max(80).optional(),
  activeOnly: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .default(true),
});
