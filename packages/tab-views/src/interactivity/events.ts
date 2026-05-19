/**
 * In-chat interactivity event protocol.
 *
 * Every rendered view supports the same interactions the standalone
 * tab would support. When the user interacts with a rendered block
 * (sorts a header, drags a kanban card, selects rows, zooms a chart),
 * the renderer emits a `BlackboardInteractionEvent` back to the MD
 * via the J9 streaming-client.
 *
 * The MD's interaction handler:
 *   - acknowledges the event (so the renderer knows the side-effect
 *     is in flight)
 *   - mutates blackboard state (e.g. saves the new sort to the
 *     conversation-scope preference)
 *   - kicks off follow-up actions (e.g. an `expand-row` triggers a
 *     follow-up renderTabInChat call to load the row's detail card)
 *
 * Events are a sum type discriminated by `kind`. New kinds are
 * added additively; consumers MUST handle the discriminator
 * exhaustively so a missing branch fails the typecheck.
 */

import type { Principal } from '../types/principal.js';

/**
 * The single envelope every interaction event uses. The renderer
 * stamps the envelope; the MD reads `viewKey`, `entityType`, and
 * `payload.kind` to route the event.
 */
export interface BlackboardInteractionEvent {
  /** Stable event id — used for idempotency + acks. */
  readonly eventId: string;
  /** ISO-8601 client-emit timestamp. */
  readonly emittedAt: string;
  /** The view that emitted the event. */
  readonly viewKey: string;
  /** The J1 entity_type the view is centred on. */
  readonly entityType: string;
  /** The principal who interacted. */
  readonly principal: Principal;
  /** The conversation + session the event belongs to. */
  readonly conversationId?: string;
  readonly sessionId?: string;
  /** The interaction payload — discriminated by `kind`. */
  readonly payload: InteractionPayload;
}

/**
 * The full set of interaction payloads. Adding a new kind:
 *   1. Add the kind here as a new branch of the union.
 *   2. Add a constructor (`buildXxxEvent`) below if convenient.
 *   3. Update the MD's interaction handler to handle the new branch
 *      — the typecheck will fail until you do.
 */
export type InteractionPayload =
  | TableSortPayload
  | TableFilterPayload
  | TableRowSelectPayload
  | TableRowExpandPayload
  | TableBulkActionPayload
  | KanbanCardMovedPayload
  | ChartZoomPayload
  | ChartFilterPayload
  | ChartDrilldownPayload
  | KpiDrilldownPayload
  | CellEditPayload
  | ProfileCardActionPayload;

export interface TableSortPayload {
  readonly kind: 'table-sort';
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export interface TableFilterPayload {
  readonly kind: 'table-filter';
  readonly filters: ReadonlyArray<{
    field: string;
    op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'contains';
    value: unknown;
  }>;
}

export interface TableRowSelectPayload {
  readonly kind: 'table-row-select';
  /** `select-all` selects every row matching the current filter. */
  readonly mode: 'single' | 'multi' | 'select-all' | 'clear';
  readonly rowIds: readonly string[];
}

export interface TableRowExpandPayload {
  readonly kind: 'table-row-expand';
  readonly entityId: string;
  /** When true, the renderer collapses the inline expansion. */
  readonly collapse?: boolean;
}

export interface TableBulkActionPayload {
  readonly kind: 'table-bulk-action';
  readonly action: string;
  readonly entityIds: readonly string[];
  readonly args?: Readonly<Record<string, unknown>>;
}

export interface KanbanCardMovedPayload {
  readonly kind: 'kanban-card-moved';
  readonly cardId: string;
  readonly fromColumn: string;
  readonly toColumn: string;
  readonly newIndex: number;
}

export interface ChartZoomPayload {
  readonly kind: 'chart-zoom';
  /** ISO-8601 — for time-series charts. */
  readonly xFrom?: string;
  readonly xTo?: string;
  readonly yMin?: number;
  readonly yMax?: number;
}

export interface ChartFilterPayload {
  readonly kind: 'chart-filter';
  readonly series: readonly string[];
}

export interface ChartDrilldownPayload {
  readonly kind: 'chart-drilldown';
  /** The X-axis value the user clicked on (e.g. a month name). */
  readonly xValue: string | number;
  readonly seriesId?: string;
}

export interface KpiDrilldownPayload {
  readonly kind: 'kpi-drilldown';
  readonly tileLabel: string;
}

export interface CellEditPayload {
  readonly kind: 'cell-edit';
  readonly entityId: string;
  readonly attributeKey: string;
  readonly previousValue: unknown;
  readonly newValue: unknown;
}

export interface ProfileCardActionPayload {
  readonly kind: 'profile-card-action';
  readonly actionId: string;
  readonly entityId: string;
  readonly args?: Readonly<Record<string, unknown>>;
}

/**
 * Ack envelope the MD sends back to the renderer once the event
 * has been processed. The renderer uses the ack to clear the
 * "in flight" overlay on the affected block.
 */
export interface InteractionAck {
  readonly eventId: string;
  readonly acceptedAt: string;
  readonly status: 'accepted' | 'rejected' | 'queued';
  readonly reason?: string;
  /**
   * Optional follow-up parts the MD streams as a consequence of
   * the event. e.g. table-row-expand → a `markdown-card` with the
   * row's expanded detail.
   */
  readonly followUpParts?: ReadonlyArray<{ readonly kind: string; readonly [k: string]: unknown }>;
}
