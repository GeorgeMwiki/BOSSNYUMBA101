/**
 * TabViewRegistry — the store the MD uses to discover which views
 * exist for which entity types.
 *
 * Mirrors the immutable-store pattern in J3's `SectionRegistry`:
 *   - construction is empty
 *   - `register(view)` returns a NEW registry; the original is unchanged
 *   - lookups are O(1) keyed by `view.key`
 *   - one entity_type can have many views (e.g. employees can be
 *     rendered as a table OR a kanban OR a kpi grid)
 *
 * The registry never mutates. Every `register*` call returns a new
 * registry — same shape as the J1 EntityStoreService's immutable
 * conventions. This makes the registry trivially safe to share
 * across renders + workers.
 */

import type { TabView } from '../types/tab-view.js';

export class TabViewRegistry {
  private readonly byKey: ReadonlyMap<string, TabView<unknown, unknown>>;
  private readonly byEntityType: ReadonlyMap<string, readonly TabView<unknown, unknown>[]>;

  public constructor(
    views: ReadonlyMap<string, TabView<unknown, unknown>> = new Map(),
  ) {
    this.byKey = views;
    // Build the per-entity-type index. Sorted by sort_order asc, then
    // by key asc so registry ordering is fully deterministic.
    const mutable = new Map<string, TabView<unknown, unknown>[]>();
    for (const view of views.values()) {
      const bucket = mutable.get(view.entity_type) ?? [];
      bucket.push(view);
      mutable.set(view.entity_type, bucket);
    }
    const frozen = new Map<string, readonly TabView<unknown, unknown>[]>();
    for (const [k, list] of mutable) {
      list.sort((a, b) => {
        const aOrder = a.sort_order ?? 1000;
        const bOrder = b.sort_order ?? 1000;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.key.localeCompare(b.key);
      });
      frozen.set(k, Object.freeze([...list]));
    }
    this.byEntityType = frozen;
  }

  /**
   * Register a new TabView. Throws if a view with the same key
   * already exists — the MD must explicitly `deregister` first.
   * Returns a NEW registry.
   */
  public register<TQuery, TData>(view: TabView<TQuery, TData>): TabViewRegistry {
    if (this.byKey.has(view.key)) {
      throw new Error(
        `tab-views: duplicate registration for view key "${view.key}". ` +
          `Call deregister() first if you intend to replace it.`,
      );
    }
    const next = new Map(this.byKey);
    next.set(view.key, view as unknown as TabView<unknown, unknown>);
    return new TabViewRegistry(next);
  }

  /**
   * Register many views in one shot. Bulk version of `register` —
   * throws on first duplicate. Useful for seeding.
   */
  public registerAll(
    views: ReadonlyArray<TabView<unknown, unknown>>,
  ): TabViewRegistry {
    let r: TabViewRegistry = this;
    for (const v of views) {
      // `register` is generic — pass through to bind the registry's
      // unknown-typed slot.
      r = r.register<unknown, unknown>(v);
    }
    return r;
  }

  /**
   * Drop a view by key. Returns a NEW registry. No-op if the view
   * isn't present.
   */
  public deregister(key: string): TabViewRegistry {
    if (!this.byKey.has(key)) return this;
    const next = new Map(this.byKey);
    next.delete(key);
    return new TabViewRegistry(next);
  }

  /** Lookup a view by key. Returns `undefined` if absent. */
  public get(key: string): TabView<unknown, unknown> | undefined {
    return this.byKey.get(key);
  }

  /** Predicate counterpart of `get`. */
  public has(key: string): boolean {
    return this.byKey.has(key);
  }

  /** All views registered for `entity_type`, sorted. */
  public forEntityType(entity_type: string): readonly TabView<unknown, unknown>[] {
    return this.byEntityType.get(entity_type) ?? [];
  }

  /** All registered entity_types (deduped). */
  public entityTypes(): readonly string[] {
    return Array.from(this.byEntityType.keys()).sort();
  }

  /** All views, in registration-order-stable sort. */
  public all(): readonly TabView<unknown, unknown>[] {
    const seen = new Set<string>();
    const out: TabView<unknown, unknown>[] = [];
    for (const list of this.byEntityType.values()) {
      for (const v of list) {
        if (seen.has(v.key)) continue;
        seen.add(v.key);
        out.push(v);
      }
    }
    return Object.freeze(out);
  }

  /** Total number of registered views. */
  public get size(): number {
    return this.byKey.size;
  }
}

/**
 * Build an empty registry. Convenience factory mirroring
 * `new TabViewRegistry()` for parity with J3.
 */
export function createTabViewRegistry(): TabViewRegistry {
  return new TabViewRegistry();
}
