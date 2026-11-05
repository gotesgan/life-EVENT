import { apiHandler, jsonCreated, readJsonBody } from '@/lib/api/response';
import { vendorOnboardingMediaPresignSchema } from '@/lib/validation/vendor-invite';
import { requestVendorOnboardingUpload } from '@/server/services/vendor-onboarding-media.service';

export const POST = apiHandler(async (request) => {
  const input = await readJsonBody(request, vendorOnboardingMediaPresignSchema);
  return jsonCreated({ data: await requestVendorOnboardingUpload(input) });
});
