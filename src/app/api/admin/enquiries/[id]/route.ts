import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminGetEnquiry } from '@/server/services/admin-enquiry.service';

/** GET /api/admin/enquiries/[id] — full lead detail, including private notes. */
export const GET = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);

    return jsonOk({ data: await adminGetEnquiry(id) });
  },
);
