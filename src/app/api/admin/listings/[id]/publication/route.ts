import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { publicationActionSchema } from '@/app/api/admin/_lib/schemas';
import { adminSetPublicationStatus } from '@/server/services/listing.service';

/** POST /api/admin/listings/[id]/publication — publish/unpublish/archive/restore. */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const { action, reason } = await readJsonBody(request, publicationActionSchema);

    return jsonOk({ data: await adminSetPublicationStatus(id, action, actor, reason) });
  },
);
