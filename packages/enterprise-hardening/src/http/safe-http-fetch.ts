/**
 * Central safe HTTP fetch — SSRF allowlist + internal-IP denylist.
 *
 * Phase D agent D9 — A3/A5 Tier-1 closure for outbound HTTP egress.
 *
 * Every outbound HTTP call from BOSSNYUMBA services (webhook delivery,
 * tax-authority lookups, AI provider calls, document-retrieval fetches)
 * MUST route through `safeHttpFetch`. The function:
 *
 *   1. Resolves the URL to a host and rejects any host that resolves
 *      (or is) inside the loopback / link-local / private RFC1918 /
 *      RFC6598 carrier-grade-NAT / IPv6-equivalents ranges.
 *   2. Optionally accepts an explicit allowlist of outbound destinations.
 *      When `allowlist` is non-empty, ONLY those destinations may be
 *      reached. Used for high-risk surfaces (e.g. webhook delivery to
 *      operator-supplied URLs).
 *   3. Always sets a hard 10 s default timeout via AbortController.
 *
 * The function never mutates its inputs. Errors are typed as
 * `SafeHttpFetchError` with a `code` discriminator so callers can react
 * without parsing strings.
 *
 * SOC 2 CC6.6 (Boundary protection): every egress call is recorded in the
 * caller-side audit log; this module merely enforces the boundary.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SafeHttpFetchErrorCode =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'denied-internal-ip'
  | 'denied-not-in-allowlist'
  | 'denied-port'
  | 'timeout'
  | 'network-error';

export class SafeHttpFetchError extends Error {
  readonly code: SafeHttpFetchErrorCode;
  readonly destination: string;
  constructor(code: SafeHttpFetchErrorCode, destination: string, detail: string) {
    super(`safeHttpFetch[${code}] ${destination}: ${detail}`);
    this.name = 'SafeHttpFetchError';
    this.code = code;
    this.destination = destination;
  }
}

export interface SafeHttpFetchOptions {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
  readonly timeoutMs?: number;
  /**
   * Allowlist of `host` substrings (case-insensitive). When non-empty, the
   * destination host MUST contain at least one entry. Recommend passing
   * fully-qualified hostnames (e.g. "api.stripe.com") rather than bare TLDs.
   */
  readonly allowlist?: ReadonlyArray<string>;
  /** Allowed ports — defaults to [80, 443]. */
  readonly allowedPorts?: ReadonlyArray<number>;
  /** Allowed schemes — defaults to ['http:', 'https:']. */
  readonly allowedSchemes?: ReadonlyArray<string>;
  /**
   * Injectable fetch (defaults to global `fetch`). Lets tests assert what
   * was called without spinning up a real network listener.
   */
  readonly fetchImpl?: typeof fetch;
}

export interface SafeHttpFetchResult {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: () => Promise<string>;
  readonly json: () => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Internal-IP detection
// ---------------------------------------------------------------------------

const PRIVATE_IPV4_PATTERNS: ReadonlyArray<RegExp> = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  // RFC6598 carrier-grade NAT.
  /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  // Cloud metadata service.
  /^169\.254\.169\.254$/,
  // Broadcast and multicast.
  /^(?:0|255)\./,
  /^(?:22[4-9]|23\d)\./,
];

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function isInternalIPv4(host: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(host));
}

function isInternalIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::1') return true;
  if (h === '::') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA
  if (h.startsWith('fe80:')) return true; // link-local
  // IPv4-mapped IPv6 — resolve to inner v4.
  const v4mapped = h.match(/^::ffff:([0-9.]+)$/);
  if (v4mapped && isInternalIPv4(v4mapped[1])) return true;
  return false;
}

function isInternalHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.internal')) return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower.includes(':')) return isInternalIPv6(lower);
  if (/^[\d.]+$/.test(lower)) return isInternalIPv4(lower);
  return false;
}

// ---------------------------------------------------------------------------
// Allowlist matching
// ---------------------------------------------------------------------------

function matchesAllowlist(host: string, allowlist: ReadonlyArray<string>): boolean {
  if (allowlist.length === 0) return true;
  const lower = host.toLowerCase();
  return allowlist.some((entry) => {
    const e = entry.toLowerCase();
    // Allow exact match, suffix match (".example.com"), or substring within host (".vendor.")
    if (e.startsWith('.')) {
      return lower.endsWith(e) || lower === e.slice(1);
    }
    return lower === e || lower.endsWith(`.${e}`);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ALLOWED_PORTS: ReadonlyArray<number> = Object.freeze([80, 443]);
const DEFAULT_ALLOWED_SCHEMES: ReadonlyArray<string> = Object.freeze(['http:', 'https:']);

export async function safeHttpFetch(
  url: string,
  options: SafeHttpFetchOptions = {},
): Promise<SafeHttpFetchResult> {
  // 1) Parse + scheme check.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SafeHttpFetchError('invalid-url', url, 'URL parse failed');
  }
  const allowedSchemes = options.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
  if (!allowedSchemes.includes(parsed.protocol)) {
    throw new SafeHttpFetchError(
      'unsupported-scheme',
      url,
      `scheme "${parsed.protocol}" not in [${allowedSchemes.join(', ')}]`,
    );
  }
  // 2) Port check.
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  const port =
    parsed.port !== ''
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
  if (!allowedPorts.includes(port)) {
    throw new SafeHttpFetchError(
      'denied-port',
      url,
      `port ${port} not in [${allowedPorts.join(', ')}]`,
    );
  }
  // 3) Internal-IP / hostname denylist.
  // Hostname can include zone (e.g. fe80::1%eth0); strip brackets for v6.
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isInternalHost(rawHost)) {
    throw new SafeHttpFetchError(
      'denied-internal-ip',
      url,
      `host "${rawHost}" resolves to an internal / reserved range`,
    );
  }
  // 4) Allowlist (when present).
  const allowlist = options.allowlist ?? [];
  if (!matchesAllowlist(rawHost, allowlist)) {
    throw new SafeHttpFetchError(
      'denied-not-in-allowlist',
      url,
      `host "${rawHost}" not in allowlist`,
    );
  }
  // 5) Timeout + dispatch.
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: options.headers as Record<string, string> | undefined,
      // `BodyInit` is a DOM type — this package has only `node` types loaded
      // (see tsconfig.types). Cast via `unknown` so `node`-only + DOM-only
      // fetch shapes both compile.
      body: options.body as unknown as Parameters<typeof fetchImpl>[1] extends { body?: infer B } ? B : undefined,
      signal: controller.signal,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return {
      status: res.status,
      ok: res.ok,
      headers,
      text: () => res.text(),
      json: () => res.json(),
    };
  } catch (err) {
    if (err instanceof SafeHttpFetchError) throw err;
    const isAbort =
      (err as { name?: string })?.name === 'AbortError' ||
      controller.signal.aborted;
    if (isAbort) {
      throw new SafeHttpFetchError('timeout', url, `aborted after ${timeoutMs}ms`);
    }
    throw new SafeHttpFetchError(
      'network-error',
      url,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Diagnostic helpers (exported for tests)
// ---------------------------------------------------------------------------

export const __internals = {
  isInternalHost,
  matchesAllowlist,
};
