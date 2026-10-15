import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { mediaReorderSchema } from '@/lib/validation/listing';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { reorderListingMedia } from '@/server/services/media.service';

/** PATCH /api/admin/listings/[id]/media — reorder the gallery. */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const listingId = idSchema.parse((await context.params).id);
    const { items } = await readJsonBody(request, mediaReorderSchema);

    return jsonOk({ data: await reorderListingMedia({ listingId, items, actor }) });
  },
);
