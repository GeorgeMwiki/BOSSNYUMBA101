/**
 * LeaseTimelineView — chronological event timeline for a lease.
 *
 * The owner asks "show me the full history for lease L-204" or
 * "what happened to my leases last quarter?". The MD picks this
 * view, fetches the qualifying events (rent payments, renewals,
 * breaks, notices, maintenance), and emits the `timeline` ag-ui
 * block.
 *
 * Severity colouring:
 *   - `info`     standard events (rent paid, notice given)
 *   - `success`  positive lifecycle events (renewal, move-in)
 *   - `warn`     payment late / partial / disputed
 *   - `error`    eviction / breach / lease termination
 *
 * Empty-set rendering: a `markdown-card` saying the lease has no
 * recorded events (rather than an empty timeline) — the genui
 * timeline schema requires at least one event.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type LeaseEventCategory =
  | 'rent-paid'
  | 'rent-late'
  | 'rent-partial'
  | 'rent-missed'
  | 'lease-signed'
  | 'lease-renewed'
  | 'lease-ended'
  | 'lease-broken'
  | 'notice-given'
  | 'maintenance'
  | 'inspection';

export interface LeaseQuery {
  readonly leaseId?: string;
  readonly propertyId?: string;
  readonly tenantPersonId?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly categories?: readonly LeaseEventCategory[];
  readonly limit?: number;
}

export interface LeaseEvent {
  readonly id: string;
  readonly leaseId: string;
  readonly timestamp: string;
  readonly category: LeaseEventCategory;
  readonly title: string;
  readonly description?: string;
}

export interface LeaseData {
  readonly events: readonly LeaseEvent[];
  readonly contextLabel?: string;
}

const MAX_LIMIT = 500;
const ALLOWED_CATEGORIES: readonly LeaseEventCategory[] = [
  'rent-paid',
  'rent-late',
  'rent-partial',
  'rent-missed',
  'lease-signed',
  'lease-renewed',
  'lease-ended',
  'lease-broken',
  'notice-given',
  'maintenance',
  'inspection',
];

function validateLeaseQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<LeaseQuery> {
  if (query === undefined || query === null) {
    return { ok: true, query: { limit: 100 } };
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

  const categories = q['categories'];
  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      return {
        ok: false,
        reason: {
          kind: 'invalid-shape',
          message: 'categories must be an array',
        },
      };
    }
    for (const c of categories) {
      if (!ALLOWED_CATEGORIES.includes(c as LeaseEventCategory)) {
        return {
          ok: false,
          reason: {
            kind: 'unknown-field',
            message: `unknown category: ${String(c)}`,
          },
        };
      }
    }
  }

  for (const k of ['leaseId', 'propertyId', 'tenantPersonId', 'fromDate', 'toDate']) {
    const v = q[k];
    if (v !== undefined && typeof v !== 'string') {
      return {
        ok: false,
        reason: { kind: 'invalid-shape', message: `${k} must be a string` },
      };
    }
  }

  const out: LeaseQuery = {
    limit: (limit as number | undefined) ?? 100,
    ...(typeof q['leaseId'] === 'string' ? { leaseId: q['leaseId'] } : {}),
    ...(typeof q['propertyId'] === 'string' ? { propertyId: q['propertyId'] } : {}),
    ...(typeof q['tenantPersonId'] === 'string'
      ? { tenantPersonId: q['tenantPersonId'] }
      : {}),
    ...(typeof q['fromDate'] === 'string' ? { fromDate: q['fromDate'] } : {}),
    ...(typeof q['toDate'] === 'string' ? { toDate: q['toDate'] } : {}),
    ...(Array.isArray(categories)
      ? { categories: categories as readonly LeaseEventCategory[] }
      : {}),
  };
  return { ok: true, query: out };
}

function severityFor(c: LeaseEventCategory): 'info' | 'warn' | 'error' | 'success' {
  switch (c) {
    case 'rent-paid':
    case 'lease-signed':
    case 'lease-renewed':
      return 'success';
    case 'rent-late':
    case 'rent-partial':
    case 'notice-given':
      return 'warn';
    case 'rent-missed':
    case 'lease-broken':
      return 'error';
    case 'lease-ended':
    case 'maintenance':
    case 'inspection':
    default:
      return 'info';
  }
}

function renderLeaseToBlocks(
  data: LeaseData,
  _ctx: RenderContext,
): readonly AgUiUiPart[] {
  if (data.events.length === 0) {
    return [
      {
        kind: 'markdown-card',
        title: data.contextLabel ?? 'Lease Timeline',
        markdown: 'No lease events recorded for this scope.',
        severity: 'info',
      },
    ];
  }

  // Newest-first.
  const sorted = [...data.events].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  return [
    {
      kind: 'timeline',
      title: data.contextLabel ?? 'Lease Timeline',
      events: sorted.map((e) => ({
        timestamp: e.timestamp,
        title: e.title,
        ...(e.description !== undefined ? { description: e.description } : {}),
        severity: severityFor(e.category),
      })),
    },
  ];
}

export const LeaseTimelineView: TabView<LeaseQuery, LeaseData> = {
  key: 'lease.history.timeline',
  label: 'Lease History',
  entity_type: 'lease',
  view_kind: 'timeline',
  defaultQuery: { limit: 100 },
  validateQuery: validateLeaseQuery,
  renderToBlocks: renderLeaseToBlocks,
  sort_order: 30,
  description:
    'Chronological timeline of lease lifecycle events — renewals, breaks, rent ' +
    'payments, notices, inspections. Newest-first.',
};
