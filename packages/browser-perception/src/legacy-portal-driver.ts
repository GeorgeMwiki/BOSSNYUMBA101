/**
 * Legacy portal driver — wraps a Playwright `Browser` + `Page` with an
 * a11y-tree-first perception loop.
 *
 * Central Command Phase B B6 — used by the brain to drive legacy
 * vendor surfaces (KRA iTax, GePG, etc.) that expose no API. The driver
 * NEVER feeds the raw DOM to the brain; the AXTree is the perception
 * substrate. Anthropic Computer Use is reserved as a last-resort
 * actuator if a portal doesn't accessibly expose a control.
 *
 * Action vocabulary (`act(...)`):
 *   - {"verb": "click", "role": "button", "name": <regex|string>}
 *   - {"verb": "fill", "role": "textbox", "name": <regex|string>, "value": string}
 *   - {"verb": "navigate", "url": string}
 *   - {"verb": "submit", "role": "button", "name": <regex|string>}
 *
 * Errors are non-fatal: if a control isn't found, the driver returns
 * `{actionResult: { ok: false, reason: 'control-not-found' }}` and the
 * caller decides whether to retry / fallback / abort.
 */

import {
  captureAxTreeSnapshot,
  flattenAxNodes,
  type AxNode,
  type AxTreeSnapshot,
  type PlaywrightPageLike,
} from './axtree-snapshot.js';
import { diffAxSnapshots, type AxTreeDiff } from './axtree-diff.js';

/**
 * Consent / DPIA port (H26 closure).
 *
 * The driver snapshots a11y trees from third-party portals that
 * contain PII (full name, NIDA, phone). GDPR Art. 6 + Kenya DPA
 * Section 25 require a documented lawful basis BEFORE the snapshot is
 * taken. The driver consults this port before `openPortal` / `act`;
 * a `null` (consent absent or revoked) MUST refuse the snapshot.
 *
 * Production wiring: a tenant-scoped consent registry that returns
 * the consent record (lawful basis, scope, expiry). Test / no-op
 * wiring: a stub that always grants for the current tenant.
 */
export interface PortalConsentPort {
  hasConsent(args: {
    readonly tenantId: string;
    readonly portalHost: string;
  }): Promise<boolean>;
}

export class ConsentMissingError extends Error {
  readonly code = 'CONSENT_MISSING' as const;
  constructor(portalHost: string, tenantId: string) {
    super(
      `LegacyPortalDriver: refusing to snapshot ${portalHost} for tenant ${tenantId} — consent absent or expired`,
    );
    this.name = 'ConsentMissingError';
  }
}

export interface LegacyPortalDriverOptions {
  readonly page: DrivablePage;
  /** Max AX nodes per snapshot — defaults to 200 (sensorium cap). */
  readonly maxNodes?: number;
  /** Max AX depth per snapshot — defaults to 12. */
  readonly maxDepth?: number;
  /**
   * H26: consent port + tenant scope. When both are provided the
   * driver gates `openPortal` and `act({verb:'navigate'})` on a
   * positive consent record. When omitted, the driver runs without
   * the gate (legacy behaviour preserved for test wiring; production
   * compositions MUST inject the port).
   */
  readonly consent?: PortalConsentPort;
  readonly tenantId?: string;
  /**
   * Per-tenant portal host allowlist (C5 closure).
   *
   * Why: the brain's NL emits structured `{verb: 'navigate', url}`
   * actions. If a malicious third-party page prompt-injects the brain
   * (the driver reads a11y trees FROM external pages, so an attacker
   * who controls a portal can in principle steer the next emitted
   * action), an unguarded `page.goto` could pivot to `169.254.169.254`
   * (IMDS) or `127.0.0.1` from the browser process.
   *
   * The driver MUST be configured with an allowlist of hostnames
   * (e.g. `['itax.kra.go.ke', '*.gepg.go.tz']`). Navigation to a host
   * outside the allowlist is refused before `page.goto` runs.
   *
   * `file:`, `data:`, and `javascript:` schemes are ALWAYS rejected
   * regardless of allowlist content. Schemes outside `[http:, https:]`
   * are rejected by default.
   *
   * Wildcard support: a leading `.` matches any subdomain
   * (`.example.com` matches `foo.example.com` and `example.com`).
   * A leading `*.` is equivalent.
   */
  readonly navigationAllowlist?: ReadonlyArray<string>;
  /** Allowed schemes — defaults to `['http:', 'https:']`. */
  readonly allowedSchemes?: ReadonlyArray<string>;
}

const DEFAULT_ALLOWED_SCHEMES: ReadonlyArray<string> = Object.freeze([
  'http:',
  'https:',
]);

const DENIED_SCHEMES: ReadonlySet<string> = new Set([
  'file:',
  'data:',
  'javascript:',
  'vbscript:',
  'about:',
  'chrome:',
  'chrome-extension:',
  'view-source:',
  'blob:',
]);

