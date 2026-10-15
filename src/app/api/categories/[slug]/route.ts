import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { slugSchema } from '@/lib/validation/common';
import { getCategoryDetail } from '@/server/services/catalog.service';

/** GET /api/categories/[slug] — a category with its children and filter set. */
export const GET = apiHandler<{ slug: string }>(
  async (_request, context: RouteContext<{ slug: string }>) => {
    const slug = slugSchema.parse((await context.params).slug);

    const detail = await getCategoryDetail(slug);
    return jsonOk({ data: detail });
  },
);
