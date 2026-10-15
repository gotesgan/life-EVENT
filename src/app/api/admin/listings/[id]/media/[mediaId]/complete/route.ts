import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { completeMediaUpload } from '@/server/services/media.service';
import { mediaCompleteSchema } from '@/lib/validation/listing';

/**
 * POST /api/admin/listings/[id]/media/[mediaId]/complete
 *
 * The real security checkpoint: the stored object is read back and its actual
 * content type and byte length are compared with what was declared.
 */
export const POST = apiHandler<{ id: string; mediaId: string }>(
  async (request, context: RouteContext<{ id: string; mediaId: string }>) => {
    const actor = await getAdminActorContext(request);
    const params = await context.params;
    const listingId = idSchema.parse(params.id);
    const mediaId = idSchema.parse(params.mediaId);
    const input = await readJsonBody(request, mediaCompleteSchema);

    return jsonOk({
      data: await completeMediaUpload({ listingId, mediaId, ...input, actor }),
    });
  },
);
