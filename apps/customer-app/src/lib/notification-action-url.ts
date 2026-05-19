/**
 * Notification `actionUrl` validator (customer-app copy).
 *
 * Closes round-3 finding H-4: see
 * `apps/estate-manager-app/src/lib/notification-action-url.ts` for the
 * full reasoning. The two files are intentionally identical until a
 * shared `packages/design-system` helper lands.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function isSafeNotificationActionUrl(
  url: string | null | undefined,
): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.includes('\r') || url.includes('\n')) return false;
  if (SCHEME_RE.test(url)) return false;
  if (url.charAt(0) !== '/') return false;
  if (url.charAt(1) === '/') return false;
  if (url.charAt(1) === '\\') return false;
  return true;
}
