/**
 * Types for the `renderTabInChat` tool.
 *
 * The MD invokes the tool with the entity_type the owner asked
 * about. Optional `view_kind` filters which paired view to use
 * when one entity_type has many (e.g. a property can be rendered
 * as a kpi-grid OR a map; the MD picks based on the prompt).
 *
 * `viewKey` is an explicit escape hatch — when the MD knows the
 * exact view to use (e.g. on a follow-up "show me that again"),
 * it can bypass the entity_type → view resolution.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  ViewKind,
  ViewPreference,
  PreferenceScope,
  QueryValidationError,
} from '../types/tab-view.js';
import type { Citation } from '../types/citation.js';

/**
 * The tool input the MD passes.
 */
export interface RenderTabRequest {
  /** REQUIRED unless `viewKey` is provided. */
  readonly entity_type?: string;
  /** Filter when multiple views exist for the entity_type. */
  readonly view_kind?: ViewKind;
  /** Bypass entity_type → view resolution. */
  readonly viewKey?: string;
  /**
   * Free-form query passed through to the view's validateQuery.
   * Each view defines its own shape; the MD discovers the shape
   * via the tool's listViews surface.
   */
  readonly query?: unknown;
  /** Soft top-K limit on rows / events / tiles. */
  readonly limit?: number;
  /**
   * Convenience fields — sort + filter overrides. Merged into
   * `query` before validation. The MD typically expresses these
   * directly in `query`; the convenience shape exists so simple
   * prompts ("sort by name") don't require the MD to know the
   * view-specific query shape.
   */
  readonly sortBy?: string;
  readonly sortDir?: 'asc' | 'desc';
  readonly filterBy?: ReadonlyArray<{
    field: string;
    op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'contains';
    value: unknown;
  }>;
  /** Inline expand-row trigger — the owner tapped a row. */
  readonly expandRow?: { entityId: string };
  /**
   * Cross-tenant escape hatch — internal-admin only. Audited every
   * call. Refused for owner-customer principals.
   */
  readonly allowCrossTenant?: boolean;
  /** Reason carried into audit log when crossing tenant boundary. */
  readonly crossTenantReason?: string;
  /**
   * Optional preference to apply at render time. When present the
   * MD has chosen to override any saved preference for this scope.
   */
  readonly applyPreference?: ViewPreference;
  /**
   * Optional preference scope to look up + apply automatically when
   * `applyPreference` is not provided. Default: `conversation`.
   */
  readonly preferenceScope?: PreferenceScope;
}

/**
 * Result of a successful render. `parts` is the ag-ui block array
 * the MD streams to the client; `citations` is the deduped list
 * of provenance entries the renderer surfaces in the inline
 * "show provenance" disclosure.
 *
 * `audit` carries the structured audit record. The kernel writes
 * it to the audit-log table.
 */
export interface RenderTabSuccess {
  readonly ok: true;
  readonly viewKey: string;
  readonly entity_type: string;
  readonly view_kind: ViewKind;
  readonly parts: readonly AgUiUiPart[];
  readonly citations: readonly Citation[];
  readonly audit: RenderAuditEntry;
}

export interface RenderTabFailure {
  readonly ok: false;
  readonly error: RenderTabError;
}

export type RenderTabResult = RenderTabSuccess | RenderTabFailure;

export type RenderTabError =
  | { readonly kind: 'view-not-found'; readonly message: string }
  | { readonly kind: 'entity-type-unknown'; readonly message: string }
  | { readonly kind: 'forbidden'; readonly message: string }
  | { readonly kind: 'invalid-query'; readonly message: string; readonly cause: QueryValidationError }
  | { readonly kind: 'fetch-failed'; readonly message: string }
  | { readonly kind: 'render-failed'; readonly message: string };

/**
 * Audit-log payload for every render call. The kernel persists
 * this for compliance + debug.
 */
export interface RenderAuditEntry {
  readonly auditId: string;
  readonly viewKey: string;
  readonly entity_type: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly crossTenant: boolean;
  readonly reason?: string;
  readonly renderedAt: string;
  readonly partKindsEmitted: readonly string[];
  readonly rowCountHint?: number;
}
