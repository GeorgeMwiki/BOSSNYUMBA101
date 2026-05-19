/**
 * TabView — the headline K-G contract.
 *
 * The vision: chat is the universal renderer. The owner asks
 * "show me my top-5 employees by tickets-closed" and the MD emits
 * the exact table the `/employees` tab would render — inline,
 * interactive, with provenance. Same for any entity type.
 *
 * Every J3 Section has a paired TabView. The MD can summon the
 * tab's primary view either through tab navigation OR inline in
 * chat via the `renderTabInChat` tool. The contract is symmetric:
 *
 *   J3 Section.component_loader() → React component → renders ag-ui blocks
 *   K-G TabView.renderToBlocks(data, ctx) → ag-ui blocks → rendered the same way
 *
 * So the standalone tab and the in-chat render are literally
 * pixel-equivalent. Tabs become a navigation convenience.
 *
 * `TQuery` and `TData` are intentionally view-specific generics:
 *
 *   - `TQuery` is the input shape the MD passes (filter, sort, limit).
 *   - `TData` is the materialised shape the view renders. Typically
 *     a list of entity-like rows + a few summary aggregates.
 *
 * Each TabView is responsible for its own `fetchData(query, ctx)`
 * adapter — but for J1-backed views the convention is to call the
 * shared `EntityStoreService` once and project to the view's
 * narrower shape. This keeps the per-view code small + composable.
 */

import type { AgUiUiPart } from './ag-ui.js';
import type { Principal } from './principal.js';

/**
 * The eight view shapes. Each maps to one or two ag-ui kinds:
 *
 *   - `table`         → data-table  (with optional row-expand inline)
 *   - `kanban`        → kanban      (drag-drop emits card-moved)
 *   - `chart`         → chart-vega  (filterable + zoomable)
 *   - `kpi-grid`      → kpi-grid    (each tile drillable)
 *   - `matrix`        → data-table  (Hebbia-style — K-F integration)
 *   - `profile-card`  → markdown-card (with embedded cells + edit-in-place)
 *   - `timeline`      → timeline    (chronological events)
 *   - `map`           → map         (markers + geo-fence overlay)
 *
 * The renderer picks the genui primitive that matches `view_kind`.
 * Some `view_kind` values can fall back to others when the data
 * shape doesn't admit the preferred kind (e.g. matrix→table).
 */
export type ViewKind =
  | 'table'
  | 'kanban'
  | 'chart'
  | 'kpi-grid'
  | 'matrix'
  | 'profile-card'
  | 'timeline'
  | 'map';

/**
 * RenderContext — the per-render handle every TabView gets. Carries
 * the viewer principal (so the view can hide sensitive columns),
 * the J1 entity-type the section is centred on, and the customization
 * preference (if any) the owner has saved for this view.
 */
export interface RenderContext {
  readonly principal: Principal;
  /**
   * The J1 entity_type this view is centred on (e.g. `employee`,
   * `lease`, `kra-filing`). Used for query-key prefixing + audit.
   */
  readonly entityType: string;
  /**
   * The session id the renderer is running inside. Optional for
   * standalone tab renders; required for in-chat renders so the
   * J9 blackboard streaming-client can correlate events back to
   * the right message.
   */
  readonly sessionId?: string;
  /**
   * The conversation id. Used as the customization scope key for
   * preferences that should persist for this thread only.
   */
  readonly conversationId?: string;
  /**
   * The view-preference (column order, sort, filters) the owner
   * has previously saved. The view applies it AT RENDER TIME —
   * never at fetch-time — so customisation is portable across
   * data shapes.
   */
  readonly preference?: ViewPreference;
  /**
   * Optional clock injection for deterministic tests.
   */
  readonly now?: () => Date;
}

/**
 * A row-level preference snapshot. The MD stores these as `view_preference`
 * entities in J1 (via the customization module). On the next render the
 * MD looks up the preference by (entityType, scope) and threads it through
 * `RenderContext.preference`.
 */
