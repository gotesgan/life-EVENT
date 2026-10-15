import { apiHandler, jsonOk } from '@/lib/api/response';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { adminGetEnquiryMetrics } from '@/server/services/admin-enquiry.service';
import { adminListListings } from '@/server/services/listing.service';

/**
 * GET /api/admin/overview
 *
 * Operational metrics plus the five most recently touched listings for the
 * admin landing page. Authorisation is enforced by `requireAdmin` inside the
 * actor helper.
 */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const [metrics, recent] = await Promise.all([
    adminGetEnquiryMetrics(),
    adminListListings({ page: 1, pageSize: 5 }),
  ]);

  return jsonOk({ metrics, recentListings: recent.rows });
});
