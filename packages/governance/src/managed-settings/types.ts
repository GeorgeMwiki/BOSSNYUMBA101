/**
 * Managed settings — admin-pushed policy that cannot be loosened by
 * tenant/conversation overrides.
 *
 * Mirrors Claude Code's K.4 lock keys (`allowManagedHooksOnly`,
 * `allowManagedMcpServersOnly`, `allowManagedPermissionRulesOnly`,
 * `forceRemoteSettingsRefresh`) but for BOSSNYUMBA's tenant-scoped
 * platform.
 *
 * **Critical invariant**: when `forceRemoteSettingsRefresh = true` and the
 * remote managed-settings endpoint is unreachable, the tenant lands in
 * MOST-RESTRICTIVE mode (not last-cached). Fail closed.
 */

import type { ActionClass, CheckpointGateConfig } from '../checkpoint-gates/types.js';
import type { AutonomyLevel } from '../autonomy-slider/types.js';

/**
 * The set of managed-settings lock flags. Mirrors Claude Code K.4.
 */
export interface ManagedSettingsLocks {
  /** If true, tenant-local hook overrides are ignored. */
  readonly allowManagedHooksOnly: boolean;
  /** If true, only admin-blessed MCP servers connect. */
  readonly allowManagedMcpServersOnly: boolean;
  /** If true, only admin-blessed permission rules apply. */
  readonly allowManagedPermissionRulesOnly: boolean;
  /**
   * If true, the platform refreshes managed settings from the remote
   * authority on every session start. If the authority is unreachable,
   * fail closed (most-restrictive policy applies).
   */
  readonly forceRemoteSettingsRefresh: boolean;
}

/**
 * The full managed-settings bundle pushed from the internal-admin tool.
 *
 *   - `locks` — the Claude-Code-style flags
 *   - `pinnedAutonomy` — if set, the tenant cannot exceed this level
 *   - `pinnedGates` — if set, these gate configs cannot be loosened by
 *                     the tenant settings page
 *   - `forceRlsOnAllTables` — operational lock (the brain refuses to
 *                              touch a table without RLS proof)
 *   - `forceOtelOn` — the brain refuses to run without OTel exporter
 */
export interface ManagedSettings {
  readonly tenantId: string;
  readonly locks: ManagedSettingsLocks;
  readonly pinnedAutonomy?: AutonomyLevel;
  readonly pinnedGates?: Readonly<Partial<Record<ActionClass, CheckpointGateConfig>>>;
  readonly forceRlsOnAllTables?: boolean;
  readonly forceOtelOn?: boolean;
  /** ISO-8601 timestamp — when the bundle was last issued. */
  readonly issuedAt: string;
  /** Monotonic version — newer versions supersede older ones. */
  readonly version: number;
}

/** Most-restrictive fallback — applies when the remote refresh fails closed. */
export const MOST_RESTRICTIVE_LOCKS: ManagedSettingsLocks = {
  allowManagedHooksOnly: true,
  allowManagedMcpServersOnly: true,
  allowManagedPermissionRulesOnly: true,
  forceRemoteSettingsRefresh: true,
};

/** Remote-fetch outcome — drives the fail-closed decision. */
export type RemoteFetchOutcome =
  | { readonly status: 'ok'; readonly settings: ManagedSettings }
  | { readonly status: 'unreachable'; readonly errorReason: string }
  | { readonly status: 'invalid'; readonly errorReason: string };

/**
 * Port for the remote managed-settings authority. In production this calls
 * the internal-admin HTTPS endpoint with mTLS. Tests swap in a fake.
 */
export interface ManagedSettingsRemote {
  fetch(tenantId: string): Promise<RemoteFetchOutcome>;
}

/**
 * Port for the local cache (last-known-good copy). Used only when
 * `forceRemoteSettingsRefresh` is false. When the flag is true, the
 * cache is bypassed.
 */
export interface ManagedSettingsCache {
  load(tenantId: string): Promise<ManagedSettings | null>;
  save(settings: ManagedSettings): Promise<void>;
}

/**
 * Port for the sovereign-ledger audit sink. Every change to managed
 * settings writes here.
 */
export interface ManagedSettingsLedger {
  recordChange(args: {
    readonly tenantId: string;
    readonly oldVersion: number | null;
    readonly newVersion: number;
    readonly issuedAt: string;
    readonly source: 'remote' | 'fail-closed-fallback';
    readonly reason: string;
  }): Promise<void>;
}