export class NavigationBlockedError extends Error {
  readonly code: 'scheme-denied' | 'host-not-in-allowlist' | 'invalid-url';
  constructor(
    code: 'scheme-denied' | 'host-not-in-allowlist' | 'invalid-url',
    url: string,
    detail: string,
  ) {
    super(`LegacyPortalDriver[${code}] ${url}: ${detail}`);
    this.name = 'NavigationBlockedError';
    this.code = code;
  }
}

/**
 * Assert a URL is safe to navigate to. Pure — never touches the page.
 *
 * Returns `void` on success; throws `NavigationBlockedError` on any
 * rejection. The allowlist semantics match `safeHttpFetch` —
 * suffix-prefixed entries (`.example.com`) match subdomains; bare
 * entries require an exact / `*.<entry>` host match.
 */
export function assertNavigationAllowed(
  url: string,
  options: {
    readonly allowlist: ReadonlyArray<string>;
    readonly allowedSchemes?: ReadonlyArray<string>;
  },
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NavigationBlockedError('invalid-url', url, 'URL parse failed');
  }
  if (DENIED_SCHEMES.has(parsed.protocol)) {
    throw new NavigationBlockedError(
      'scheme-denied',
      url,
      `scheme "${parsed.protocol}" is in the denied-scheme set`,
    );
  }
  const allowedSchemes = options.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
  if (!allowedSchemes.includes(parsed.protocol)) {
    throw new NavigationBlockedError(
      'scheme-denied',
      url,
      `scheme "${parsed.protocol}" not in [${allowedSchemes.join(', ')}]`,
    );
  }
  if (options.allowlist.length === 0) {
    // Empty allowlist = explicit deny-all. Operators must opt in.
    throw new NavigationBlockedError(
      'host-not-in-allowlist',
      url,
      'navigation allowlist is empty — refuse navigate',
    );
  }
  const lowerHost = parsed.hostname.toLowerCase();
  const matched = options.allowlist.some((entry) => {
    const e = entry.toLowerCase().replace(/^\*\./, '.');
    if (e.startsWith('.')) {
      return lowerHost.endsWith(e) || lowerHost === e.slice(1);
    }
    return lowerHost === e;
  });
  if (!matched) {
    throw new NavigationBlockedError(
      'host-not-in-allowlist',
      url,
      `host "${parsed.hostname}" not in allowlist`,
    );
  }
}

/** Playwright surface the driver needs. */
export interface DrivablePage extends PlaywrightPageLike {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  fill?: (selector: string, value: string) => Promise<void>;
  click?: (selector: string) => Promise<void>;
  getByRole?: (
    role: string,
    opts?: { name?: string | RegExp; exact?: boolean },
  ) => LocatorLike;
}

export interface LocatorLike {
  click: (opts?: { timeout?: number }) => Promise<void>;
  fill: (value: string, opts?: { timeout?: number }) => Promise<void>;
  count?: () => Promise<number>;
}

export type LegacyPortalAction =
  | {
      readonly verb: 'click' | 'submit';
      readonly role: string;
      readonly name: string | RegExp;
    }
  | {
      readonly verb: 'fill';
      readonly role: string;
      readonly name: string | RegExp;
      readonly value: string;
    }
  | { readonly verb: 'navigate'; readonly url: string };

export interface ActionResult {
  readonly ok: boolean;
  readonly verb: LegacyPortalAction['verb'];
  readonly reason?: string;
  /** Snapshot captured AFTER the action. */
  readonly postActionSnapshot: AxTreeSnapshot;
  /** Diff against the pre-action snapshot. */
  readonly diff: AxTreeDiff;
}

export interface PortalCredentials {
  readonly username: string;
  readonly password: string;
  /** Optional TOTP / OTP code — if absent, the driver halts when prompted. */
  readonly mfaCode?: string;
}

export class LegacyPortalDriver {
  private readonly page: DrivablePage;
  private readonly maxNodes: number;
  private readonly maxDepth: number;
  private readonly navigationAllowlist: ReadonlyArray<string>;
  private readonly allowedSchemes: ReadonlyArray<string>;
  private readonly consent?: PortalConsentPort;
  private readonly tenantId?: string;
  private lastSnapshot: AxTreeSnapshot | null = null;

  constructor(opts: LegacyPortalDriverOptions) {
    if (!opts.page) {
      throw new Error('legacy-portal-driver: page is required');
    }
    this.page = opts.page;
    this.maxNodes = opts.maxNodes ?? 200;
    this.maxDepth = opts.maxDepth ?? 12;
    this.navigationAllowlist = opts.navigationAllowlist ?? [];
    this.allowedSchemes = opts.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
    if (opts.consent) this.consent = opts.consent;
    if (opts.tenantId) this.tenantId = opts.tenantId;
  }

