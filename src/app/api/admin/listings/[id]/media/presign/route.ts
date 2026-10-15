import { apiHandler, jsonCreated, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { mediaPresignSchema } from '@/lib/validation/listing';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { requestMediaUpload } from '@/server/services/media.service';

/**
 * POST /api/admin/listings/[id]/media/presign
 *
 * Creates a PENDING media row and returns a presigned URL the browser uploads
 * to directly. Bytes never pass through this server.
 */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const listingId = idSchema.parse((await context.params).id);
    const input = await readJsonBody(request, mediaPresignSchema);

    return jsonCreated({
      data: await requestMediaUpload({ listingId, ...input, actor }),
    });
  },
);
