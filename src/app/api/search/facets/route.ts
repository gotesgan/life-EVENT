import { apiHandler, jsonOk } from '@/lib/api/response';
import { getSearchFacets } from '@/server/services/search.service';

/** GET /api/search/facets — browsable category, location and event-type sets. */
export const GET = apiHandler(async () => {
  return jsonOk({ data: await getSearchFacets() });
});
