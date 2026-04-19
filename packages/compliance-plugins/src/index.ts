/**
 * @bossnyumba/compliance-plugins — public entrypoint.
 *
 * Usage:
 *   import { getCountryPlugin, availableCountries } from '@bossnyumba/compliance-plugins';
 *   const tz = getCountryPlugin('TZ');
 *   tz.normalizePhone('0712345678'); // '+255712345678'
 *
 * The registry is pre-populated with every bundled plugin at module load time.
 * Callers can register additional / replacement plugins via the exported
 * singleton `countryPluginRegistry`.
 */

import { CountryPluginRegistry } from './core/registry.js';
import type { CountryPlugin } from './core/types.js';

import { kenyaPlugin } from './plugins/kenya.js';
import { nigeriaPlugin } from './plugins/nigeria.js';
import { southAfricaPlugin } from './plugins/south-africa.js';
import { tanzaniaPlugin } from './plugins/tanzania.js';
import { ugandaPlugin } from './plugins/uganda.js';
import { unitedStatesPlugin, withStateOverride } from './plugins/united-states.js';

export * from './core/index.js';
export {
  kenyaPlugin,
  nigeriaPlugin,
  southAfricaPlugin,
  tanzaniaPlugin,
  ugandaPlugin,
  unitedStatesPlugin,
  withStateOverride,
};

/**
 * Default country fallback. The presence of a default is intentional — it
 * stops pathological calls from crashing the process — but EVERY real call
 * site MUST pass a country explicitly. Relying on this default in a request
 * path is a bug.
 */
export const DEFAULT_COUNTRY_ID = 'TZ' as const;

/** Process-wide singleton registry. */
export const countryPluginRegistry = new CountryPluginRegistry();

// Register every bundled plugin at module load.
for (const plugin of [
  tanzaniaPlugin,
  kenyaPlugin,
  ugandaPlugin,
  nigeriaPlugin,
  southAfricaPlugin,
  unitedStatesPlugin,
]) {
  countryPluginRegistry.register(plugin);
}

/** Track whether we've already logged the default-fallback warning. */
let defaultFallbackWarned = false;

/**
 * Resolve a plugin by ISO-3166-1 alpha-2 country code. Case-insensitive.
 *
 * Resolution order:
 *   1. Exact (case-insensitive) match against the registry.
 *   2. DEFAULT_COUNTRY_ID — logged once with an explicit warning.
 *
 * The warning is emitted at most once per process to keep logs readable,
 * but the fallback itself fires on every unknown input so monitoring can
 * still catch it via request tracing.
 */
export function getCountryPlugin(
  countryCode: string | null | undefined
): CountryPlugin {
  if (countryCode) {
    const resolved = countryPluginRegistry.resolve(countryCode);
    if (resolved) return resolved;
  }
  if (!defaultFallbackWarned) {
    console.warn(
      `[compliance-plugins] falling back to DEFAULT_COUNTRY_ID=${DEFAULT_COUNTRY_ID} ` +
        `for input "${countryCode ?? ''}" — every real call path should pass a country explicitly.`
    );
    defaultFallbackWarned = true;
  }
  const fallback = countryPluginRegistry.resolve(DEFAULT_COUNTRY_ID);
  if (!fallback) {
    throw new Error(
      `[compliance-plugins] DEFAULT_COUNTRY_ID=${DEFAULT_COUNTRY_ID} is not registered. ` +
        `This indicates a broken build.`
    );
  }
  return fallback;
}

/** Snapshot of every registered country code (upper-case). */
export function availableCountries(): readonly string[] {
  return countryPluginRegistry.list();
}

/** Reset the one-shot warning flag — intended for test isolation only. */
export function __resetDefaultFallbackWarning(): void {
  defaultFallbackWarned = false;
}
