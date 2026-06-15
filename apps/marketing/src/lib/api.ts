/**
 * API base-URL resolver for the marketing site.
 *
 * The marketing site is the public surface; outbound writes (lead
 * signup) go to the api-gateway. Two topologies are supported:
 *
 *   - PRODUCTION (default, no env): the empty base URL keeps requests
 *     SAME-ORIGIN (`/api/v1/...` on bossnyumba.com). The edge nginx
 *     (`docker/nginx.prod.conf`, the `bossnyumba.com` vhost) has an
 *     `/api/v1/` `proxy_pass http://api_gateway` block that forwards
 *     these to the gateway, so the funnel works WITHOUT a build-time
 *     env. If you change/remove that nginx block, this same-origin path
 *     breaks — keep the two in sync.
 *   - OVERRIDE (local dev / split-origin deploys): set
 *     `NEXT_PUBLIC_API_GATEWAY_URL` (e.g. http://127.0.0.1:4001) and
 *     requests go cross-origin to that absolute base instead.
 *
 * We refuse to hard-code a localhost URL so the deploy artefact stays
 * environment-pure — same pattern as owner-portal's `OwnerContactStep`.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return '';
}
