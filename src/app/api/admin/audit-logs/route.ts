import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { buildPaginated } from '@/lib/pagination';
import { adminAuditQuerySchema } from '@/lib/validation/enquiry';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { listAuditLogs } from '@/server/services/audit.service';

/**
 * GET /api/admin/audit-logs
 *
 * The audit service returns raw rows plus a total; the standard `{ data,
 * pagination }` envelope is assembled here so the endpoint matches every other
 * list.
 */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);
  const query = parseInput(adminAuditQuerySchema, searchParamsToObject(request));

  const { rows, totalItems } = await listAuditLogs(query);
  const { pagination } = buildPaginated(rows, totalItems, query.page, query.pageSize);

  return jsonOk({ data: rows, pagination });
});
