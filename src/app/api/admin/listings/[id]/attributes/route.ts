import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { listingAttributeValuesSchema } from '@/lib/validation/listing';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import {
  getAttributeEditorFields,
  adminSetListingAttributeValues,
} from '@/server/services/attribute.service';
import { adminGetListing } from '@/server/services/listing.service';

/**
 * GET /api/admin/listings/[id]/attributes
 *
 * The editor fields for the listing's categories (inherited bindings included)
 * plus the values already stored, so the form can render in one round trip.
 */
export const GET = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);

    const listing = await adminGetListing(id);
    const fields = await getAttributeEditorFields(
      listing.categories.map((link) => link.categoryId),
    );

    return jsonOk({
      data: {
        fields,
        values: listing.attributeValues,
      },
    });
  },
);

/** PUT /api/admin/listings/[id]/attributes — replace the attribute values. */
export const PUT = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const { values } = await readJsonBody(request, listingAttributeValuesSchema);

    return jsonOk({
      data: await adminSetListingAttributeValues({ listingId: id, values, actor }),
    });
  },
);
