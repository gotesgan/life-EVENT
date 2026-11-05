import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { vendorOnboardingMediaCompleteSchema } from '@/lib/validation/vendor-invite';
import { completeVendorOnboardingUpload } from '@/server/services/vendor-onboarding-media.service';

export const POST = apiHandler<{ mediaId: string }>(
  async (request, context: RouteContext<{ mediaId: string }>) => {
    const mediaId = idSchema.parse((await context.params).mediaId);
    const input = await readJsonBody(request, vendorOnboardingMediaCompleteSchema);
    return jsonOk({ data: await completeVendorOnboardingUpload({ ...input, mediaId }) });
  },
);
