/**
 * Derive a `ViewPreference` from a stream of interaction events.
 *
 * The MD's typical pattern is:
 *
 *   1. Owner asks "show me my arrears". MD calls renderTabInChat;
 *      view renders with default sort.
 *   2. Owner sorts by amount-due desc. Renderer emits a
 *      `table-sort` interaction event.
 *   3. MD applies the event to the current preference draft + writes
 *      to the preference store under `conversation` scope.
 *   4. Next time the owner asks the same question, the MD reads the
 *      preference + threads it into renderTabInChat.
 *
 * `applyEventToPreference` is the pure function that does step 3.
 * It returns a NEW preference — never mutates the input. Empty
 * preferences may be supplied as `{ viewKey, entityType, scope }`.
 */

import type {
  BlackboardInteractionEvent,
  TableSortPayload,
  TableFilterPayload,
} from '../interactivity/events.js';
import type {
  ViewPreference,
  PreferenceScope,
} from '../types/tab-view.js';

/** Build an empty preference draft. */
export function emptyPreference(args: {
  viewKey: string;
  entityType: string;
  scope: PreferenceScope;
  label?: string;
  id?: string;
  updatedAt?: string;
}): ViewPreference {
  return {
    id: args.id ?? '',
    entityType: args.entityType,
    viewKey: args.viewKey,
    scope: args.scope,
    updatedAt: args.updatedAt ?? new Date().toISOString(),
    ...(args.label !== undefined ? { label: args.label } : {}),
  };
}

/**
 * Apply a single interaction event to a preference. Returns a NEW
 * preference; never mutates.
 *
 * Supported event kinds:
 *   - `table-sort`    overrides `sortBy` with a single-key sort
 *   - `table-filter`  overrides `filterBy` with the full filter set
 *
 * Other event kinds return the preference unchanged — they are
 * either non-persistent (table-row-expand, kanban-card-moved) or
 * persist via a different mechanism (cell-edit writes to J1
 * attributes directly).
 */
export function applyEventToPreference(
  prev: ViewPreference,
  event: BlackboardInteractionEvent,
  now: () => Date = () => new Date(),
): ViewPreference {
  const updatedAt = now().toISOString();
  switch (event.payload.kind) {
    case 'table-sort': {
      const p = event.payload as TableSortPayload;
      return {
        ...prev,
        sortBy: [{ field: p.column, direction: p.direction }],
        updatedAt,
      };
    }
    case 'table-filter': {
      const p = event.payload as TableFilterPayload;
      return {
        ...prev,
        filterBy: [...p.filters],
        updatedAt,
      };
    }
    default:
      return prev;
  }
}
