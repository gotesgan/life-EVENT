import { apiHandler, jsonOk } from '@/lib/api/response';
import { listEventTypes } from '@/server/services/catalog.service';

/** GET /api/event-types — active event types for the search sidebar. */
export const GET = apiHandler(async () => {
  return jsonOk({ data: await listEventTypes() });
});
