import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { slugSchema } from '@/lib/validation/common';
import { getPublicListingBySlug } from '@/server/services/listing.service';

/**
 * GET /api/listings/[slug]
 *
 * The service throws `NotFoundError` for draft, unpublished and archived
 * listings, so a guessed slug cannot reveal a draft.
 */
export const GET = apiHandler<{ slug: string }>(
  async (_request, context: RouteContext<{ slug: string }>) => {
    const slug = slugSchema.parse((await context.params).slug);
    const listing = await getPublicListingBySlug(slug);

    return jsonOk({ data: listing });
  },
);
