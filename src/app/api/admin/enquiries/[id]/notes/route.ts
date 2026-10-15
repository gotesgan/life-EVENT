import { apiHandler, jsonCreated, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { adminNoteCreateSchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminAddNote } from '@/server/services/admin-enquiry.service';

/** POST /api/admin/enquiries/[id]/notes — add an internal note. */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const enquiryId = idSchema.parse((await context.params).id);
    const input = await readJsonBody(request, adminNoteCreateSchema);

    return jsonCreated({ data: await adminAddNote({ enquiryId, input, actor }) });
  },
);
