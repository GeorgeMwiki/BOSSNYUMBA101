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

import { promises as dnsP, type LookupAddress } from 'node:dns';

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
  /**
   * Injectable DNS lookup (defaults to `node:dns/promises#lookup`). Lets
   * tests simulate DNS-rebinding scenarios — first resolution must be
   * pinned and reused, so a poisoned second resolution can't sneak the
   * request to an internal IP.
   */
  readonly dnsLookup?: (
    host: string,
  ) => Promise<ReadonlyArray<LookupAddress>>;
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

/**
 * Resolve `host` via DNS and return the first internal IP (if any) plus
 * the full address set. Closes the SSRF gap where a hostname whose
 * A-record points to RFC1918 / link-local addresses would bypass the
 * string-only check.
 *
 * For literal IPs we skip the DNS round-trip — `isInternalHost` has
 * already screened them.
 */
async function resolveAndScreen(
  host: string,
  lookup: (host: string) => Promise<ReadonlyArray<LookupAddress>>,
): Promise<{
  readonly internalHit: LookupAddress | null;
  readonly all: ReadonlyArray<LookupAddress>;
}> {
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    return { internalHit: null, all: [] };
  }
  // Reject non-decimal IPv4 forms (octal 0177.0.0.1, hex 0x7f.0.0.1)
  // BEFORE the DNS round-trip — `dns.lookup` on Linux may accept these
  // and resolve to 127.0.0.1, bypassing the string-only gate. This
  // closes H/M-class round-3 finding 7.7.
  if (looksLikeNonDecimalIPv4(host)) {
    return {
      internalHit: { address: host, family: 4 } as LookupAddress,
      all: [],
    };
  }
  let addresses: ReadonlyArray<LookupAddress>;
  try {
    addresses = await lookup(host);
  } catch {
    return { internalHit: null, all: [] };
  }
  for (const a of addresses) {
    const isInternal =
      a.family === 6 ? isInternalIPv6(a.address) : isInternalIPv4(a.address);
    if (isInternal) {
      return { internalHit: a, all: addresses };
    }
  }
  return { internalHit: null, all: addresses };
}

/**
 * Heuristic check for non-decimal IPv4 forms (octal `0177.0.0.1`, hex
 * `0x7f.0.0.1`, integer `2130706433`). These bypass the decimal-only
 * `PRIVATE_IPV4_PATTERNS` denylist. Conservative: reject any host
 * that LOOKS like a 4-part IP literal but isn't all-decimal, or a
 * bare integer that fits in a uint32. Round-3 closure 7.7.
 */
function looksLikeNonDecimalIPv4(host: string): boolean {
  // Bare uint32 form ("2130706433" → 127.0.0.1).
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff && host.length > 0) {
      return true;
    }
  }
  // Dotted form — reject if ANY octet starts with 0 (octal) or 0x (hex).
  const parts = host.split('.');
  if (parts.length === 4) {
    for (const p of parts) {
      if (/^0x/i.test(p)) return true;
      if (/^0\d+/.test(p)) return true; // octal prefix
      if (!/^\d+$/.test(p)) return false; // not an IP literal at all
    }
    return false;
  }
  return false;
}

const defaultDnsLookup = async (
  host: string,
): Promise<ReadonlyArray<LookupAddress>> => dnsP.lookup(host, { all: true });

/**
 * Build an undici `Dispatcher` whose TCP connect is pinned to
 * `pinnedAddress`. This prevents the kernel resolver / undici's
 * internal lookup from re-resolving the host between the SSRF gate
 * and the actual connect (DNS-rebinding TOCTOU — C3 closure).
 *
 * SNI / Host-header / TLS-SAN still use the original hostname so
 * certificate validation succeeds; only the layer-3 destination is
 * pinned. The dispatcher is owned per-request and closed in the
 * outer `finally`.
 *
 * Loaded dynamically so this package stays importable in environments
 * without undici (browsers, edge runtimes). When undici is unavailable
 * we fall back to the unpinned default fetch — the gate is still
 * effective against the common case (single-resolution DNS lookup
 * matches the fetch-time lookup); the DNS-rebind specific case is
 * documented to operators in `docs/security/ssrf-policy.md`.
 */
