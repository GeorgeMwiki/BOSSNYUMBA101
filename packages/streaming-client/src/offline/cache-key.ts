/**
 * Phase J8 — cache-key utilities.
 *
 * Key design (CRITICAL):
 *
 *   tenant:<tenantId>:tab:<tabId>:entity:<entityId>
 *
 * Why tenant-scoped of course:
 * - Same browser is used by a property manager who works for two
 *   agencies → tenant-A and tenant-B must NEVER see each other's
 *   cached entities. Scoping at the key prefix means an `evictTenant`
 *   call is a single range-delete.
 * - Logout / tenant-switch flushes by prefix scan: 1-pass over the
 *   index, O(N_tenant) not O(N_all).
 *
 * The tabId segment lets diff-sync ask "what's the highest version I
 * have for tab `lease-renewals`" without scanning the whole store.
 *
 * Reserved characters: ':' is the segment delimiter, so any input that
 * contains `:` is HEX-encoded. tenantId is a UUIDv4 in production so
 * the escape never fires there, but the helper guards generic callers.
 */

const SEP = ':';

function escapeSegment(value: string): string {
  if (!value.includes(SEP) && !value.includes('%')) return value;
  return value.replace(/%/g, '%25').replace(/:/g, '%3A');
}

export function cacheKey(tenantId: string, tabId: string, entityId: string): string {
  if (!tenantId || !tabId || !entityId) {
    throw new Error('cacheKey requires tenantId, tabId and entityId');
  }
  return [
    'tenant',
    escapeSegment(tenantId),
    'tab',
    escapeSegment(tabId),
    'entity',
    escapeSegment(entityId),
  ].join(SEP);
}

export function tenantPrefix(tenantId: string): string {
  return `tenant${SEP}${escapeSegment(tenantId)}${SEP}`;
}

export function tabPrefix(tenantId: string, tabId: string): string {
  return `tenant${SEP}${escapeSegment(tenantId)}${SEP}tab${SEP}${escapeSegment(tabId)}${SEP}`;
}

export function parseCacheKey(key: string): { tenantId: string; tabId: string; entityId: string } | null {
  const parts = key.split(SEP);
  if (parts.length !== 6) return null;
  if (parts[0] !== 'tenant' || parts[2] !== 'tab' || parts[4] !== 'entity') return null;
  return {
    tenantId: decodeURIComponent((parts[1] ?? '').replace(/%3A/gi, ':')),
    tabId: decodeURIComponent((parts[3] ?? '').replace(/%3A/gi, ':')),
    entityId: decodeURIComponent((parts[5] ?? '').replace(/%3A/gi, ':')),
  };
}
