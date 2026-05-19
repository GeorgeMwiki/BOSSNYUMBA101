/**
 * Safe `mailto:` / `tel:` URL builders for estate-manager-app.
 *
 * Closes round-3 frontend audit findings **M-6** and **M-7**:
 *   - M-6: `<a href={`mailto:${customer.email}`}>` would let a backend-
 *     sourced email like `victim@example.com?subject=Phish&body=…`
 *     silently inject mail-client fields. We now percent-encode the
 *     address and reject inputs containing CR/LF/`?`/`&`.
 *   - M-7: `<a href={`tel:${phone.replace(/\s/g,'')}`}>` would let a
 *     backend phone like `0712,1234;ext=999` route to an unintended
 *     extension. We now strict-allowlist the dial-string charset to
 *     digits, `+`, `-`, and `(` `)` `.` only.
 *
 * Both helpers return `undefined` for inputs that fail validation so
 * callers can fall back to rendering plain text without a link.
 */

const SAFE_TEL_RE = /^[+\d\s().-]{3,30}$/;
const SAFE_EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]{2,}$/;

/**
 * Returns a safe `mailto:` href for `email`, or `undefined` if the input
 * fails minimal email validation. The result is percent-encoded so any
 * residual quirk character cannot inject `?subject=` / `?body=`.
 */
export function safeMailtoHref(email: string | null | undefined): string | undefined {
  if (typeof email !== 'string') return undefined;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return undefined;
  if (!SAFE_EMAIL_RE.test(trimmed)) return undefined;
  // No `?` injection — even if the address survived the regex.
  if (trimmed.includes('?') || trimmed.includes('&') || /[\r\n]/.test(trimmed)) {
    return undefined;
  }
  return `mailto:${encodeURIComponent(trimmed)}`;
}

/**
 * Returns a safe `tel:` href for `phone`, or `undefined` if the input
 * contains characters that are not valid in a dial string. Strips spaces
 * and normalises but does NOT accept `;` (extension/pause) or `,`
 * (DTMF pause) — those let a backend-sourced number reach a different
 * extension than the displayed digits suggest.
 */
export function safeTelHref(phone: string | null | undefined): string | undefined {
  if (typeof phone !== 'string') return undefined;
  const trimmed = phone.trim();
  if (trimmed.length === 0) return undefined;
  if (!SAFE_TEL_RE.test(trimmed)) return undefined;
  // Reject extension separators and DTMF pauses that the strict regex
  // already forbids — belt and braces in case the regex is ever loosened.
  if (/[,;*#]/.test(trimmed)) return undefined;
  const compact = trimmed.replace(/\s/g, '');
  return `tel:${compact}`;
}
