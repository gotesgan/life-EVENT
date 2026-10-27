import { apiHandler, jsonCreated, readJsonBody } from '@/lib/api/response';
import { getClientIp } from '@/lib/client-ip';
import { createVendorApplicationSchema } from '@/lib/validation/vendor-application';
import { createVendorApplication } from '@/server/services/vendor-application.service';

/**
 * POST /api/vendor-applications — public vendor self-registration.
 *
 * Public by design: the supply side of the marketplace has to be reachable
 * without an account, so there is no actor here. Abuse is handled inside the
 * service (fixed-window rate limit per hashed IP plus a honeypot) rather than by
 * authentication.
 */
export const POST = apiHandler(async (request) => {
  const input = await readJsonBody(request, createVendorApplicationSchema);

  await createVendorApplication(input, {
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  });

  return jsonCreated({ data: { received: true } });
});