  /** H26: consult the consent port before any snapshot. */
  private async assertConsent(url: string): Promise<void> {
    if (!this.consent || !this.tenantId) return;
    const host = new URL(url).hostname;
    const ok = await this.consent.hasConsent({
      tenantId: this.tenantId,
      portalHost: host,
    });
    if (!ok) {
      throw new ConsentMissingError(host, this.tenantId);
    }
  }

  /**
   * Navigate to the portal entry url and capture the initial snapshot.
   *
   * C5 closure: every navigation passes through `assertNavigationAllowed`.
   * Without an allowlist configured the call is REFUSED with
   * `NavigationBlockedError`.
   *
   * L4 closure: callers no longer pass `_credentials` here — credentials
   * MUST be presented through the brain's `act({verb:'fill', …})` flow
   * so the secret never lands in driver memory. The legacy
   * `_credentials` parameter was a no-op and has been removed.
   */
  async openPortal(url: string): Promise<AxTreeSnapshot> {
    assertNavigationAllowed(url, {
      allowlist: this.navigationAllowlist,
      allowedSchemes: this.allowedSchemes,
    });
    await this.assertConsent(url);
    await this.page.goto(url);
    const snap = await this.snapshot();
    this.lastSnapshot = snap;
    return snap;
  }

  /** Capture an AXTree snapshot using configured caps. */
  async snapshot(): Promise<AxTreeSnapshot> {
    return captureAxTreeSnapshot(this.page, {
      maxNodes: this.maxNodes,
      maxDepth: this.maxDepth,
      interestingOnly: true,
    });
  }

  /** Get the last captured snapshot (null until {@link openPortal} runs). */
  getLastSnapshot(): AxTreeSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Locate the first node in the current snapshot matching `(role, name)`.
   * Returns null if not found. Doesn't mutate page state.
   */
  async findRoleByName(
    role: string,
    namePattern: string | RegExp,
  ): Promise<AxNode | null> {
    const snap = this.lastSnapshot ?? (await this.snapshot());
    this.lastSnapshot = snap;
    // H25 closure: when `namePattern` is a STRING, perform a literal
    // case-insensitive match — NEVER `new RegExp(namePattern, 'i')`.
    // The brain's NL output is untrusted; `(a+)+$` is a textbook
    // catastrophic-backtracking pattern. Callers that genuinely need
    // regex semantics MUST pass a pre-compiled `RegExp` instance — an
    // explicit opt-in, not the default.
    const nodes = flattenAxNodes(snap.root);
    if (namePattern instanceof RegExp) {
      return (
        nodes.find((n) => n.role === role && namePattern.test(n.name ?? '')) ??
        null
      );
    }
    const needle = namePattern.toLowerCase();
    return (
      nodes.find(
        (n) =>
          n.role === role && (n.name ?? '').toLowerCase().includes(needle),
      ) ?? null
    );
  }

  /**
   * Execute a structured action and report the post-action snapshot
   * + diff. Untyped NL inputs should be lowered to {@link LegacyPortalAction}
   * by the brain BEFORE calling `act` (we don't want regex-injection
   * surface inside the driver).
   */
  async act(action: LegacyPortalAction): Promise<ActionResult> {
    const before = this.lastSnapshot ?? (await this.snapshot());
    this.lastSnapshot = before;

    let ok = true;
    let reason: string | undefined;

    try {
      switch (action.verb) {
        case 'navigate':
          // C5 closure: same allowlist + scheme gate as openPortal.
          // Without this, a brain prompt-injected by a malicious portal
          // page could emit `navigate http://169.254.169.254/...` and
          // the browser process would hit IMDS.
          assertNavigationAllowed(action.url, {
            allowlist: this.navigationAllowlist,
            allowedSchemes: this.allowedSchemes,
          });
          await this.page.goto(action.url);
          break;

        case 'click':
        case 'submit': {
          const locator = this.page.getByRole?.(action.role, {
            name: action.name,
          });
          if (!locator) {
            ok = false;
            reason = 'getByRole-unavailable';
            break;
          }
          await locator.click({ timeout: 5000 });
          break;
        }

        case 'fill': {
          const locator = this.page.getByRole?.(action.role, {
            name: action.name,
          });
          if (!locator) {
            ok = false;
            reason = 'getByRole-unavailable';
            break;
          }
          await locator.fill(action.value, { timeout: 5000 });
          break;
        }

        default:
          ok = false;
          reason = 'unknown-verb';
      }
    } catch (err) {
      ok = false;
      reason = err instanceof Error ? err.message : 'unknown';
    }

    const after = await this.snapshot();
    this.lastSnapshot = after;
    const diff = diffAxSnapshots(before, after);
    return {
      ok,
      verb: action.verb,
      ...(reason !== undefined ? { reason } : {}),
      postActionSnapshot: after,
      diff,
    };
  }
}
