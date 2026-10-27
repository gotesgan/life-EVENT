import { apiHandler, jsonOk, parseInput, searchParamsToObject } from '@/lib/api/response';
import { REVEAL_COOKIE, publicListingCards, readRevealedSlugs } from '@/lib/listing-privacy';
import { searchQuerySchema } from '@/lib/validation/search';
import { searchPublicListings } from '@/server/services/search.service';

/**
 * GET /api/listings — public search.
 *
 * The reserved query parameters are validated by `searchQuerySchema`;
 * category-specific `f.<code>` filters are validated inside the service against
 * the active category's declared filter definitions, because their meaning
 * depends on that category.
 *
 * Names are masked against the requester's reveal cookie, exactly as the HTML
 * surfaces do: a JSON client must not be a way around the enquiry gate.
 */
export const GET = apiHandler(async (request) => {
  const rawParams = searchParamsToObject(request);
  const query = parseInput(searchQuerySchema, rawParams);

  const result = await searchPublicListings({
    query,
    rawParams,
    basePath: '/api/listings',
  });
  // Read the reveal cookie off the request rather than `next/headers`: a Route
  // Handler already has the request, and `cookies()` throws outside a request
  // scope (which is how the route is exercised in tests).
  const revealed = new Set(readRevealedSlugs(request.cookies.get(REVEAL_COOKIE)?.value));

  return jsonOk({ ...result, cards: publicListingCards(result.cards, revealed) });
});
