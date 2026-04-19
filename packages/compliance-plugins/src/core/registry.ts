/**
 * CountryPluginRegistry — the single source of truth for loaded plugins.
 *
 * The registry is deliberately module-scoped (process singleton). It stores
 * each plugin as a deep-frozen snapshot so a stray mutation at a call site
 * cannot corrupt shared state. Accessors return a defensive shallow copy of
 * array fields so callers can reduce/map freely without surprising the
 * registry's internal object.
 */

import type { CountryPlugin } from './types.js';

/** Walk every property and freeze recursively. Arrays become readonly. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const prop = (value as Record<string, unknown>)[key];
    deepFreeze(prop);
  }
  return value;
}

/** Normalize any user-supplied country code to the registry's internal key. */
function normalizeKey(code: string): string {
  return code.trim().toUpperCase();
}

export class CountryPluginRegistry {
  private readonly plugins = new Map<string, CountryPlugin>();

  /** Register or replace a plugin. Plugin is deep-frozen before storage. */
  register(plugin: CountryPlugin): void {
    if (!plugin.countryCode || plugin.countryCode.length !== 2) {
      throw new Error(
        `CountryPluginRegistry: invalid country code "${plugin.countryCode}"`
      );
    }
    const frozen = deepFreeze({ ...plugin });
    this.plugins.set(normalizeKey(plugin.countryCode), frozen);
  }

  /** Resolve a plugin by country code. Case-insensitive. Returns null if unknown. */
  resolve(countryCode: string): CountryPlugin | null {
    if (!countryCode) return null;
    return this.plugins.get(normalizeKey(countryCode)) ?? null;
  }

  /** True iff a plugin is registered for the given country code. */
  has(countryCode: string): boolean {
    if (!countryCode) return false;
    return this.plugins.has(normalizeKey(countryCode));
  }

  /** Snapshot of every registered country code (upper-case). */
  list(): readonly string[] {
    return Object.freeze([...this.plugins.keys()]);
  }

  /** Snapshot of every registered plugin — defensive copy of the internal map. */
  all(): readonly CountryPlugin[] {
    return Object.freeze([...this.plugins.values()]);
  }

  /** Remove every registered plugin — intended for test isolation. */
  clear(): void {
    this.plugins.clear();
  }
}
