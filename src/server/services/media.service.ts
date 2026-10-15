import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getStorageDriver } from '@/lib/storage';
import {
  buildListingMediaKey,
  sanitizeAltText,
  validateUploadRequest,
  verifyUploadedObject,
} from '@/lib/storage';
import { recordAudit } from '@/server/services/audit.service';
import type { AdminActorContext } from '@/server/services/listing.service';

/**
 * Listing media lifecycle.
 *
 * The bytes never pass through the Next.js server: the browser uploads directly
 * to object storage with a short-lived presigned URL, and the server only
 * records verified metadata. All storage SDK usage is confined to this module
 * and `src/lib/storage`, so no controller ever talks to R2.
 */

const PRESIGN_TTL_SECONDS = 300;

export interface MediaUploadTicket {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  publicUrl: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

function actorContext(actor: AdminActorContext) {
  return {
    actorUserId: actor.userId,
    actorName: actor.name,
    ipHash: actor.ipHash ?? null,
    userAgent: actor.userAgent ?? null,
  };
}

/**
 * Validates the request, creates a PENDING media row and returns a presigned
 * upload URL constrained to that single object, content type and byte length.
 *
 * The row is created first so the object key is deterministic and can be
 * verified later; a PENDING row that is never completed is reaped rather than
 * shown to customers.
 */
export async function requestMediaUpload(input: {
  listingId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  actor: AdminActorContext;
}): Promise<MediaUploadTicket> {
  const listing = await prisma.businessListing.findUnique({
    where: { id: input.listingId },
    select: { id: true, name: true },
  });
  if (!listing) throw new NotFoundError('Listing');

  // Never trust the file extension: the extension is derived from the validated
  // content type.
  const validated = validateUploadRequest({
    filename: input.filename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });

  const mediaId = randomUUID();
  const key = buildListingMediaKey({
    listingId: listing.id,
    mediaId,
    filename: input.filename,
    contentType: validated.contentType,
    sizeBytes: validated.sizeBytes,
  });

  const driver = getStorageDriver();
  const presigned = await driver.createPresignedUpload({
    key,
    contentType: validated.contentType,
    sizeBytes: validated.sizeBytes,
    expiresInSeconds: PRESIGN_TTL_SECONDS,
  });

  const sortOrder = await prisma.listingMedia.count({ where: { listingId: listing.id } });

  await prisma.listingMedia.create({
    data: {
      id: mediaId,
      listingId: listing.id,
      storageKey: key,
      publicUrl: presigned.publicUrl,
      // Replaced with the admin-supplied text at completion; never left empty
      // on a READY row because alt text is required for accessibility.
      altText: 'Pending upload',
      status: 'PENDING',
      mimeType: validated.contentType,
      sizeBytes: validated.sizeBytes,
      sortOrder,
      isCover: sortOrder === 0,
      uploadedById: input.actor.userId,
    },
  });

  return {
    mediaId,
    uploadUrl: presigned.uploadUrl,
    method: presigned.method,
    publicUrl: presigned.publicUrl,
    expiresInSeconds: presigned.expiresInSeconds,
    requiredHeaders: presigned.requiredHeaders,
  };
}

/**
 * Completion step, and the real security checkpoint.
 *
 * The object is read back from storage and its *actual* content type and byte
 * length are compared with what was declared. Whatever the browser uploaded is
 * what gets verified — the client's claim is only used to decide what to look
 * for.
 */
export async function completeMediaUpload(input: {
  listingId: string;
  mediaId: string;
  altText: string;
  sortOrder: number;
  isCover: boolean;
  actor: AdminActorContext;
}) {
  const media = await prisma.listingMedia.findFirst({
    where: { id: input.mediaId, listingId: input.listingId },
  });
  if (!media) throw new NotFoundError('Media');
  if (media.status === 'READY') {
    throw new ValidationError('That upload has already been completed');
  }

  const driver = getStorageDriver();
  const actual = await driver.head(media.storageKey);

  const verified = verifyUploadedObject({
    declaredContentType: media.mimeType,
    declaredSizeBytes: media.sizeBytes,
    actual,
  });

  const altText = sanitizeAltText(input.altText);

  return prisma.$transaction(async (tx) => {
    if (input.isCover) {
      await tx.listingMedia.updateMany({
        where: { listingId: input.listingId, isCover: true },
        data: { isCover: false },
      });
    }

    const updated = await tx.listingMedia.update({
      where: { id: media.id },
      data: {
        status: 'READY',
        altText,
        sizeBytes: verified.sizeBytes,
        mimeType: verified.contentType,
        publicUrl: verified.publicUrl,
        sortOrder: input.sortOrder,
        isCover: input.isCover,
        failureReason: null,
      },
      select: { id: true, publicUrl: true, altText: true, isCover: true, sortOrder: true },
    });

    await recordAudit(
      {
        action: 'listing.media_verified',
        entityType: 'BusinessListing',
        entityId: input.listingId,
        summary: `Attached image to listing (${verified.sizeBytes} bytes)`,
        metadata: { mediaId: media.id, contentType: verified.contentType },
        context: actorContext(input.actor),
      },
      tx,
    );

    return updated;
  });
}

/** Removes the database row and the stored object. */
export async function deleteListingMedia(input: {
  listingId: string;
  mediaId: string;
  actor: AdminActorContext;
}) {
  const media = await prisma.listingMedia.findFirst({
    where: { id: input.mediaId, listingId: input.listingId },
    select: { id: true, storageKey: true, isCover: true },
  });
  if (!media) throw new NotFoundError('Media');

  await prisma.$transaction(async (tx) => {
    await tx.listingMedia.delete({ where: { id: media.id } });

    // Promote another image to cover so a listing never ends up with none after
    // its cover is deleted.
    if (media.isCover) {
      const next = await tx.listingMedia.findFirst({
        where: { listingId: input.listingId, status: 'READY' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (next) {
        await tx.listingMedia.update({ where: { id: next.id }, data: { isCover: true } });
      }
    }

    await recordAudit(
      {
        action: 'listing.media_removed',
        entityType: 'BusinessListing',
        entityId: input.listingId,
        summary: 'Removed an image from a listing',
        metadata: { mediaId: media.id },
        context: actorContext(input.actor),
      },
      tx,
    );
  });

  // Storage cleanup happens after the row is gone. A failure here leaves an
  // unreferenced object, which is recoverable by a cleanup job; deleting the
  // object first could instead leave a broken image on a live listing.
  try {
    await getStorageDriver().delete(media.storageKey);
  } catch (error) {
    console.error('[media] object cleanup failed', { key: media.storageKey, error });
  }
}

/** Reorders the gallery and optionally promotes a new cover image. */
export async function reorderListingMedia(input: {
  listingId: string;
  items: Array<{ mediaId: string; sortOrder: number }>;
  actor: AdminActorContext;
}) {
  const ids = input.items.map((item) => item.mediaId);

  const existing = await prisma.listingMedia.findMany({
    where: { listingId: input.listingId, id: { in: ids } },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw new ValidationError('Some images do not belong to this listing');
  }

  return prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      await tx.listingMedia.update({
        where: { id: item.mediaId },
        data: { sortOrder: item.sortOrder },
      });
    }

    const cover = input.items.find((item) => item.sortOrder === 0);
    if (cover) {
      await tx.listingMedia.updateMany({
        where: { listingId: input.listingId, isCover: true },
        data: { isCover: false },
      });
      await tx.listingMedia.update({
        where: { id: cover.mediaId },
        data: { isCover: true },
      });
    }

    await recordAudit(
      {
        action: 'listing.media_attached',
        entityType: 'BusinessListing',
        entityId: input.listingId,
        summary: 'Reordered listing gallery',
        context: actorContext(input.actor),
      },
      tx,
    );

    return { reordered: input.items.length };
  });
}

/**
 * Deletes PENDING rows older than an hour. Called opportunistically by the
 * admin media endpoint rather than from a scheduler, so no worker is required.
 */
export async function reapStalePendingMedia(): Promise<number> {
  if (Math.random() > 0.1) return 0;

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await prisma.listingMedia.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
    take: 25,
  });

  for (const media of stale) {
    try {
      await getStorageDriver().delete(media.storageKey);
    } catch {
      // Best effort; the row is removed regardless so it never becomes visible.
    }
  }

  if (stale.length === 0) return 0;

  const { count } = await prisma.listingMedia.deleteMany({
    where: { id: { in: stale.map((media) => media.id) } },
  });
  return count;
}
