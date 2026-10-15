/**
 * URL filter keys for the enquiry, customer and audit screens.
 *
 * These live in a plain, non-`'use client'` module for the reason documented in
 * `src/app/admin/_lib/listing-filter-keys.ts`: every export of a client module
 * becomes a client reference when imported into a Server Component, so an array
 * imported from a filter component would be a proxy and `.filter()` would throw
 * at runtime. Components may be shared across the boundary; data must not be.
 *
 * `page`, `pageSize` and `sort` are deliberately absent: pagination is not a
 * filter, and a sort whose default is `newest` would otherwise always count as
 * "1 applied filter" on a freshly opened page.
 */

export const ENQUIRY_FILTER_KEYS = [
  'q',
  'status',
  'assignedAdminId',
  'categoryId',
  'listingId',
  'eventTypeId',
  'flaggedDuplicate',
  'createdFrom',
  'createdTo',
] as const;

export type EnquiryFilterKey = (typeof ENQUIRY_FILTER_KEYS)[number];

export const CUSTOMER_FILTER_KEYS = ['q', 'status', 'role'] as const;

export type CustomerFilterKey = (typeof CUSTOMER_FILTER_KEYS)[number];

export const AUDIT_FILTER_KEYS = ['action', 'entityType', 'entityId', 'actorUserId'] as const;

export type AuditFilterKey = (typeof AUDIT_FILTER_KEYS)[number];