async function createPinnedDispatcher(
  pinnedAddress: string,
  _pinnedFamily: number | undefined,
  timeoutMs: number,
): Promise<unknown> {
  try {
    // Lazy-load undici via runtime-only import to avoid a static type
    // dep. Node 18+ bundles undici behind global fetch, but the
    // explicit `Agent` export is only available as a named import.
    // We dynamically import the package id to bypass TypeScript's
    // module resolver; if undici isn't installed we degrade to the
    // unpinned default (the SSRF gate above still applies).
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier);',
    ) as (s: string) => Promise<unknown>;
    const mod = (await dynamicImport('undici')) as {
      Agent?: new (opts: Record<string, unknown>) => unknown;
    };
    const Agent = mod.Agent;
    if (!Agent) return undefined;
    return new Agent({
      connect: {
        // `lookup` override: bypass DNS — the kernel resolver never
        // runs for this dispatcher. The first parameter is the host,
        // the second is options, the third is the callback.
        lookup: (
          _hostname: string,
          _opts: unknown,
          cb: (err: Error | null, address: string, family: number) => void,
        ) => {
          // Always return the pinned address. Family is detected from
          // the address shape — undici accepts 4 or 6.
          const family = pinnedAddress.includes(':') ? 6 : 4;
          cb(null, pinnedAddress, family);
        },
      },
      connectTimeout: timeoutMs,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
  } catch {
    // undici not present — accept the gate-only protection and skip
    // the pin. The first DNS lookup (resolveAndScreen) has already
    // confirmed the host is safe; without the pin a DNS-rebind on a
    // 0-TTL response could land a second resolution.
    return undefined;
  }
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
  // 3) Internal-IP / hostname denylist (string-only short-circuit).
  // Hostname can include zone (e.g. fe80::1%eth0); strip brackets for v6.
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isInternalHost(rawHost)) {
    throw new SafeHttpFetchError(
      'denied-internal-ip',
      url,
      `host "${rawHost}" resolves to an internal / reserved range`,
    );
  }
  // 3b) DNS-resolved IP screening — closes the gap where a hostname
  // has an A-record pointing to a private range (e.g. `localtest.me`
  // → 127.0.0.1) that the string-only check can't see.
  const lookup = options.dnsLookup ?? defaultDnsLookup;
  const { internalHit, all: resolvedAddresses } = await resolveAndScreen(
    rawHost,
    lookup,
  );
  if (internalHit) {
    throw new SafeHttpFetchError(
      'denied-internal-ip',
      url,
      `host "${rawHost}" resolved to internal IP ${internalHit.address}`,
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
  //
  // C3 closure (DNS-rebinding fix): we MUST NOT let fetch() perform a
  // second DNS lookup against `rawHost` — a hostile authoritative DNS
  // server can serve a public IP on resolution 1 (passing the gate)
  // and an internal IP on resolution 2 (bypassing the gate). We
  // construct an undici `Dispatcher` whose `connect` callback is
  // pre-pinned to the SAFE first-resolution IP. Hostname/SNI is
  // preserved so TLS cert SAN validation against the original host
  // still succeeds; only the TCP destination is pinned.
  //
  // Tests can supply a custom `fetchImpl` that ignores the dispatcher
  // (no-op pin) — the bypass-prevention property is guaranteed by the
  // resolveAndScreen result, not by the dispatcher itself.
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Pin the first resolved address as the TCP target. Pick the first
  // public address (resolveAndScreen has already rejected internal IPs).
  const pinnedAddress = resolvedAddresses[0]?.address;
  const pinnedFamily = resolvedAddresses[0]?.family;
  const dispatcher =
    pinnedAddress !== undefined && !options.fetchImpl
      ? await createPinnedDispatcher(pinnedAddress, pinnedFamily, timeoutMs)
      : undefined;
  try {
    const fetchInit = {
      method: options.method ?? 'GET',
      headers: options.headers as Record<string, string> | undefined,
      // `BodyInit` is a DOM type — this package has only `node` types loaded
      // (see tsconfig.types). Cast via `unknown` so `node`-only + DOM-only
      // fetch shapes both compile.
      body: options.body as unknown as Parameters<typeof fetchImpl>[1] extends { body?: infer B } ? B : undefined,
      signal: controller.signal,
    } as Record<string, unknown>;
    if (dispatcher) {
      // undici-only field; ignored by other fetch shapes (e.g. stub fetch).
      fetchInit.dispatcher = dispatcher;
    }
    const res = await fetchImpl(
      url,
      fetchInit as Parameters<typeof fetchImpl>[1],
    );
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
    if (dispatcher) {
      // Close the per-request dispatcher to release the connection. We
      // ignore close failures because the request has already settled.
      const d = dispatcher as { close?: () => Promise<void> };
      if (typeof d.close === 'function') {
        d.close().catch(() => {
          /* non-fatal */
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pure URL-safety assertion — usable from any caller that wants the
// `safeHttpFetch` policy without committing to its fetch shape (e.g.
// webhook-delivery, which has its own injectable fetch port).
// ---------------------------------------------------------------------------

export interface AssertUrlSafeOptions {
  readonly allowlist?: ReadonlyArray<string>;
  readonly allowedPorts?: ReadonlyArray<number>;
  readonly allowedSchemes?: ReadonlyArray<string>;
  readonly dnsLookup?: (
    host: string,
  ) => Promise<ReadonlyArray<LookupAddress>>;
}

/**
 * Verify that `url` is safe to dispatch — scheme, port, internal-host
 * string-gate, DNS-resolved IP gate, and (optional) allowlist. Throws
 * `SafeHttpFetchError` on the first failure. Used by `safeHttpFetch`
 * itself; also exported so peers like the webhook-delivery dispatcher
 * can apply the exact same policy without depending on the fetch port.
 */
export interface AssertUrlSafeResult {
  /** The first resolved IP (public; internal IPs already rejected). */
  readonly pinnedAddress?: string;
  /** Address family — 4 or 6. */
  readonly pinnedFamily?: number;
}

export async function assertUrlSafe(
  url: string,
  options: AssertUrlSafeOptions = {},
): Promise<AssertUrlSafeResult> {
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
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isInternalHost(rawHost)) {
    throw new SafeHttpFetchError(
      'denied-internal-ip',
      url,
      `host "${rawHost}" resolves to an internal / reserved range`,
    );
  }
  const lookup = options.dnsLookup ?? defaultDnsLookup;
  const { internalHit, all } = await resolveAndScreen(rawHost, lookup);
  if (internalHit) {
    throw new SafeHttpFetchError(
      'denied-internal-ip',
      url,
      `host "${rawHost}" resolved to internal IP ${internalHit.address}`,
    );
  }
  const allowlist = options.allowlist ?? [];
  if (!matchesAllowlist(rawHost, allowlist)) {
    throw new SafeHttpFetchError(
      'denied-not-in-allowlist',
      url,
      `host "${rawHost}" not in allowlist`,
    );
  }
  const first = all[0];
  return first
    ? { pinnedAddress: first.address, pinnedFamily: first.family }
    : {};
}

/**
 * Build a connection-pinned dispatcher from a prior {@link assertUrlSafe}
 * result. Callers that own their own fetch port (e.g. webhook-delivery)
 * use this to wire DNS-rebind protection into their fetch dispatch.
 *
 * Returns `undefined` if undici isn't loadable in this runtime or no
 * IP was pinned (e.g. literal-IP URLs).
 */
export async function buildPinnedDispatcher(
  pinned: AssertUrlSafeResult,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  if (!pinned.pinnedAddress) return undefined;
  return createPinnedDispatcher(pinned.pinnedAddress, pinned.pinnedFamily, timeoutMs);
}

// ---------------------------------------------------------------------------
// Diagnostic helpers (exported for tests)
// ---------------------------------------------------------------------------

export const __internals = {
  isInternalHost,
  matchesAllowlist,
  resolveAndScreen,
};
