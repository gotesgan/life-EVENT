import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { adminCustomerUpdateSchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminUpdateCustomerStatus } from '@/server/services/admin-enquiry.service';

/**
 * PATCH /api/admin/customers/[id] — suspend, reactivate or deactivate.
 *
 * The service refuses to change the acting administrator's own account and to
 * suspend another administrator; both surface as 400.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const userId = idSchema.parse((await context.params).id);
    const { status, reason } = await readJsonBody(request, adminCustomerUpdateSchema);

    return jsonOk({ data: await adminUpdateCustomerStatus({ userId, status, reason, actor }) });
  },
);
