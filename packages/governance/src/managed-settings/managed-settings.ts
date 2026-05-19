/**
 * Managed-settings resolver — pulls the bundle from remote (or cache),
 * applies fail-closed semantics, audits every change.
 *
 * Order of operations:
 *   1. If `forceRemoteSettingsRefresh` is true → fetch remote.
 *      - on `ok` → use bundle; cache it; audit.
 *      - on `unreachable` or `invalid` → fail closed (MOST_RESTRICTIVE_LOCKS).
 *   2. Else → fetch remote; on failure, fall back to cache.
 *      - if cache is empty → fail closed.
 *   3. Audit any state transition.
 *
 * The fail-closed result is a bundle with:
 *   - MOST_RESTRICTIVE_LOCKS
 *   - pinnedAutonomy = 'chat'
 *   - forceRlsOnAllTables = true
 *   - forceOtelOn = true
 *   - version = -1 (sentinel — caller can detect)
 */

import { DEFAULT_GATE_CONFIG } from '../checkpoint-gates/gates.js';
import type {
  ManagedSettings,
  ManagedSettingsCache,
  ManagedSettingsLedger,
  ManagedSettingsRemote,
} from './types.js';
import { MOST_RESTRICTIVE_LOCKS } from './types.js';

/**
 * Construct the most-restrictive fallback bundle.
 *
 * Used when the remote authority is unreachable AND the caller demanded a
 * forceRefresh (or there's no cached bundle to fall back to).
 */
export const buildFailClosedBundle = (
  tenantId: string,
  now: number = Date.now(),
): ManagedSettings => ({
  tenantId,
  locks: MOST_RESTRICTIVE_LOCKS,
  pinnedAutonomy: 'chat',
  pinnedGates: { ...DEFAULT_GATE_CONFIG },
  forceRlsOnAllTables: true,
  forceOtelOn: true,
  issuedAt: new Date(now).toISOString(),
  version: -1,
});

/**
 * Detect whether a bundle is the fail-closed sentinel.
 */
export const isFailClosedBundle = (bundle: ManagedSettings): boolean =>
  bundle.version === -1;

export interface ResolveManagedSettingsDeps {
  readonly remote: ManagedSettingsRemote;
  readonly cache: ManagedSettingsCache;
  readonly ledger: ManagedSettingsLedger;
  /** When true, ALWAYS treat the lookup as if forceRemoteSettingsRefresh=true. */
  readonly forceRefreshOverride?: boolean;
  readonly now?: () => number;
}

/**
 * Resolve the effective managed settings for a tenant, applying
 * fail-closed semantics.
 *
 * The optional `previousBundleVersion` lets the caller pass the version
 * the brain last loaded — used to emit a precise audit entry when the
 * resolved bundle changes.
 */
export const resolveManagedSettings = async (args: {
  readonly tenantId: string;
  readonly deps: ResolveManagedSettingsDeps;
  readonly previousBundleVersion?: number | null;
}): Promise<ManagedSettings> => {
  const now = args.deps.now ?? Date.now;
  const previousVersion = args.previousBundleVersion ?? null;

  // Step 1: try the remote authority first.
  const remoteOutcome = await args.deps.remote.fetch(args.tenantId);

  // Step 2: cache lookup — but only consulted when forceRefresh is false.
  // We have to consult the cache for the forceRefresh flag, so always
  // load it (cheap), but USE it only if the policy permits.
  let cached: ManagedSettings | null = null;
  try {
    cached = await args.deps.cache.load(args.tenantId);
  } catch {
    cached = null;
  }

  // Determine whether forceRefresh is in effect. The caller's override
  // wins; else we consult the cache (for the flag, not the value); else
  // we DEFAULT to forceRefresh=true (fail-closed bias for new tenants).
  const forceRefresh =
    args.deps.forceRefreshOverride ??
    cached?.locks.forceRemoteSettingsRefresh ??
    true;

  if (remoteOutcome.status === 'ok') {
    const fresh = remoteOutcome.settings;
    try {
      await args.deps.cache.save(fresh);
    } catch {
      // Cache write failure does not block — we have a valid bundle.
    }
    if (previousVersion === null || previousVersion !== fresh.version) {
      await args.deps.ledger.recordChange({
        tenantId: args.tenantId,
        oldVersion: previousVersion,
        newVersion: fresh.version,
        issuedAt: fresh.issuedAt,
        source: 'remote',
        reason: 'Remote managed-settings refresh succeeded.',
      });
    }
    return fresh;
  }

  // Remote failed.
  if (forceRefresh) {
    // Fail closed. Build the sentinel bundle and audit.
    const fallback = buildFailClosedBundle(args.tenantId, now());
    await args.deps.ledger.recordChange({
      tenantId: args.tenantId,
      oldVersion: previousVersion,
      newVersion: fallback.version,
      issuedAt: fallback.issuedAt,
      source: 'fail-closed-fallback',
      reason: `Remote managed-settings authority was ${remoteOutcome.status} (${remoteOutcome.errorReason}); forceRemoteSettingsRefresh is on; falling back to most-restrictive policy.`,
    });
    return fallback;
  }

  // forceRefresh is off → fall back to cached bundle.
  if (cached !== null) {
    // No audit (state unchanged from cache).
    return cached;
  }

  // No cache and forceRefresh is off — still fail closed (no policy at all
  // is worse than the most-restrictive policy).
  const fallback = buildFailClosedBundle(args.tenantId, now());
  await args.deps.ledger.recordChange({
    tenantId: args.tenantId,
    oldVersion: previousVersion,
    newVersion: fallback.version,
    issuedAt: fallback.issuedAt,
    source: 'fail-closed-fallback',
    reason: `Remote managed-settings authority was ${remoteOutcome.status} (${remoteOutcome.errorReason}); no cached bundle available; falling back to most-restrictive policy.`,
  });
  return fallback;
};
