import { apiHandler, jsonCreated, readJsonBody } from '@/lib/api/response';
import { getClientIp } from '@/lib/client-ip';
import { vendorOnboardingSchema } from '@/lib/validation/vendor-invite';
import { submitVendorOnboarding } from '@/server/services/vendor-invite.service';

/**
 * POST /api/vendor-onboarding — the private form behind an invite link.
 *
 * Public by design (the vendor has no account): the token is the credential, and
 * the service verifies it is real, unused, unrevoked and unexpired before it
 * writes. Rate limited per hashed IP and honeypotted like the public form.
 */
export const POST = apiHandler(async (request) => {
  const input = await readJsonBody(request, vendorOnboardingSchema);
  const result = await submitVendorOnboarding(input, {
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  });

  return jsonCreated({ data: result });
});
