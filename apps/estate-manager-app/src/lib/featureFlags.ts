/**
 * Estate-manager-app feature flags — Wave-3 INT-4 MD-vision integration.
 *
 * Mirror of owner-portal's flagging utility but reads from Next.js
 * `process.env.NEXT_PUBLIC_FF_*` envs. Build-time inlined; server +
 * client safe. URL query overrides are intentionally client-only so
 * server renders default to OFF.
 *
 * Every flag defaults OFF so this branch ships zero UI changes until
 * an operator flips the env in deployment config.
 */

export type ManagerFeatureFlag =
  | 'executive_brief_enabled'
  | 'parcels_overview_enabled'
  | 'workforce_enabled'
  | 'module_proposals_enabled'
  | 'brain_tab_status_enabled'
  | 'chat_artifact_stream_enabled'
  | 'need_spawn_banner_enabled';

const QUERY_PREFIX = 'ff.';

/**
 * Pure reader — pulls Next public env. Only `1`, `true`, `on`
 * (case-insensitive) count as enabled.
 */
export function readEnvFlag(name: ManagerFeatureFlag): boolean {
  const envKey = `NEXT_PUBLIC_FF_${name.toUpperCase()}`;
  const raw = process.env[envKey];
  if (!raw) return false;
  const normalised = raw.toLowerCase().trim();
  return normalised === '1' || normalised === 'true' || normalised === 'on';
}

/**
 * Pure URL-override reader for client-side use. `null` means "no
 * override present — caller should fall back to env".
 */
export function readQueryOverride(
  name: ManagerFeatureFlag,
  search: string,
): boolean | null {
  if (typeof search !== 'string' || search.length === 0) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const key = `${QUERY_PREFIX}${name}`;
  if (!params.has(key)) return null;
  const value = (params.get(key) ?? '').toLowerCase().trim();
  if (value === '0' || value === 'false' || value === 'off') return false;
  return value === '' || value === '1' || value === 'true' || value === 'on';
}

/**
 * Resolution order:
 *   1. URL query override (client-only, useful for QA)
 *   2. NEXT_PUBLIC_FF_* env (statically baked at build)
 *   3. `false`
 */
export function isFeatureEnabled(
  name: ManagerFeatureFlag,
  search?: string,
): boolean {
  const effectiveSearch =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const override = readQueryOverride(name, effectiveSearch);
  if (override !== null) return override;
  return readEnvFlag(name);
}
