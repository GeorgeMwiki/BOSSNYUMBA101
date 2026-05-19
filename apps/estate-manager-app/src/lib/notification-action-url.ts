/**
 * Notification `actionUrl` validator.
 *
 * Closes round-3 finding H-4: customer / estate-manager notification
 * `actionUrl` fields were rendered into Next `<Link href={…}>` without
 * any validation. A backend-emitted `javascript:alert(1)` or
 * `data:text/html,...` would execute, and any absolute external URL
 * would be an open redirect.
 *
 * Allow-list rules (must ALL pass):
 *   1. Path MUST start with `/`
 *   2. Path MUST NOT start with `//` (protocol-relative URL)
 *   3. Path MUST NOT start with `/\` (back-slash bypass)
 *   4. Path MUST NOT contain a scheme (`javascript:`, `data:`, `http:`, ...)
 *   5. Path MUST NOT contain CR/LF (header-injection)
 *
 * The single source of truth lives here and in
 * `apps/customer-app/src/lib/notification-action-url.ts`. Keep them in
 * sync; they may be promoted to `packages/design-system` in a later
 * pass.
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
