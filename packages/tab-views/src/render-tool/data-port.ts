/**
 * DataPort — the pluggable adapter the render-tool uses to fetch
 * the materialised view data from the J1 entity store.
 *
 * The tab-views package does NOT import `@bossnyumba/entity-store`
 * directly — that would couple every render-tool consumer to the
 * substrate. Instead the render-tool accepts a `DataPort` at
 * construction time and asks it for the data shape every view
 * needs.
 *
 * In production the port is implemented by the central-intelligence
 * package, which projects J1 entity + attributes + relations down
 * to the per-view shape. In tests the port is a tiny stub that
 * returns canned data — letting us test render-tool semantics
 * without spinning up a database.
 *
 * Permission semantics:
 *   Every DataPort method takes the principal. The implementation
 *   MUST scope the query to `principal.tenantId` and refuse cross-
 *   tenant access unless `allowCrossTenant: true` is set AND the
 *   principal is internal-admin.
 */

import type { Principal } from '../types/principal.js';
import type { Citation } from '../types/citation.js';

export interface DataFetchOptions {
  readonly allowCrossTenant?: boolean;
  readonly crossTenantReason?: string;
  /** Inline expand-row hint — fetch the row's expanded payload. */
  readonly expandRow?: { entityId: string };
  /** Soft top-K cap. Views may further constrain. */
  readonly limit?: number;
}

export interface DataFetchResult<TData> {
  readonly data: TData;
  readonly citations: readonly Citation[];
  readonly crossTenant: boolean;
  readonly rowCountHint?: number;
}

export interface DataPort {
  /**
   * Fetch the materialised view data for `viewKey`. The query
   * shape is opaque to the port — the per-view fetcher knows how
   * to use it.
   */
  fetchViewData<TData>(args: {
    viewKey: string;
    entity_type: string;
    query: unknown;
    principal: Principal;
    options: DataFetchOptions;
  }): Promise<DataFetchResult<TData>>;
}

/**
 * Build a no-op port — every call returns `{ data: {} as TData,
 * citations: [], crossTenant: false }`. Useful when the render-tool
 * is used purely to validate a query without actually fetching
 * (e.g. eager preview in the chat composer).
 */
export function createNoopDataPort(): DataPort {
  return {
    async fetchViewData<TData>(_args: {
      viewKey: string;
      entity_type: string;
      query: unknown;
      principal: Principal;
      options: DataFetchOptions;
    }): Promise<DataFetchResult<TData>> {
      return {
        data: {} as TData,
        citations: [],
        crossTenant: false,
      };
    },
  };
}

/**
 * Build a memoised port — the same `(viewKey, query, principal)`
 * tuple returns the cached result. Useful for in-process tests +
 * the streaming-client's preview pane that re-renders on every
 * keystroke.
 *
 * Cache key includes the principal kind + tenantId so two
 * principals can never see each other's cached data. We do NOT
 * include the `principalId` — same tenant + same kind = same scope
 * — so multiple owner-customers on the same tenant share cache.
 */
export function createMemoisedDataPort(inner: DataPort): DataPort {
  const cache = new Map<string, DataFetchResult<unknown>>();
  return {
    async fetchViewData<TData>(args: {
      viewKey: string;
      entity_type: string;
      query: unknown;
      principal: Principal;
      options: DataFetchOptions;
    }): Promise<DataFetchResult<TData>> {
      const key = JSON.stringify({
        v: args.viewKey,
        e: args.entity_type,
        q: args.query,
        t: args.principal.tenantId,
        k: args.principal.kind,
        x: args.options.allowCrossTenant === true,
        r: args.options.expandRow?.entityId ?? null,
        l: args.options.limit ?? null,
      });
      const cached = cache.get(key);
      if (cached !== undefined) return cached as DataFetchResult<TData>;
      const fresh = await inner.fetchViewData<TData>(args);
      cache.set(key, fresh);
      return fresh;
    },
  };
}
