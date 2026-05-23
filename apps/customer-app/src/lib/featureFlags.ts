/**
 * Customer-app feature flags — Wave-3 INT-4 MD-vision integration.
 *
 * Customer-app gets the smallest slice of MD-vision: only the chat-side
 * UX surfaces (proactive hints, artifact stream, spawn banner) — no
 * admin features. T5 persona constraint enforced server-side; this
 * client gate is defense-in-depth.
 *
 * Same env-overrides-with-URL semantics as the other two apps.
 */

export type CustomerFeatureFlag =
  | 'chat_proactive_hint_enabled'
  | 'chat_artifact_stream_enabled'
  | 'need_spawn_banner_enabled'
  | 'lease_kpi_panel_enabled';

const QUERY_PREFIX = 'ff.';

export function readEnvFlag(name: CustomerFeatureFlag): boolean {
  const envKey = `NEXT_PUBLIC_FF_${name.toUpperCase()}`;
  const raw = process.env[envKey];
  if (!raw) return false;
  const normalised = raw.toLowerCase().trim();
  return normalised === '1' || normalised === 'true' || normalised === 'on';
}

export function readQueryOverride(
  name: CustomerFeatureFlag,
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

export function isFeatureEnabled(
  name: CustomerFeatureFlag,
  search?: string,
): boolean {
  const effectiveSearch =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const override = readQueryOverride(name, effectiveSearch);
  if (override !== null) return override;
  return readEnvFlag(name);
}
