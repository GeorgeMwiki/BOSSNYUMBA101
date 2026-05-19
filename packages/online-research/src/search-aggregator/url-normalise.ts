/**
 * URL normalisation — used as the dedup key when merging hits from
 * multiple providers.
 *
 * Rules (in order):
 *   1. Lowercase scheme + host.
 *   2. Strip default ports (:80 for http, :443 for https).
 *   3. Strip well-known tracking params (utm_*, fbclid, gclid, ref_).
 *   4. Strip URL fragment.
 *   5. Strip trailing slash on path EXCEPT root.
 *   6. Sort remaining query params alphabetically for stable ordering.
 *
 * Returns the normalised string OR `null` if the URL is unparseable
 * (in which case the caller falls back to URL.toString() as the key).
 */

const TRACKING_PARAM_PREFIXES = ['utm_', 'ref_'];
const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'mc_eid',
  'mc_cid',
  'yclid',
  '_ga',
  '_gl',
]);

export function normaliseUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  // Lowercase scheme + host.
  url.protocol = url.protocol.toLowerCase();
  url.host = url.host.toLowerCase();

  // Strip default ports.
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  // Strip fragment.
  url.hash = '';

  // Strip + sort query params.
  const params = new URLSearchParams(url.search);
  const cleaned = new URLSearchParams();
  const keys: string[] = [];
  for (const key of params.keys()) {
    if (TRACKING_PARAM_EXACT.has(key)) {
      continue;
    }
    const isPrefixTracked = TRACKING_PARAM_PREFIXES.some((p) => key.startsWith(p));
    if (isPrefixTracked) {
      continue;
    }
    keys.push(key);
  }
  keys.sort();
  for (const key of keys) {
    for (const value of params.getAll(key)) {
      cleaned.append(key, value);
    }
  }
  url.search = cleaned.toString();

  // Strip trailing slash on path except root.
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
