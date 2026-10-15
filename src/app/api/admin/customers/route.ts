import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { adminCustomerQuerySchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminListCustomers } from '@/server/services/admin-enquiry.service';

/** GET /api/admin/customers — paginated customer moderation list. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);
  const query = parseInput(adminCustomerQuerySchema, searchParamsToObject(request));

  return jsonOk(await adminListCustomers(query));
});
