/**
 * Cache-key derivation for the auto-mode classifier verdict cache.
 *
 * Normalises tool-call args so a repeat with different ordering or
 * with semantically-identical values hits the same cache entry.
 */

import type { ClassifierInput } from './types.js';

/**
 * Stable-stringify with sorted keys + recursive normalisation. Numbers
 * pinned to JSON's canonical form; null/undefined treated as the same.
 * Strings are NOT case-folded — case can matter for IDs.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => stableStringify(v));
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  // bigint, function, symbol → opaque
  return JSON.stringify(String(value));
}

/**
 * Cache key for a classifier input. Tenant + tool + normalised args
 * only — recent conversation deliberately excluded so the cache hits
 * across turns.
 */
export function deriveCacheKey(input: ClassifierInput): string {
  const argsKey = stableStringify(input.args);
  return `${input.tenantId}::${input.toolName}::${argsKey}`;
}
