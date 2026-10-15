import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { listingUpdateSchema } from '@/lib/validation/listing';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminGetListing, adminUpdateListing } from '@/server/services/listing.service';

/** GET /api/admin/listings/[id] — full payload for the admin editor. */
export const GET = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);

    return jsonOk({ data: await adminGetListing(id) });
  },
);

/** PATCH /api/admin/listings/[id] — partial listing update. */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const input = await readJsonBody(request, listingUpdateSchema);

    return jsonOk({ data: await adminUpdateListing(id, input, actor) });
  },
);
