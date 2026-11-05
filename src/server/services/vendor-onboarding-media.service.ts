import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sha256Hex } from '@/lib/crypto';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getStorageDriver } from '@/lib/storage';
import { buildListingMediaKey, validateUploadRequest, verifyUploadedObject } from '@/lib/storage';
import type {
  vendorOnboardingMediaCompleteSchema,
  vendorOnboardingMediaPresignSchema,
} from '@/lib/validation/vendor-invite';
import type { z } from 'zod';

const PRESIGN_TTL_SECONDS = 300;

type PresignInput = z.infer<typeof vendorOnboardingMediaPresignSchema>;
type CompleteInput = z.infer<typeof vendorOnboardingMediaCompleteSchema>;

async function inviteForToken(token: string) {
  const invite = await prisma.vendorInvite.findUnique({
    where: { tokenHash: sha256Hex(token) },
  });
  if (!invite) throw new NotFoundError('This link is not valid');
  if (invite.status === 'SUBMITTED')
    throw new ValidationError('This form has already been submitted');
  if (invite.status === 'REVOKED') throw new ValidationError('This link has been revoked');
  if (invite.expiresAt.getTime() < Date.now()) throw new ValidationError('This link has expired');
  return invite;
}

export async function requestVendorOnboardingUpload(input: PresignInput) {
  const invite = await inviteForToken(input.token);
  const count = await prisma.vendorOnboardingMedia.count({ where: { inviteId: invite.id } });
  if (count >= 10) throw new ValidationError('You can add up to ten images');

  const validated = validateUploadRequest(input);
  const mediaId = randomUUID();
  const key = buildListingMediaKey({
    listingId: `onboarding-${invite.id}`,
    mediaId,
    filename: input.filename,
    contentType: validated.contentType,
    sizeBytes: validated.sizeBytes,
  });
  const storage = getStorageDriver();
  const upload = await storage.createPresignedUpload({
    key,
    contentType: validated.contentType,
    sizeBytes: validated.sizeBytes,
    expiresInSeconds: PRESIGN_TTL_SECONDS,
  });

  const media = await prisma.vendorOnboardingMedia.create({
    data: {
      id: mediaId,
      inviteId: invite.id,
      storageKey: key,
      publicUrl: upload.publicUrl,
      altText: input.altText,
      mimeType: validated.contentType,
      sizeBytes: validated.sizeBytes,
      sortOrder: count,
      isMenu: input.isMenu,
    },
  });

  return {
    mediaId: media.id,
    uploadUrl: upload.uploadUrl,
    method: upload.method,
    requiredHeaders: upload.requiredHeaders,
  };
}

export async function completeVendorOnboardingUpload(input: CompleteInput & { mediaId: string }) {
  const invite = await inviteForToken(input.token);
  const media = await prisma.vendorOnboardingMedia.findFirst({
    where: { id: input.mediaId, inviteId: invite.id },
  });
  if (!media) throw new NotFoundError('Upload');
  if (media.status === 'READY')
    return { id: media.id, altText: media.altText, isMenu: media.isMenu };

  const actual = await getStorageDriver().head(media.storageKey);
  const verified = verifyUploadedObject({
    declaredContentType: media.mimeType,
    declaredSizeBytes: media.sizeBytes,
    actual,
  });
  const saved = await prisma.vendorOnboardingMedia.update({
    where: { id: media.id },
    data: {
      status: 'READY',
      sizeBytes: verified.sizeBytes,
      mimeType: verified.contentType,
      publicUrl: verified.publicUrl,
    },
    select: { id: true, altText: true, isMenu: true },
  });
  return saved;
}

export async function deleteVendorOnboardingUpload(input: CompleteInput & { mediaId: string }) {
  const invite = await inviteForToken(input.token);
  const media = await prisma.vendorOnboardingMedia.findFirst({
    where: { id: input.mediaId, inviteId: invite.id, applicationId: null },
    select: { id: true, storageKey: true },
  });
  if (!media) throw new NotFoundError('Upload');

  await getStorageDriver().delete(media.storageKey);
  await prisma.vendorOnboardingMedia.delete({ where: { id: media.id } });
  return { deleted: true };
}
