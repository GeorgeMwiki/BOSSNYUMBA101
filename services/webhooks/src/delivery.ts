/**
 * HTTP delivery with HMAC-SHA256 signatures for webhook payloads.
 *
 * Production-hardened: exponential backoff + jitter on retryable failures
 * (network error, 408, 429, 5xx). Caller can opt out with retries=0.
 *
 * SSRF protection: every outbound URL is validated before the request
 * fires. We reject non-http(s) schemes, any host that resolves/parses to
 * a private, loopback, link-local, or cloud-metadata address, and any
 * URL whose hostname is missing. Enforcement is controlled by
 * `WEBHOOK_SSRF_ALLOW_PRIVATE=true` so local dev can still POST to
 * `http://localhost:...` when that env flag is set; production must
 * leave it unset.
 */

import CryptoJS from 'crypto-js';
import { lookup as dnsLookup } from 'node:dns/promises';

const DEFAULT_TIMEOUT_MS = 10_000;

// Link-local, loopback, RFC1918, cloud metadata, and carrier NAT ranges.
// Any literal host matching one of these is refused in production mode.
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,          // link-local / AWS/Azure/GCP metadata (169.254.169.254)
  /^100\.64\./,           // carrier-grade NAT
  /^0\./,                 // unspecified
  /^::1$/,                // IPv6 loopback
  /^fe80:/i,              // IPv6 link-local
  /^fc00:/i, /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  /^::$/,                 // IPv6 unspecified
  /^::ffff:(?:127\.|10\.|192\.168\.|169\.254\.|100\.64\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/i, // IPv4-mapped IPv6
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
];

export class SsrfBlockedError extends Error {
  constructor(url: string, reason: string) {
    super(`SSRF_BLOCKED: ${reason} (url=${url})`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Validate a webhook target URL. Throws SsrfBlockedError on violation.
 * Pure, side-effect-free — callers use it for both deliver() and the
 * subscribe() admission check.
 */
/**
 * Synchronous structural + literal-host SSRF check. Parses the URL, enforces
 * http(s), and rejects literal internal hosts/IPs. Used at `subscribe()`
 * admission for a fast synchronous reject. `deliver()` additionally runs the
 * DNS-aware check (`assertSafeWebhookUrl`) at request time, which is where
 * SSRF must ultimately be enforced (DNS can change between subscribe and send).
 */
export function assertWebhookUrlShape(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(rawUrl, 'invalid_url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(rawUrl, `scheme_not_allowed:${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (!host) {
    throw new SsrfBlockedError(rawUrl, 'missing_host');
  }
  if (process.env.WEBHOOK_SSRF_ALLOW_PRIVATE === 'true') {
    // Dev/test escape hatch — never set this in production.
    return parsed;
  }
  // Literal-host check — blocks IP-literals and known-internal names.
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) {
      throw new SsrfBlockedError(rawUrl, `host_blocked:${host}`);
    }
  }
  return parsed;
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  const parsed = assertWebhookUrlShape(rawUrl);
  if (process.env.WEBHOOK_SSRF_ALLOW_PRIVATE === 'true') {
    return parsed;
  }
  const host = parsed.hostname;
  // DNS-aware check — resolve the hostname and reject if ANY resolved
  // address is internal. Closes the DNS-rebind bypass where an
  // attacker-controlled name has an A/AAAA record pointing at 169.254.169.254
  // (cloud metadata), 127.0.0.1, or an RFC1918 host — the literal check above
  // can't see those because the hostname itself isn't on the blocklist. On a
  // resolution error we allow: the fetch will fail naturally and blocking
  // transient DNS would drop legitimate webhooks.
  let resolved: ReadonlyArray<{ readonly address: string }>;
  try {
    resolved = await dnsLookup(host, { all: true });
  } catch {
    return parsed;
  }
  for (const { address } of resolved) {
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(address)) {
        throw new SsrfBlockedError(rawUrl, `resolved_host_blocked:${host}->${address}`);
      }
    }
  }
  return parsed;
}

export interface DeliveryOptions {
  timeoutMs?: number;
  /** Maximum retry attempts (default 3). */
  retries?: number;
  /** Base backoff in ms (default 500). */
  retryBaseMs?: number;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export function signPayload(payload: string, secret: string): string {
  return CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
}

function isRetryable(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

async function deliverOnce(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok
      ? { success: true, statusCode: res.status }
      : { success: false, statusCode: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function deliver(
  url: string,
  payload: object,
  secret?: string,
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  // SSRF guard BEFORE any network activity. A malicious subscriber
  // pointing at 169.254.169.254 or 127.0.0.1:6379 must be refused here,
  // not at the socket layer where error shape could leak internal state.
  try {
    await assertSafeWebhookUrl(url);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'ssrf_blocked',
    };
  }

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': new Date().toISOString(),
  };
  if (secret) {
    headers['X-Webhook-Signature'] = `sha256=${signPayload(body, secret)}`;
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, (options.retries ?? 3) + 1);
  const baseMs = options.retryBaseMs ?? 500;

  let last: DeliveryResult = { success: false, error: 'no_attempt' };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await deliverOnce(url, body, headers, timeoutMs);
    if (r.success) return r;
    last = r;
    if (!isRetryable(r.statusCode) || attempt === maxAttempts - 1) return r;
    const backoff = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
  return last;
}
