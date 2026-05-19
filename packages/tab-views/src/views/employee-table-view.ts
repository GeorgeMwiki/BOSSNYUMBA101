/**
 * EmployeeTableView — sortable/filterable employee roster table.
 *
 * The owner asks "show me my top-5 employees by tickets-closed".
 * The MD picks this TabView, builds a query that sorts by
 * `tickets_closed_30d` descending limit 5, and emits the same
 * `data-table` ag-ui block the `/employees` tab would render —
 * inline, in chat, with provenance.
 *
 * When the owner taps a row in the chat, the renderer expands a
 * profile card inline showing:
 *   - linkage to the properties the employee manages
 *   - recent activity (last 10 events from the entity timeline)
 *
 * Expand-row events flow back to the MD via the
 * `BlackboardInteractionEvent` stream (see `interactivity/`).
 *
 * Permission semantics:
 *   - owner-customer principals see only their tenant's employees.
 *     The validate step enforces this by ignoring any tenantId
 *     override in the query.
 *   - internal-admin sees their default tenant unless they pass
 *     `allowCrossTenant: true` to the render-tool (audited).
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type EmployeeSortField =
  | 'name'
  | 'tickets_closed_30d'
  | 'avg_ticket_resolution_hours'
  | 'rating';

export interface EmployeeQuery {
  readonly limit?: number;
  readonly sortBy?: EmployeeSortField;
  readonly sortDir?: 'asc' | 'desc';
  readonly roleFilter?: string;
  readonly minRating?: number;
}

export interface EmployeeRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly properties_managed: number;
  readonly tickets_closed_30d: number;
  readonly avg_ticket_resolution_hours: number;
  readonly rating: number;
  readonly last_activity_at: string;
}

export interface EmployeeData {
  readonly rows: readonly EmployeeRow[];
}

const MAX_LIMIT = 200;

function validateEmployeeQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<EmployeeQuery> {
  if (query === undefined || query === null) {
    return {
      ok: true,
      query: { limit: 25, sortBy: 'tickets_closed_30d', sortDir: 'desc' },
    };
  }
  if (typeof query !== 'object') {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'query must be an object or null',
      },
    };
  }
  const q = query as Record<string, unknown>;

  const limit = q['limit'];
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'limit must be a positive integer' },
    };
  }
  if (typeof limit === 'number' && limit > MAX_LIMIT) {
    return {
      ok: false,
      reason: {
        kind: 'limit-exceeded',
        message: `limit must be <= ${MAX_LIMIT}`,
      },
    };
  }

  const sortBy = q['sortBy'];
  const allowedSortFields: readonly EmployeeSortField[] = [
    'name',
    'tickets_closed_30d',
    'avg_ticket_resolution_hours',
    'rating',
  ];
  if (
    sortBy !== undefined &&
    !allowedSortFields.includes(sortBy as EmployeeSortField)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'unknown-field',
        message: `sortBy must be one of: ${allowedSortFields.join(', ')}`,
      },
    };
  }

  const sortDir = q['sortDir'];
  if (sortDir !== undefined && sortDir !== 'asc' && sortDir !== 'desc') {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'sortDir must be "asc" or "desc"',
      },
    };
  }

  const minRating = q['minRating'];
  if (
    minRating !== undefined &&
    (typeof minRating !== 'number' || minRating < 0 || minRating > 5)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'minRating must be a number in [0, 5]',
      },
    };
  }

  const roleFilter = q['roleFilter'];
  if (roleFilter !== undefined && typeof roleFilter !== 'string') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'roleFilter must be a string' },
    };
  }

  const out: EmployeeQuery = {
    limit: (limit as number | undefined) ?? 25,
    sortBy: (sortBy as EmployeeSortField | undefined) ?? 'tickets_closed_30d',
    sortDir: (sortDir as 'asc' | 'desc' | undefined) ?? 'desc',
    ...(roleFilter !== undefined ? { roleFilter: roleFilter as string } : {}),
    ...(minRating !== undefined ? { minRating: minRating as number } : {}),
  };
  return { ok: true, query: out };
}

function renderEmployeeToBlocks(
  data: EmployeeData,
  ctx: RenderContext,
): readonly AgUiUiPart[] {
  const rows = applyEmployeePreference(data.rows, ctx);

  if (rows.length === 0) {
    return [
      {
        kind: 'markdown-card',
        title: 'Employees',
        markdown: 'No employees match the current filter.',
        severity: 'info',
      },
    ];
  }

  return [
    {
      kind: 'data-table',
      title: 'Employees',
      columns: [
        { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
        { id: 'role', header: 'Role', accessorKey: 'role', enableSorting: true },
        {
          id: 'properties_managed',
          header: 'Properties',
          accessorKey: 'properties_managed',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'tickets_closed_30d',
          header: 'Tickets 30d',
          accessorKey: 'tickets_closed_30d',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'avg_ticket_resolution_hours',
          header: 'Avg Resolution (h)',
          accessorKey: 'avg_ticket_resolution_hours',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'rating',
          header: 'Rating',
          accessorKey: 'rating',
          format: 'number',
          enableSorting: true,
        },
      ],
      rows: rows.map((r) => ({ ...r })),
      pageSize: 25,
    },
  ];
}

function applyEmployeePreference(
  rows: readonly EmployeeRow[],
  ctx: RenderContext,
): readonly EmployeeRow[] {
  if (!ctx.preference) return rows;
  let out = [...rows];

  // Apply preference filters first.
  for (const f of ctx.preference.filterBy ?? []) {
    out = out.filter((r) => evalFilter(r as unknown as Record<string, unknown>, f));
  }
  // Apply preference sort. Stable order — the last sortBy entry wins as
  // the primary key; earlier entries become secondary keys.
  const sortBy = ctx.preference.sortBy ?? [];
  if (sortBy.length > 0) {
    out.sort((a, b) => {
      for (const s of sortBy) {
        const av = (a as unknown as Record<string, unknown>)[s.field];
        const bv = (b as unknown as Record<string, unknown>)[s.field];
        const cmp = compareValues(av, bv);
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }
  return out;
}

function evalFilter(
  row: Record<string, unknown>,
  filter: { field: string; op: string; value: unknown },
): boolean {
  const v = row[filter.field];
  switch (filter.op) {
    case 'eq':
      return v === filter.value;
    case 'neq':
      return v !== filter.value;
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(v);
    case 'gte':
      return typeof v === 'number' && typeof filter.value === 'number' && v >= filter.value;
    case 'lte':
      return typeof v === 'number' && typeof filter.value === 'number' && v <= filter.value;
    case 'contains':
      return typeof v === 'string' && typeof filter.value === 'string'
        ? v.toLowerCase().includes(filter.value.toLowerCase())
        : false;
    default:
      return true;
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export const EmployeeTableView: TabView<EmployeeQuery, EmployeeData> = {
  key: 'employee.roster.table',
  label: 'Employees',
  entity_type: 'employee',
  view_kind: 'table',
  defaultQuery: { limit: 25, sortBy: 'tickets_closed_30d', sortDir: 'desc' },
  validateQuery: validateEmployeeQuery,
  renderToBlocks: renderEmployeeToBlocks,
  sort_order: 10,
  description:
    'Sortable employee roster table. Defaults to top-25 by tickets closed in the last 30 days. ' +
    'Click a row to expand a profile card with property linkage and recent activity.',
};
