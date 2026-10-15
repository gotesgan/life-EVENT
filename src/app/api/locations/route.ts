import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { locationListQuerySchema } from '@/lib/validation/catalog';
import { listLocations } from '@/server/services/catalog.service';

/** GET /api/locations — location directory filtered by type, parent or name. */
export const GET = apiHandler(async (request) => {
  const query = parseInput(locationListQuerySchema, searchParamsToObject(request));
  return jsonOk({ data: await listLocations(query) });
});
