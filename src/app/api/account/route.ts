import {
  apiHandler,
  jsonOk,
  readJsonBody,
  searchParamsToObject,
  parseInput,
} from '@/lib/api/response';
import { requireActor } from '@/lib/auth/actor';
import { customerProfileUpdateSchema, accountQuerySchema } from '@/lib/validation/account';
import { getAccountOverview, updateCustomerProfile } from '@/server/services/account.service';

/**
 * GET /api/account — the signed-in customer's own overview.
 *
 * The user id comes from the session only. No query parameter, body field or
 * header can select whose account is returned.
 */
export const GET = apiHandler(async (request) => {
  // The account endpoint takes no query parameters; parsing the (empty)
  // contract keeps every route's input handling uniform.
  parseInput(accountQuerySchema, searchParamsToObject(request));
  const actor = await requireActor(request.headers);

  return jsonOk({ data: await getAccountOverview(actor.user.id) });
});

/** PATCH /api/account — update the caller's own profile only. */
export const PATCH = apiHandler(async (request) => {
  const actor = await requireActor(request.headers);
  const input = await readJsonBody(request, customerProfileUpdateSchema);

  return jsonOk({ data: await updateCustomerProfile(actor.user.id, input) });
});
