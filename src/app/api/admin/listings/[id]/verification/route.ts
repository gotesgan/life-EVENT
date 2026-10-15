import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { verificationActionSchema } from '@/app/api/admin/_lib/schemas';
import { adminSetVerificationStatus } from '@/server/services/listing.service';

/** POST /api/admin/listings/[id]/verification — verify/reject/reset. */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const { action, reason } = await readJsonBody(request, verificationActionSchema);

    return jsonOk({ data: await adminSetVerificationStatus(id, action, actor, reason) });
  },
);
