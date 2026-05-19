/**
 * Convenience constructors for `BlackboardInteractionEvent`.
 *
 * Each builder fills the envelope's stamping fields (`eventId`,
 * `emittedAt`) so call-sites only have to supply the payload +
 * the view-correlation fields.
 *
 * The eventId is built from a high-resolution counter so two
 * events emitted in the same tick are still distinct.
 */

import type {
  BlackboardInteractionEvent,
  InteractionPayload,
  TableSortPayload,
  TableFilterPayload,
  TableRowSelectPayload,
  TableRowExpandPayload,
  TableBulkActionPayload,
  KanbanCardMovedPayload,
  ChartZoomPayload,
  ChartFilterPayload,
  ChartDrilldownPayload,
  KpiDrilldownPayload,
  CellEditPayload,
  ProfileCardActionPayload,
} from './events.js';
import type { Principal } from '../types/principal.js';

let _eventCounter = 0;

function buildEventId(now: () => Date): string {
  _eventCounter = (_eventCounter + 1) % Number.MAX_SAFE_INTEGER;
  const ts = now().toISOString().replace(/[-:.TZ]/g, '');
  return `evt-${ts}-${_eventCounter.toString(36)}`;
}

export interface EventEnvelope {
  readonly viewKey: string;
  readonly entityType: string;
  readonly principal: Principal;
  readonly conversationId?: string;
  readonly sessionId?: string;
  readonly now?: () => Date;
}

/** Generic builder — the one all the specific builders flow through. */
export function buildInteractionEvent(
  envelope: EventEnvelope,
  payload: InteractionPayload,
): BlackboardInteractionEvent {
  const now = envelope.now ?? (() => new Date());
  return {
    eventId: buildEventId(now),
    emittedAt: now().toISOString(),
    viewKey: envelope.viewKey,
    entityType: envelope.entityType,
    principal: envelope.principal,
    ...(envelope.conversationId !== undefined
      ? { conversationId: envelope.conversationId }
      : {}),
    ...(envelope.sessionId !== undefined ? { sessionId: envelope.sessionId } : {}),
    payload,
  };
}

export function buildTableSortEvent(
  envelope: EventEnvelope,
  payload: Omit<TableSortPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'table-sort', ...payload });
}

export function buildTableFilterEvent(
  envelope: EventEnvelope,
  payload: Omit<TableFilterPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'table-filter', ...payload });
}

export function buildTableRowSelectEvent(
  envelope: EventEnvelope,
  payload: Omit<TableRowSelectPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'table-row-select', ...payload });
}

export function buildTableRowExpandEvent(
  envelope: EventEnvelope,
  payload: Omit<TableRowExpandPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'table-row-expand', ...payload });
}

export function buildTableBulkActionEvent(
  envelope: EventEnvelope,
  payload: Omit<TableBulkActionPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'table-bulk-action', ...payload });
}

export function buildKanbanCardMovedEvent(
  envelope: EventEnvelope,
  payload: Omit<KanbanCardMovedPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'kanban-card-moved', ...payload });
}

export function buildChartZoomEvent(
  envelope: EventEnvelope,
  payload: Omit<ChartZoomPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'chart-zoom', ...payload });
}

export function buildChartFilterEvent(
  envelope: EventEnvelope,
  payload: Omit<ChartFilterPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'chart-filter', ...payload });
}

export function buildChartDrilldownEvent(
  envelope: EventEnvelope,
  payload: Omit<ChartDrilldownPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'chart-drilldown', ...payload });
}

export function buildKpiDrilldownEvent(
  envelope: EventEnvelope,
  payload: Omit<KpiDrilldownPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'kpi-drilldown', ...payload });
}

export function buildCellEditEvent(
  envelope: EventEnvelope,
  payload: Omit<CellEditPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, { kind: 'cell-edit', ...payload });
}

export function buildProfileCardActionEvent(
  envelope: EventEnvelope,
  payload: Omit<ProfileCardActionPayload, 'kind'>,
): BlackboardInteractionEvent {
  return buildInteractionEvent(envelope, {
    kind: 'profile-card-action',
    ...payload,
  });
}
