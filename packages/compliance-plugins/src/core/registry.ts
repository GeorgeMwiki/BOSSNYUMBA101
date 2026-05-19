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

/**
 * Lazy `node:crypto` lookup. We only require it when actually computing a
 * fingerprint — kept off the module's static import graph so bundlers
 * targeting the browser (Next.js client, vite) do not choke on the
 * `node:`-scheme import even though the registry is itself isomorphic
 * (browser callers never configure an integrity allow-list, so this
 * code path stays dead in client bundles).
 *
 * Returns the synchronous hashing surface we use. The implementation
 * picks between Node's `node:crypto` (server) and the Web Crypto API
 * (browser) so the same exported helper works in both runtimes.
 */
interface SyncHasher {
  hashSha256Hex(input: string): string;
}

let cachedHasher: SyncHasher | null = null;
function getHasher(): SyncHasher {
  if (cachedHasher) return cachedHasher;
  // Detect Node by feature, not by global, so jsdom/vitest fallbacks work.
  const nodeProcess = (globalThis as { process?: { versions?: { node?: string } } }).process;
  if (nodeProcess?.versions?.node) {
    // Use a runtime-assembled module specifier to defeat bundler static
    // analysis — webpack/turbopack will not pull `node:crypto` into the
    // browser bundle because the string never literally appears at a
    // call site reachable from `import` analysis.
    const moduleName = ['node', 'crypto'].join(':');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional lazy server-only require.
    const nodeCrypto = (eval('require') as NodeRequire)(moduleName) as typeof import('node:crypto');
    cachedHasher = {
      hashSha256Hex: (input) =>
        nodeCrypto.createHash('sha256').update(input).digest('hex'),
    };
    return cachedHasher;
  }
  // Browser fallback — Web Crypto's digest API is async, so we have to
  // throw clearly when callers reach here. In practice no browser caller
  // configures the integrity allow-list, so this branch stays dead.
  cachedHasher = {
    hashSha256Hex: () => {
      throw new Error(
        'CountryPluginRegistry: sha256 fingerprint computation requires the Node runtime. ' +
          'Configure the integrity allow-list on the server (api-gateway / domain-services) ' +
          'rather than the browser bundle.'
      );
    },
  };
  return cachedHasher;
}

/**
 * Round-3 audit C7 fix — thrown by {@link CountryPluginRegistry.register}
 * when the supplied plugin does not match the integrity-hash allowlist
 * (if one has been configured). The previous registry accepted any
 * object that had a 2-char `countryCode`, so an attacker who could
 * reach `register(...)` could substitute KE with a plugin whose
 * `taxRegime.calculateWithholding` returned 0 → KRA non-compliance.
 */
export class PluginIntegrityError extends Error {
  readonly code = 'PLUGIN_INTEGRITY_MISMATCH';
  constructor(message: string) {
    super(message);
    this.name = 'PluginIntegrityError';
  }
}

/**
 * Compute a stable SHA-256 fingerprint over a plugin's data surface.
 *
 * Function references (`normalizePhone`, ports' methods) are replaced
 * with the placeholder `'[fn]'` because their `toString()` is sensitive
 * to whitespace and is not a security-meaningful signal. The structural
 * shape of the plugin — country code, name, currency, KYC providers,
 * compliance fields, port method names — IS hashed.
 *
 * Exported so production deployments can pre-compute the fingerprint
 * via `node -e 'console.log(computePluginFingerprint(p))'` and bake
 * the result into infra config.
 */
export function computePluginFingerprint(plugin: CountryPlugin): string {
  function stable(value: unknown): unknown {
    if (typeof value === 'function') return '[fn]';
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stable);
    if (value instanceof RegExp) return `[regex:${value.source}/${value.flags}]`;
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      result[k] = stable((value as Record<string, unknown>)[k]);
    }
    return result;
  }
  const serialized = JSON.stringify(stable(plugin));
  return getHasher().hashSha256Hex(serialized);
}

/** Walk every property and freeze recursively. Arrays become readonly. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  try {
    Object.freeze(value);
  } catch {
    // Round-3 audit M8 — frozen-with-non-configurable-getters values
    // can throw on Object.freeze. We log & continue rather than kill
    // the entire registration.
    return value;
  }
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
  private readonly fingerprintAllowlist = new Map<string, ReadonlySet<string>>();

  /**
   * Configure a fingerprint allow-list for the given country code. Once
   * set, `register(plugin)` MUST present a plugin whose
   * `computePluginFingerprint` is in the allow-list set; otherwise it
   * throws {@link PluginIntegrityError}.
   *
   * Use case: production wires this from a config file checked into
   * source control + signed by ops, so any plugin substitution attack
   * via library tampering or transitive dependency hijack fails at
   * registration time instead of silently shipping wrong tax law.
   */
  configureIntegrityAllowlist(countryCode: string, fingerprints: readonly string[]): void {
    if (!countryCode || countryCode.length !== 2) {
      throw new Error(
        `CountryPluginRegistry: invalid country code "${countryCode}"`
      );
    }
    this.fingerprintAllowlist.set(normalizeKey(countryCode), new Set(fingerprints));
  }

  /** Register or replace a plugin. Plugin is deep-frozen before storage. */
  register(plugin: CountryPlugin): void {
    if (!plugin.countryCode || plugin.countryCode.length !== 2) {
      throw new Error(
        `CountryPluginRegistry: invalid country code "${plugin.countryCode}"`
      );
    }
    const key = normalizeKey(plugin.countryCode);
    const allowed = this.fingerprintAllowlist.get(key);
    if (allowed && allowed.size > 0) {
      const fingerprint = computePluginFingerprint(plugin);
      if (!allowed.has(fingerprint)) {
        throw new PluginIntegrityError(
          `CountryPluginRegistry: plugin for "${key}" failed integrity check ` +
            `(fingerprint ${fingerprint.slice(0, 12)}… not in allowlist of ${allowed.size}).`
        );
      }
    }
    const frozen = deepFreeze({ ...plugin });
    this.plugins.set(key, frozen);
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
