/**
 * Safe `mailto:` / `tel:` URL builders for customer-app.
 *
 * Closes round-3 frontend audit findings **M-6** and **M-7**.
 *
 * See `apps/estate-manager-app/src/lib/safe-contact-link.ts` for the
 * canonical pattern; this is the customer-app copy so each app can be
 * deployed without a cross-app import.
 */

const SAFE_TEL_RE = /^[+\d\s().-]{3,30}$/;
const SAFE_EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]{2,}$/;

export function safeMailtoHref(email: string | null | undefined): string | undefined {
  if (typeof email !== 'string') return undefined;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return undefined;
  if (!SAFE_EMAIL_RE.test(trimmed)) return undefined;
  if (trimmed.includes('?') || trimmed.includes('&') || /[\r\n]/.test(trimmed)) {
    return undefined;
  }
  return `mailto:${encodeURIComponent(trimmed)}`;
}

export function safeTelHref(phone: string | null | undefined): string | undefined {
  if (typeof phone !== 'string') return undefined;
  const trimmed = phone.trim();
  if (trimmed.length === 0) return undefined;
  if (!SAFE_TEL_RE.test(trimmed)) return undefined;
  if (/[,;*#]/.test(trimmed)) return undefined;
  const compact = trimmed.replace(/\s/g, '');
  return `tel:${compact}`;
}
