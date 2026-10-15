import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { adminEnquiryQuerySchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminListEnquiries } from '@/server/services/admin-enquiry.service';

/** GET /api/admin/enquiries — paginated admin enquiry inbox. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);
  const query = parseInput(adminEnquiryQuerySchema, searchParamsToObject(request));

  return jsonOk(await adminListEnquiries(query));
});
