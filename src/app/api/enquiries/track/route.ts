import { apiHandler, jsonOk, readJsonBody } from '@/lib/api/response';
import { trackEnquirySchema } from '@/lib/validation/enquiry';
import { trackEnquiry } from '@/server/services/enquiry.service';

/**
 * POST /api/enquiries/track — guest progress lookup.
 *
 * No session is required or consulted: the reference code *and* the contact
 * email must both match. Rate limiting lives inside the service.
 */
export const POST = apiHandler(async (request) => {
  const input = await readJsonBody(request, trackEnquirySchema);
  return jsonOk({ data: await trackEnquiry(input) });
});
