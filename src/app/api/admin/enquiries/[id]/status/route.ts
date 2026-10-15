import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminLeadStatusSchema } from '@/app/api/admin/_lib/schemas';
import { adminChangeLeadStatus } from '@/server/services/admin-enquiry.service';

/**
 * POST /api/admin/enquiries/[id]/status
 *
 * `enquiryListingId` narrows the change to one provider lead; omitting it moves
 * every lead in the enquiry. The allowed transitions are enforced by the
 * service's state machine, which rejects an illegal move with 409.
 */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const enquiryId = idSchema.parse((await context.params).id);
    const { enquiryListingId, ...input } = await readJsonBody(request, adminLeadStatusSchema);

    return jsonOk({
      data: await adminChangeLeadStatus({ enquiryId, enquiryListingId, input, actor }),
    });
  },
);
