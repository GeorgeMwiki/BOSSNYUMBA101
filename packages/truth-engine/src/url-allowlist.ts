/**
 * Outbound URL SSRF guard (BossNyumba wiring)
 *
 * The ported `@/lib/url-allowlist` exposed
 * `validateOutboundUrlWithDns(url) => Promise<{ ok, reason? }>` — a DNS-aware
 * SSRF guard that rejects URLs whose host resolves into private / link-local
 * space (rebind / IPv4-mapped pivots), with bad schemes or ports.
 *
 * BossNyumba's canonical SSRF primitive is `@bossnyumba/enterprise-hardening`'s
 * `assertUrlSafe(url, opts)`, which screens scheme, port, the internal-host
 * string gate, and the DNS-resolved IP set. It throws `SafeHttpFetchError` on
 * the first failure rather than returning a boolean.
 *
 * Domain allow-listing for the truth engine is handled separately by
 * `security.assertFetchAllowed`, so we deliberately pass NO allowlist here:
 * `assertUrlSafe` treats an empty allowlist as allow-all, leaving only the
 * pure SSRF gates active — exactly the contract the ported guard provided.
 */

import { assertUrlSafe, SafeHttpFetchError } from "@bossnyumba/enterprise-hardening";

export interface OutboundUrlCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Validate an outbound URL through the canonical DNS-aware SSRF guard.
 * Returns `{ ok: true }` when safe, `{ ok: false, reason }` otherwise.
 * Never throws.
 */
export async function validateOutboundUrlWithDns(
  url: string,
): Promise<OutboundUrlCheck> {
  try {
    await assertUrlSafe(url);
    return { ok: true };
  } catch (err) {
    if (err instanceof SafeHttpFetchError) {
      return { ok: false, reason: `${err.code}: ${err.message}` };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "ssrf_check_failed",
    };
  }
}
