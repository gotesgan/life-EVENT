import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { deleteListingMedia } from '@/server/services/media.service';

/** DELETE /api/admin/listings/[id]/media/[mediaId] — remove an image. */
export const DELETE = apiHandler<{ id: string; mediaId: string }>(
  async (request, context: RouteContext<{ id: string; mediaId: string }>) => {
    const actor = await getAdminActorContext(request);
    const params = await context.params;
    const listingId = idSchema.parse(params.id);
    const mediaId = idSchema.parse(params.mediaId);

    await deleteListingMedia({ listingId, mediaId, actor });
    return jsonOk({ ok: true });
  },
);
