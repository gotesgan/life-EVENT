import { apiHandler, jsonOk } from '@/lib/api/response';
import { getMetaSettings } from '@/server/services/settings.service';

/**
 * GET /api/public-config — the small amount of integration configuration the
 * browser genuinely needs.
 *
 * Only non-secret values are returned (the Pixel ID). The Conversions API token
 * never leaves the server. `no-store` because the value is edited in the admin
 * panel and must take effect on the next page load.
 */
export const GET = apiHandler(async () => {
  const meta = await getMetaSettings();

  return jsonOk(
    { data: { metaPixelId: meta.enabled ? meta.pixelId : null } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
