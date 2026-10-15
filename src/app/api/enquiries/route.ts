import {
  apiHandler,
  jsonCreated,
  jsonOk,
  parseInput,
  readJsonBody,
  searchParamsToObject,
} from '@/lib/api/response';
import { getActorFromHeaders, requireActor } from '@/lib/auth/actor';
import { getClientIp } from '@/lib/client-ip';
import { createEnquirySchema, customerEnquiryQuerySchema } from '@/lib/validation/enquiry';
import { createEnquiry, listCustomerEnquiries } from '@/server/services/enquiry.service';

/** GET /api/enquiries — the signed-in customer's own enquiries. */
export const GET = apiHandler(async (request) => {
  const actor = await requireActor(request.headers);
  const query = parseInput(customerEnquiryQuerySchema, searchParamsToObject(request));

  return jsonOk(await listCustomerEnquiries(actor.user.id, query));
});

/**
 * POST /api/enquiries — submit an enquiry.
 *
 * Guests are allowed, so identity is read with `getActorFromHeaders` rather
 * than `requireActor`: a session may exist and its user id is attached to the
 * lead, but its absence is not a rejection.
 */
export const POST = apiHandler(async (request) => {
  const actor = await getActorFromHeaders(request.headers);
  const input = await readJsonBody(request, createEnquirySchema);

  const result = await createEnquiry(input, {
    actorUserId: actor.kind === 'anonymous' ? null : actor.user.id,
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
    idempotencyKey: request.headers.get('idempotency-key'),
  });

  return jsonCreated({
    data: {
      referenceCode: result.referenceCode,
      status: result.status,
      duplicate: result.duplicate,
      listings: result.listingNames,
    },
  });
});