export interface ViewPreference {
  readonly id: string;
  readonly entityType: string;
  readonly viewKey: string;
  readonly scope: PreferenceScope;
  /** Owner-visible name. Defaults to "Last view of <viewKey>". */
  readonly label?: string;
  readonly columnOrder?: readonly string[];
  readonly hiddenColumns?: readonly string[];
  readonly sortBy?: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>;
  readonly filterBy?: ReadonlyArray<{
    field: string;
    op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'contains';
    value: unknown;
  }>;
  readonly groupBy?: string;
  readonly pageSize?: number;
  readonly updatedAt: string;
}

/**
 * Preference scope — how widely the preference applies.
 *
 *   - `session`       Lives for the current MD session only. Lost on
 *                      session end. Useful for ad-hoc exploration.
 *   - `conversation`  Lives for this conversation. Reapplied each time
 *                      the MD summons the same view in this thread.
 *   - `tenant`        Lives across all conversations for the tenant.
 *                      The owner's "this is how I always want to see it".
 */
export type PreferenceScope = 'session' | 'conversation' | 'tenant';

/**
 * The TabView contract — what every paired view exports.
 *
 * `renderToBlocks` is intentionally synchronous + pure. Data
 * fetching happens BEFORE the call (in the MD orchestrator or the
 * `renderTabInChat` tool). This keeps views deterministically
 * testable + makes it trivial for the MD to construct + emit a
 * view from a Buffered tool-call result.
 */
export interface TabView<TQuery, TData> {
  /** Stable key — registry uniqueness, URL slug, React key, query key. */
  readonly key: string;
  /** Human-readable label. */
  readonly label: string;
  /** The J1 entity_type this view is centred on. */
  readonly entity_type: string;
  /** Primary view shape. */
  readonly view_kind: ViewKind;
  /** Optional fallback shapes if data shape constrains the kind. */
  readonly fallback_view_kinds?: readonly ViewKind[];
  /** Default query the MD uses when nothing is specified. */
  readonly defaultQuery: TQuery;
  /**
   * Validate (and possibly narrow / coerce) a raw query the MD wants
   * to issue. Returning `{ ok: false }` blocks the render. This is
   * the seam at which permission-aware retrieval enforces tenant
   * scope — owner-customer principals may not bypass it via crafted
   * query payloads.
   */
  readonly validateQuery: (query: unknown, ctx: RenderContext) => QueryValidation<TQuery>;
  /**
   * Pure render. The view receives FRESH data + the per-render
   * RenderContext and returns an array of ag-ui blocks ready to
   * stream to the client. The renderer may emit zero blocks if the
   * data is empty (the J9 blackboard collapses empties).
   */
  readonly renderToBlocks: (data: TData, ctx: RenderContext) => readonly AgUiUiPart[];
  /**
   * Sort-order hint, mirroring J3's `Section.sort_order`. Lower =
   * shown earlier in the tab bar. Defaults to `1000` so registry
   * additions land at the end.
   */
  readonly sort_order?: number;
  /**
   * Optional human-readable description — shown in the autocomplete
   * popover when the MD lists available views to the owner.
   */
  readonly description?: string;
}

/**
 * Result of `validateQuery`. `ok: true` returns the narrowed query
 * the view will use. `ok: false` returns a structured error that
 * the render-tool surfaces to the MD verbatim.
 */
export type QueryValidation<TQuery> =
  | { readonly ok: true; readonly query: TQuery }
  | { readonly ok: false; readonly reason: QueryValidationError };

export type QueryValidationError =
  | { readonly kind: 'forbidden'; readonly message: string }
  | { readonly kind: 'invalid-shape'; readonly message: string }
  | { readonly kind: 'limit-exceeded'; readonly message: string }
  | { readonly kind: 'unknown-field'; readonly message: string };
