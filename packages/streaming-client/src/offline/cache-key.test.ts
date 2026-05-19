/**
 * Phase J8 — cache-key tests.
 */

import { describe, expect, it } from 'vitest';
import { cacheKey, parseCacheKey, tabPrefix, tenantPrefix } from './cache-key.js';

describe('cacheKey', () => {
  it('produces a tenant-scoped composite key', () => {
    expect(cacheKey('T1', 'lease', 'E42')).toBe('tenant:T1:tab:lease:entity:E42');
  });

  it('rejects empty inputs', () => {
    expect(() => cacheKey('', 'tab', 'e')).toThrow();
    expect(() => cacheKey('t', '', 'e')).toThrow();
    expect(() => cacheKey('t', 'tab', '')).toThrow();
  });

  it('escapes embedded colons + percents', () => {
    const k = cacheKey('a:b', 'c%d', 'e');
    expect(k).toBe('tenant:a%3Ab:tab:c%25d:entity:e');
    expect(parseCacheKey(k)).toEqual({ tenantId: 'a:b', tabId: 'c%d', entityId: 'e' });
  });

  it('round-trips through parseCacheKey', () => {
    const k = cacheKey('tenant-uuid-1', 'rent-collection', 'lease-99');
    expect(parseCacheKey(k)).toEqual({
      tenantId: 'tenant-uuid-1',
      tabId: 'rent-collection',
      entityId: 'lease-99',
    });
  });

  it('parseCacheKey returns null for invalid input', () => {
    expect(parseCacheKey('not-a-key')).toBeNull();
    expect(parseCacheKey('tenant:t:tab:x')).toBeNull();
    expect(parseCacheKey('garbage:t:tab:x:entity:e')).toBeNull();
  });

  it('tenantPrefix is a strict subset of every cacheKey', () => {
    const k = cacheKey('uuid', 'tab', 'e');
    expect(k.startsWith(tenantPrefix('uuid'))).toBe(true);
  });

  it('tabPrefix includes both tenant and tab segments', () => {
    expect(tabPrefix('t', 'x')).toBe('tenant:t:tab:x:');
  });
});
