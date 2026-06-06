/**
 * M-Pesa receipt resource URL — deterministic, host-stable.
 *
 * Why this exists:
 *   The `PaymentIntent.receiptUrl` field is validated with `z.string().url()`
 *   (see `@bossnyumba/domain-models` `PaymentIntentSchema`) and the
 *   api-gateway receipt endpoint (`GET /payments/:id/receipt`) returns it
 *   verbatim as `{ url: intent.receiptUrl }`. Stripe populates this with the
 *   hosted charge receipt URL.
 *
 *   M-Pesa (STK + C2B) does not issue a hosted receipt page — Daraja only
 *   returns a receipt NUMBER (`MpesaReceiptNumber` / `TransID`). Passing that
 *   bare number through as `receiptUrl` (a) violates the `.url()` contract and
 *   (b) leaves the gateway receipt endpoint at 409 (`RECEIPT_NOT_READY`)
 *   because `!intent.receiptUrl` is effectively never the real failure — the
 *   value is present but is not a resolvable receipt resource.
 *
 *   This builds a deterministic receipt RESOURCE URL that embeds the real
 *   receipt number, so:
 *     - the `.url()` schema is satisfied,
 *     - the gateway receipt endpoint resolves (200 with a usable URL),
 *     - the authoritative receipt number is recoverable from the URL path.
 *
 * Extracted from `server.ts` (mirrors `lib/platform-fee.ts`) so it can be
 * unit-tested as a pure function without the express / pino / orchestration
 * import graph.
 */

export interface MpesaReceiptEnvLike {
  /** Public base URL where receipt resources are served. */
  readonly PAYMENTS_RECEIPT_BASE_URL?: string;
  readonly NODE_ENV?: string;
}

/**
 * Fallback base used in dev/test when `PAYMENTS_RECEIPT_BASE_URL` is unset.
 * Production callers SHOULD set the env var; we never hard-code a tenant-,
 * currency-, or jurisdiction-specific value here.
 */
export const MPESA_RECEIPT_DEFAULT_BASE_URL = 'https://receipts.bossnyumba.app';

/**
 * Normalise a base URL: strip any trailing slashes so path joins are stable.
 * Returns null if the configured value is not a usable absolute http(s) URL.
 */
function normaliseBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * Build a deterministic M-Pesa receipt resource URL from the actual
 * Daraja receipt number (STK `MpesaReceiptNumber` or C2B `TransID`).
 *
 * Returns `undefined` when no receipt number is available (e.g. a
 * failed/cancelled STK push issues none) so the caller leaves `receiptUrl`
 * unset rather than minting a URL that points at nothing — the gateway then
 * correctly reports the receipt as not ready.
 *
 * @param receiptNumber  the raw Daraja receipt number; trimmed, must be
 *   non-empty after trimming.
 * @param env  process env (defaults to `process.env`); only read here so the
 *   rest of the module stays pure.
 */
export function buildMpesaReceiptUrl(
  receiptNumber: string | undefined | null,
  env: MpesaReceiptEnvLike = process.env,
): string | undefined {
  const trimmed = receiptNumber?.trim();
  if (!trimmed) return undefined;

  const base =
    normaliseBaseUrl(env.PAYMENTS_RECEIPT_BASE_URL) ??
    MPESA_RECEIPT_DEFAULT_BASE_URL;

  // Encode the receipt number so an unexpected character cannot break the
  // path or smuggle a second path segment.
  return `${base}/receipts/mpesa/${encodeURIComponent(trimmed)}`;
}
