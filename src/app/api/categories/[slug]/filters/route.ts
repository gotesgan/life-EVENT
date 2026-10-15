import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { slugSchema } from '@/lib/validation/common';
import { getFilterDefinitionsForCategory } from '@/server/services/catalog.service';

/**
 * GET /api/categories/[slug]/filters
 *
 * The filters a category declares (including ones inherited from ancestors).
 * The frontend renders controls from this metadata, so a new filter is a data
 * change rather than a deployment.
 */
export const GET = apiHandler<{ slug: string }>(
  async (_request, context: RouteContext<{ slug: string }>) => {
    const slug = slugSchema.parse((await context.params).slug);
    const definitions = await getFilterDefinitionsForCategory(slug);

    return jsonOk({ data: definitions });
  },
);
