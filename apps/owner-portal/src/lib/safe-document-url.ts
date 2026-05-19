/**
 * Document URL validator (signed S3 / CDN URLs).
 *
 * Closes round-3 finding H-5: compliance / damage-deduction pages
 * rendered `<a href={d.url}>` with no URL validation, so a malformed
 * (or attacker-supplied) URL field could become an open redirect or
 * trigger `javascript:` execution.
 *
 * Rules:
 *   - URL MUST parse via `new URL(...)`
 *   - protocol MUST be `https:` (we never serve documents over http)
 *   - hostname MUST match an allow-list when one is configured via
 *     `VITE_DOCUMENT_HOSTS` (comma-separated). When unset we accept
 *     any https host — useful for dev but should be configured in
 *     production.
 */

function getAllowedHosts(): ReadonlyArray<string> {
  // Vite injects this env var; defined only on the client.
  const raw = import.meta.env?.VITE_DOCUMENT_HOSTS;
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

export function isSafeDocumentUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const allowed = getAllowedHosts();
    if (allowed.length === 0) return true;
    return allowed.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
