/**
 * URL scheme guard for any model/data-authored href rendered by a genui
 * component (citations, evidence links, file/pdf "open" links).
 *
 * The render vocabulary is closed + schema-validated, but a URL string still
 * passes schema with a `javascript:` / `data:` / `vbscript:` scheme — which
 * becomes a stored-XSS vector the moment it lands in an `<a href>`. safeUrl()
 * returns the url ONLY when it resolves to an http(s) / mailto / tel scheme or
 * a same-document relative ref (`/…`, `#…`, `./…`, `../…`); otherwise it
 * returns undefined so the caller renders a non-navigable label instead of an
 * executable href.
 *
 * This is the ONE guard for the whole package — every data-driven href routes
 * through it, kept in lock-step with `__tests__/markdown-card.xss.test.tsx`.
 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;
const RELATIVE = /^(?:\/|#|\.\/|\.\.\/)/;
// Control/whitespace chars an attacker injects to dodge the prefix check
// (e.g. "java\tscript:" or a leading NUL). Strip before classifying scheme.
const CONTROL = /[\x00-\x20\x7f-\x9f]/g;

export function safeUrl(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const classify = trimmed.replace(CONTROL, '');
  if (RELATIVE.test(classify) || SAFE_SCHEME.test(classify)) return trimmed;
  return undefined;
}
