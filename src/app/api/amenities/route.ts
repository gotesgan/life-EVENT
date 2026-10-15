import { apiHandler, jsonOk } from '@/lib/api/response';
import { listAmenities } from '@/server/services/catalog.service';

/** GET /api/amenities — active amenities for the search sidebar and filters. */
export const GET = apiHandler(async () => {
  return jsonOk({ data: await listAmenities() });
});
