import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { searchQuerySchema } from '@/lib/validation/search';
import { searchPublicListings } from '@/server/services/search.service';

/**
 * GET /api/listings — public search.
 *
 * The reserved query parameters are validated by `searchQuerySchema`;
 * category-specific `f.<code>` filters are validated inside the service against
 * the active category's declared filter definitions, because their meaning
 * depends on that category.
 */
export const GET = apiHandler(async (request) => {
  const rawParams = searchParamsToObject(request);
  const query = parseInput(searchQuerySchema, rawParams);

  const result = await searchPublicListings({
    query,
    rawParams,
    basePath: '/api/listings',
  });

  return jsonOk(result);
});
