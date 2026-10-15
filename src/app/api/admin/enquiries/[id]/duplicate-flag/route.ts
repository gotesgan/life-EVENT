import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { adminDuplicateFlagSchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminFlagDuplicate } from '@/server/services/admin-enquiry.service';

/** POST /api/admin/enquiries/[id]/duplicate-flag — set or clear the flag. */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const enquiryId = idSchema.parse((await context.params).id);
    const { isPotentialDuplicate, note } = await readJsonBody(request, adminDuplicateFlagSchema);

    return jsonOk({
      data: await adminFlagDuplicate({ enquiryId, isPotentialDuplicate, note, actor }),
    });
  },
);
