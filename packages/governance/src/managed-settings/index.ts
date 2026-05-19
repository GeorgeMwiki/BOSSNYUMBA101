/**
 * @bossnyumba/governance/managed-settings
 *
 * Admin-pushed tenant policy with fail-closed semantics. Mirrors Claude
 * Code K.4 (allowManaged{Hooks,McpServers,PermissionRules}Only,
 * forceRemoteSettingsRefresh).
 */

export {
  buildFailClosedBundle,
  isFailClosedBundle,
  resolveManagedSettings,
  type ResolveManagedSettingsDeps,
} from './managed-settings.js';

export {
  MOST_RESTRICTIVE_LOCKS,
} from './types.js';

export type {
  ManagedSettings,
  ManagedSettingsCache,
  ManagedSettingsLedger,
  ManagedSettingsLocks,
  ManagedSettingsRemote,
  RemoteFetchOutcome,
} from './types.js';
