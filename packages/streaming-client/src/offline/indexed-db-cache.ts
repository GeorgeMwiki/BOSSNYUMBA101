/**
 * Phase J8 — OfflineCache (idb-keyval-backed).
 *
 * Wraps `idb-keyval` to keep this layer tiny: we serialise the entire
 * `CachedEntity` blob under its key. List + tenant-eviction + high-
 * watermark are implemented by scanning keys (cheap — IndexedDB keys
 * live in a B-tree). The whole module fits comfortably under the
 * 250-line cap and replaces the previous hand-rolled IndexedDB wrapper.
 *
 * Why idb-keyval (not raw IDB):
 * - Six lines of code for the happy path; no schema/upgrade ceremony.
 * - Promise-native (no `onsuccess`/`onerror` ladder).
 * - 600B gzip — irrelevant on the phone bundle.
 * - Battle-tested (Jake Archibald's library, 5M weekly downloads).
 */

import {
  createStore,
  del,
  get,
  getMany,
  keys,
  set,
  setMany,
  type UseStore,
} from 'idb-keyval';

import type { CachedEntity, OfflineCacheAdapter } from '../types.js';
import { tabPrefix, tenantPrefix } from './cache-key.js';

export interface IndexedDBCacheDeps {
  /** DB name. Defaults to `bossnyumba-offline`. */
  dbName?: string;
  /** Object-store name. Defaults to `entities`. */
  storeName?: string;
  /**
   * Inject a pre-built `idb-keyval` store. Tests pass in a fake-indexeddb
   * backed store so they don't touch the real browser DB.
   */
  store?: UseStore;
}

const DEFAULT_DB = 'bossnyumba-offline';
const DEFAULT_STORE = 'entities';

export class IndexedDbOfflineCache implements OfflineCacheAdapter {
  private readonly store: UseStore;

  constructor(deps: IndexedDBCacheDeps = {}) {
    this.store =
      deps.store ?? createStore(deps.dbName ?? DEFAULT_DB, deps.storeName ?? DEFAULT_STORE);
  }

  // ─────────────────────────────────────────────────────────────────
  // OfflineCacheAdapter implementation
  // ─────────────────────────────────────────────────────────────────

  async put<T>(entity: CachedEntity<T>): Promise<void> {
    await set(entity.key, entity, this.store);
  }

  async putBatch<T>(entities: Array<CachedEntity<T>>): Promise<void> {
    if (entities.length === 0) return;
    const tuples: Array<[IDBValidKey, CachedEntity<T>]> = entities.map((e) => [e.key, e]);
    await setMany(tuples, this.store);
  }

  async get<T>(key: string): Promise<CachedEntity<T> | null> {
    const value = await get<CachedEntity<T> | undefined>(key, this.store);
    return value ?? null;
  }

  async list<T>(tenantId: string, tabId: string, limit: number): Promise<Array<CachedEntity<T>>> {
    if (limit <= 0) return [];
    const matched = await this.matchingKeys(tabPrefix(tenantId, tabId));
    if (matched.length === 0) return [];
    const values = await getMany<CachedEntity<T> | undefined>(matched, this.store);
    const present = values.filter((v): v is CachedEntity<T> => v !== undefined);
    // Most-recent-first ordering — `cachedAt` desc — matches what the
    // tab pagination expects from a "load latest N" call.
    present.sort((a, b) => b.cachedAt - a.cachedAt);
    return present.slice(0, limit);
  }

  async evictTenant(tenantId: string): Promise<void> {
    const matched = await this.matchingKeys(tenantPrefix(tenantId));
    if (matched.length === 0) return;
    await Promise.all(matched.map((k) => del(k, this.store)));
  }

  async highWatermark(tenantId: string, tabId: string): Promise<number> {
    const matched = await this.matchingKeys(tabPrefix(tenantId, tabId));
    if (matched.length === 0) return 0;
    const values = await getMany<CachedEntity<unknown> | undefined>(matched, this.store);
    let max = 0;
    for (const v of values) {
      if (v && typeof v.version === 'number' && v.version > max) max = v.version;
    }
    return max;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private — key-prefix scan
  // ─────────────────────────────────────────────────────────────────

  private async matchingKeys(prefix: string): Promise<IDBValidKey[]> {
    const all = await keys(this.store);
    return all.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
  }
}
