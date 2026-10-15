import {
  apiHandler,
  jsonCreated,
  jsonOk,
  parseInput,
  readJsonBody,
  searchParamsToObject,
} from '@/lib/api/response';
import { buildPaginated } from '@/lib/pagination';
import { adminListingQuerySchema, listingCreateSchema } from '@/lib/validation/listing';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminCreateListing, adminListListings } from '@/server/services/listing.service';

/** GET /api/admin/listings — paginated listing management table. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);
  const query = parseInput(adminListingQuerySchema, searchParamsToObject(request));

  const { rows, totalItems } = await adminListListings(query);
  const { pagination } = buildPaginated(rows, totalItems, query.page, query.pageSize);

  return jsonOk({ data: rows, pagination });
});

/** POST /api/admin/listings — create a draft listing. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const input = await readJsonBody(request, listingCreateSchema);

  return jsonCreated({ data: await adminCreateListing(input, actor) });
});
