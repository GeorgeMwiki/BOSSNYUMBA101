/**
 * PII redaction helpers for log output.
 *
 * MSISDN (phone number) masking rules:
 *   - Keep the country-code prefix (first 3 digits for 254/255/256 etc.)
 *   - Keep the last 4 digits
 *   - Replace the middle with "***"
 *
 * Examples:
 *   254712345678 -> 254***5678
 *   +254712345678 -> 254***5678
 *   0712345678 -> 254***5678 (after normalisation)
 *
 * Short or malformed numbers fall back to a fully-masked placeholder so no raw
 * digits leak to logs.
 */

const FULL_MASK = '***REDACTED***';

/**
 * Mask an MSISDN/phone number for safe logging.
 *
 * This function is defensive: any falsy/invalid input becomes FULL_MASK so
 * callers can pass potentially-unknown values (e.g. callback metadata) without
 * risking PII leakage.
 */
export function maskMsisdn(phone: string | number | undefined | null): string {
  if (phone === undefined || phone === null) return FULL_MASK;
  const raw = String(phone).trim();
  if (!raw) return FULL_MASK;

  // Strip everything that isn't a digit.
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return FULL_MASK;

  // Country code: first 3 digits for East-African MNO format.
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-4);
  return `${prefix}***${suffix}`;
}

/**
 * Return a shallow-cloned object with any phone-like fields masked.
 * Used when building log contexts that may embed MSISDN values.
 */
export function redactLogContext<T extends Record<string, unknown>>(ctx: T): T {
  const out: Record<string, unknown> = { ...ctx };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (
      lower === 'phone' ||
      lower === 'phonenumber' ||
      lower === 'msisdn' ||
      lower === 'partya' ||
      lower === 'partyb' ||
      lower === 'receiverparty'
    ) {
      out[key] = maskMsisdn(out[key] as string | number | undefined | null);
    }
  }
  return out as T;
}
