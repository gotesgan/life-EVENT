import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { adminEnquiryAssignSchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminAssignLead } from '@/server/services/admin-enquiry.service';

/** POST /api/admin/enquiries/[id]/assign — assign or unassign a lead. */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const enquiryId = idSchema.parse((await context.params).id);
    const input = await readJsonBody(request, adminEnquiryAssignSchema);

    return jsonOk({ data: await adminAssignLead({ enquiryId, input, actor }) });
  },
);
