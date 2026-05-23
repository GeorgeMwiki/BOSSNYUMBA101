/**
 * Owner-portal feature flags — Wave-3 INT-4 MD-vision integration.
 *
 * Lightweight client-side flag predicates. The source of truth for
 * production-grade flagging is `platform_feature_flags` (Phase B / B1
 * in central-command). Until the read-port-via-API-client is wired up
 * across apps, we lean on Vite-build envs prefixed with `VITE_FF_` to
 * stay statically-foldable + zero-cost when off.
 *
 * Default behaviour: every new MD-vision flag defaults to OFF in prod
 * so this branch ships with no UI change. Flip the env to `true` to
 * surface the pages. Override at runtime via the URL query `?ff.<name>=1`
 * for QA without a rebuild.
 *
 * Keep this file dependency-free + tree-shakeable.
 */

export type OwnerFeatureFlag =
  | 'executive_brief_enabled'
  | 'parcels_marketplace_enabled'
  | 'workforce_enabled'
  | 'missions_enabled'
  | 'modules_admin_enabled'
  | 'chat_artifact_stream_enabled'
  | 'need_spawn_banner_enabled';

const QUERY_PREFIX = 'ff.';

/**
 * Pure reader — pulls Vite build env. Returns `true` ONLY when the env
 * value is one of `1`, `true`, `on` (case-insensitive). Anything else,
 * including unset, returns `false`.
 *
 * Why strict? We never want a misspelled value (`"yes"`) to silently
 * flip a production flag.
 */
export function readEnvFlag(name: OwnerFeatureFlag): boolean {
  const envKey = `VITE_FF_${name.toUpperCase()}` as const;
  // Vite exposes envs through import.meta.env. Cast through unknown to
  // dodge typecheckers that don't know about Vite's augmented globals.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const raw = env?.[envKey];
  if (!raw) return false;
  const normalised = raw.toLowerCase().trim();
  return normalised === '1' || normalised === 'true' || normalised === 'on';
}

/**
 * Pure URL-override reader — used by QA / canary testers to flip a
 * flag without a build. Looks for `?ff.<name>=1` or `=true`. Returns
 * `null` if the override is not present (caller falls back to env).
 */
export function readQueryOverride(
  name: OwnerFeatureFlag,
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
 * Top-level predicate. Order of resolution:
 *   1. URL query override (highest priority, useful for QA)
 *   2. Vite build env
 *   3. `false` (production-safe default)
 *
 * The `search` argument is injected so callers can test deterministic
 * branches without touching `window.location`.
 */
export function isFeatureEnabled(
  name: OwnerFeatureFlag,
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): boolean {
  const override = readQueryOverride(name, search);
  if (override !== null) return override;
  return readEnvFlag(name);
}
