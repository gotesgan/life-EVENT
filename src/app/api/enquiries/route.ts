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
import {
  REVEAL_COOKIE,
  readRevealedSlugs,
  revealCookieOptions,
  sealRevealedSlugs,
} from '@/lib/listing-privacy';
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

  const response = jsonCreated({
    data: {
      referenceCode: result.referenceCode,
      status: result.status,
      duplicate: result.duplicate,
      listings: result.listingNames,
    },
  });

  /*
   * Sending an enquiry is what unlocks the listing's identity, so the reveal is
   * recorded on this response.
   *
   * The cookie is signed and httpOnly: signing is what stops a visitor from
   * simply writing any listing into it, and httpOnly keeps it out of reach of
   * scripts. The identifiers are stored exactly as posted (`ul_…` from the site's
   * own form, a slug from an API client); `isListingRevealed` accepts either, so
   * the unlock works whichever way the enquiry arrived.
   */
  const previous = readRevealedSlugs(request.cookies.get(REVEAL_COOKIE)?.value);
  response.cookies.set({
    ...revealCookieOptions(),
    value: sealRevealedSlugs([...previous, ...input.listings]),
  });

  return response;
});
