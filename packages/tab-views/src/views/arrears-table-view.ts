/**
 * ArrearsTableView — ranked arrears table with bulk-action toolbar.
 *
 * The owner asks "who are my top arrears tenants?". The MD picks
 * this view, computes the days-late × amount-due rank, and emits
 * the `data-table` ag-ui block — with a `prompt-suggestions` block
 * appended so the owner can tap "select all + send reminder" right
 * in chat.
 *
 * Rank score: `daysLate * amountDueCents`. Higher = worse. Defaults
 * descending. Customisation persists via `view_preference`.
 *
 * Row-click expands recent communication history inline (handled
 * by the interactivity protocol; the renderer emits the
 * `expand-row` event back to the MD which then summons a follow-up
 * timeline block).
 *
 * The follow-up `prompt-suggestions` is the secret sauce that
 * makes K-G feel like "chat as workspace": the bulk-action affordance
 * is rendered alongside the data, so the owner never has to leave
 * the conversation to act on what the data shows.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type ArrearsSortField = 'rank' | 'daysLate' | 'amountDue' | 'tenantName';

export interface ArrearsQuery {
  readonly limit?: number;
  readonly sortBy?: ArrearsSortField;
  readonly sortDir?: 'asc' | 'desc';
  readonly minDaysLate?: number;
  readonly minAmountDueCents?: number;
}

export interface ArrearsRow {
  readonly id: string;
  readonly tenantPersonId: string;
  readonly tenantName: string;
  readonly leaseId: string;
  readonly propertyLabel: string;
  readonly amountDueCents: number;
  readonly daysLate: number;
  /** `daysLate * amountDueCents`; populated by the fetcher. */
  readonly rank: number;
  readonly currency: string;
  readonly lastContactedAt?: string;
}

export interface ArrearsData {
  readonly rows: readonly ArrearsRow[];
}

const MAX_LIMIT = 500;
const ALLOWED_SORT_FIELDS: readonly ArrearsSortField[] = [
  'rank',
  'daysLate',
  'amountDue',
  'tenantName',
];

function validateArrearsQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<ArrearsQuery> {
  if (query === undefined || query === null) {
    return {
      ok: true,
      query: { limit: 25, sortBy: 'rank', sortDir: 'desc' },
    };
  }
  if (typeof query !== 'object') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'query must be an object or null' },
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
      reason: { kind: 'limit-exceeded', message: `limit must be <= ${MAX_LIMIT}` },
    };
  }

  const sortBy = q['sortBy'];
  if (sortBy !== undefined && !ALLOWED_SORT_FIELDS.includes(sortBy as ArrearsSortField)) {
    return {
      ok: false,
      reason: {
        kind: 'unknown-field',
        message: `sortBy must be one of: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      },
    };
  }

  const sortDir = q['sortDir'];
  if (sortDir !== undefined && sortDir !== 'asc' && sortDir !== 'desc') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'sortDir must be "asc" or "desc"' },
    };
  }

  const minDaysLate = q['minDaysLate'];
  if (minDaysLate !== undefined && (typeof minDaysLate !== 'number' || minDaysLate < 0)) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'minDaysLate must be a non-negative number',
      },
    };
  }

  const minAmountDueCents = q['minAmountDueCents'];
  if (
    minAmountDueCents !== undefined &&
    (typeof minAmountDueCents !== 'number' || minAmountDueCents < 0)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'minAmountDueCents must be a non-negative number',
      },
    };
  }

  const out: ArrearsQuery = {
    limit: (limit as number | undefined) ?? 25,
    sortBy: (sortBy as ArrearsSortField | undefined) ?? 'rank',
    sortDir: (sortDir as 'asc' | 'desc' | undefined) ?? 'desc',
    ...(minDaysLate !== undefined ? { minDaysLate: minDaysLate as number } : {}),
    ...(minAmountDueCents !== undefined
      ? { minAmountDueCents: minAmountDueCents as number }
      : {}),
  };
  return { ok: true, query: out };
}

function renderArrearsToBlocks(
  data: ArrearsData,
  _ctx: RenderContext,
): readonly AgUiUiPart[] {
  if (data.rows.length === 0) {
    return [
      {
        kind: 'markdown-card',
        title: 'Arrears',
        markdown: 'No tenants currently in arrears.',
        severity: 'success',
      },
    ];
  }

  const currency = data.rows[0]?.currency ?? 'KES';
  const rows = data.rows.map((r) => ({
    id: r.id,
    tenantName: r.tenantName,
    propertyLabel: r.propertyLabel,
    daysLate: r.daysLate,
    amountDue: r.amountDueCents / 100,
    rank: r.rank,
    lastContacted: r.lastContactedAt ?? null,
  }));

  return [
    {
      kind: 'data-table',
      title: 'Arrears',
      columns: [
        {
          id: 'tenantName',
          header: 'Tenant',
          accessorKey: 'tenantName',
          enableSorting: true,
        },
        {
          id: 'propertyLabel',
          header: 'Property',
          accessorKey: 'propertyLabel',
          enableSorting: true,
        },
        {
          id: 'daysLate',
          header: 'Days Late',
          accessorKey: 'daysLate',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'amountDue',
          header: 'Amount Due',
          accessorKey: 'amountDue',
          format: 'currency',
          currency: currency as 'KES' | 'TZS' | 'USD',
          enableSorting: true,
        },
        {
          id: 'rank',
          header: 'Severity',
          accessorKey: 'rank',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'lastContacted',
          header: 'Last Contacted',
          accessorKey: 'lastContacted',
          format: 'date',
          enableSorting: true,
        },
      ],
      rows,
      pageSize: 25,
    },
    {
      kind: 'prompt-suggestions',
      title: 'Bulk actions',
      suggestions: [
        {
          label: 'Send reminders to all',
          prompt: 'Send a payment reminder to every tenant in the arrears list above.',
          kind: 'primary',
        },
        {
          label: 'Call top 3',
          prompt: 'Schedule a follow-up call for the three highest-severity arrears tenants.',
          kind: 'secondary',
        },
        {
          label: 'Generate eviction notices',
          prompt:
            'Draft formal eviction notices for tenants more than 60 days late. ' +
            'I will review each one before they go out.',
          kind: 'destructive',
        },
      ],
    },
  ];
}

export const ArrearsTableView: TabView<ArrearsQuery, ArrearsData> = {
  key: 'arrears.severity.table',
  label: 'Arrears',
  entity_type: 'arrears',
  view_kind: 'table',
  defaultQuery: { limit: 25, sortBy: 'rank', sortDir: 'desc' },
  validateQuery: validateArrearsQuery,
  renderToBlocks: renderArrearsToBlocks,
  sort_order: 40,
  description:
    'Ranked arrears table sorted by severity (days-late × amount-due). Click a row to ' +
    'expand recent communication history. Includes a bulk-action toolbar so the owner ' +
    'can send reminders, schedule calls, or draft notices without leaving chat.',
};
