/**
 * Managed-settings tests — fail-closed semantics, audit trail,
 * cache-fallback chain. 15+ tests.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildFailClosedBundle,
  isFailClosedBundle,
  resolveManagedSettings,
  MOST_RESTRICTIVE_LOCKS,
  type ManagedSettings,
  type ManagedSettingsCache,
  type ManagedSettingsLedger,
  type ManagedSettingsRemote,
  type RemoteFetchOutcome,
} from '../managed-settings/index.js';

const tenantId = 'tenant-1';

const buildOkBundle = (
  overrides: Partial<ManagedSettings> = {},
): ManagedSettings => ({
  tenantId,
  locks: {
    allowManagedHooksOnly: false,
    allowManagedMcpServersOnly: false,
    allowManagedPermissionRulesOnly: false,
    forceRemoteSettingsRefresh: false,
  },
  issuedAt: '2026-05-01T00:00:00Z',
  version: 7,
  ...overrides,
});

const buildDeps = (args: {
  readonly remote: ManagedSettingsRemote;
  readonly cache: ManagedSettingsCache;
  readonly ledger: ManagedSettingsLedger;
  readonly forceRefreshOverride?: boolean;
  readonly now?: () => number;
}) => args;

describe('MOST_RESTRICTIVE_LOCKS', () => {
  it('has every lock turned on', () => {
    expect(MOST_RESTRICTIVE_LOCKS.allowManagedHooksOnly).toBe(true);
    expect(MOST_RESTRICTIVE_LOCKS.allowManagedMcpServersOnly).toBe(true);
    expect(MOST_RESTRICTIVE_LOCKS.allowManagedPermissionRulesOnly).toBe(true);
    expect(MOST_RESTRICTIVE_LOCKS.forceRemoteSettingsRefresh).toBe(true);
  });
});

describe('buildFailClosedBundle', () => {
  it('pins autonomy to chat', () => {
    expect(buildFailClosedBundle(tenantId).pinnedAutonomy).toBe('chat');
  });

  it('forces RLS and OTel on', () => {
    const bundle = buildFailClosedBundle(tenantId);
    expect(bundle.forceRlsOnAllTables).toBe(true);
    expect(bundle.forceOtelOn).toBe(true);
  });

  it('applies the most-restrictive lock flags', () => {
    expect(buildFailClosedBundle(tenantId).locks).toEqual(MOST_RESTRICTIVE_LOCKS);
  });

  it('uses version=-1 as the sentinel', () => {
    expect(buildFailClosedBundle(tenantId).version).toBe(-1);
  });
});

describe('isFailClosedBundle', () => {
  it('detects the sentinel', () => {
    expect(isFailClosedBundle(buildFailClosedBundle(tenantId))).toBe(true);
  });

  it('rejects real bundles', () => {
    expect(isFailClosedBundle(buildOkBundle())).toBe(false);
  });
});

describe('resolveManagedSettings — happy path', () => {
  it('returns the remote bundle when fetch succeeds and caches it', async () => {
    const okBundle = buildOkBundle({ version: 9 });
    const cacheSave = vi.fn().mockResolvedValue(undefined);
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'ok' as const, settings: okBundle };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return null;
      },
      save: cacheSave,
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(resolved).toEqual(okBundle);
    expect(cacheSave).toHaveBeenCalledOnce();
    expect(ledgerWrite).toHaveBeenCalledOnce();
  });

  it('does not re-audit when the version is unchanged', async () => {
    const bundle = buildOkBundle({ version: 5 });
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'ok' as const, settings: bundle };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return bundle;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
      previousBundleVersion: 5,
    });
    expect(ledgerWrite).not.toHaveBeenCalled();
  });
});

describe('resolveManagedSettings — fail-closed semantics (CRITICAL)', () => {
  it('falls back to MOST_RESTRICTIVE when remote unreachable AND forceRefresh on', async () => {
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return {
          status: 'unreachable' as const,
          errorReason: 'network timeout',
        } satisfies RemoteFetchOutcome;
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        // Return a cache entry that says forceRefresh=true so the
        // resolver uses the cache-flag pathway.
        return buildOkBundle({
          locks: {
            allowManagedHooksOnly: false,
            allowManagedMcpServersOnly: false,
            allowManagedPermissionRulesOnly: false,
            forceRemoteSettingsRefresh: true,
          },
        });
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
    expect(resolved.locks).toEqual(MOST_RESTRICTIVE_LOCKS);
    expect(resolved.pinnedAutonomy).toBe('chat');
    expect(ledgerWrite).toHaveBeenCalledOnce();
    expect(ledgerWrite.mock.calls[0][0].source).toBe('fail-closed-fallback');
  });

  it('respects forceRefreshOverride even when cache says forceRefresh=false', async () => {
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return buildOkBundle({
          locks: {
            allowManagedHooksOnly: false,
            allowManagedMcpServersOnly: false,
            allowManagedPermissionRulesOnly: false,
            forceRemoteSettingsRefresh: false,
          },
        });
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({
        remote,
        cache,
        ledger,
        forceRefreshOverride: true,
      }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
  });

  it('falls back to cache when remote unreachable AND forceRefresh off', async () => {
    const cachedBundle = buildOkBundle({
      version: 3,
      locks: {
        allowManagedHooksOnly: false,
        allowManagedMcpServersOnly: false,
        allowManagedPermissionRulesOnly: false,
        forceRemoteSettingsRefresh: false,
      },
    });
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return cachedBundle;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(resolved).toEqual(cachedBundle);
    expect(ledgerWrite).not.toHaveBeenCalled();
  });

  it('falls back to MOST_RESTRICTIVE when remote unreachable and cache empty', async () => {
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return null;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
    expect(ledgerWrite).toHaveBeenCalledOnce();
  });

  it('treats an invalid remote response as fail-closed when forceRefresh on', async () => {
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return {
          status: 'invalid' as const,
          errorReason: 'schema mismatch',
        };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return null;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger, forceRefreshOverride: true }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
    expect(ledgerWrite.mock.calls[0][0].reason).toContain('invalid');
  });
});

describe('resolveManagedSettings — defaults to fail-closed for unconfigured tenants', () => {
  it('treats a missing cache + no override as forceRefresh=true (fail closed)', async () => {
    const ledgerWrite = vi.fn().mockResolvedValue(undefined);
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return null;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      recordChange: ledgerWrite,
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
  });

  it('cache-load errors degrade gracefully (no throw, still fails closed)', async () => {
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        throw new Error('cache exploded');
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      async recordChange() {
        /* no-op */
      },
    };
    const resolved = await resolveManagedSettings({
      tenantId,
      deps: buildDeps({ remote, cache, ledger }),
    });
    expect(isFailClosedBundle(resolved)).toBe(true);
  });
});
