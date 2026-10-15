import { apiHandler, jsonOk, parseInput, type RouteContext } from '@/lib/api/response';
import { requireActor } from '@/lib/auth/actor';
import { enquiryReferenceParamSchema } from '@/lib/validation/enquiry';
import { getCustomerEnquiry } from '@/server/services/enquiry.service';

/**
 * GET /api/enquiries/[referenceCode]
 *
 * The service looks the enquiry up by `(referenceCode, customerUserId)`, so
 * another customer's reference is reported as 404 — never 403 — and the
 * endpoint cannot be used to confirm that a reference code exists.
 */
export const GET = apiHandler<{ referenceCode: string }>(
  async (request, context: RouteContext<{ referenceCode: string }>) => {
    const actor = await requireActor(request.headers);
    const { referenceCode } = parseInput(enquiryReferenceParamSchema, await context.params);

    return jsonOk({ data: await getCustomerEnquiry(actor.user.id, referenceCode) });
  },
);
