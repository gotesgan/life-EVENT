import {
  apiHandler,
  jsonOk,
  parseInput,
  readJsonBody,
  type RouteContext,
} from '@/lib/api/response';
import { requireActor } from '@/lib/auth/actor';
import { cancelEnquirySchema, enquiryReferenceParamSchema } from '@/lib/validation/enquiry';
import { cancelCustomerEnquiry } from '@/server/services/enquiry.service';

/** POST /api/enquiries/[referenceCode]/cancel — customer-initiated cancellation. */
export const POST = apiHandler<{ referenceCode: string }>(
  async (request, context: RouteContext<{ referenceCode: string }>) => {
    const actor = await requireActor(request.headers);
    const { referenceCode } = parseInput(enquiryReferenceParamSchema, await context.params);
    const { reason } = await readJsonBody(request, cancelEnquirySchema);

    return jsonOk({
      data: await cancelCustomerEnquiry(actor.user.id, referenceCode, reason),
    });
  },
);
