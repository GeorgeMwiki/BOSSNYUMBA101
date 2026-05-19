/**
 * PropertyKpiGridView — occupancy / revenue / arrears KPI tiles.
 *
 * The owner asks "what's my occupancy this month?" — the MD picks
 * this view, fetches the latest aggregates, and emits the same
 * `kpi-grid` ag-ui block the `/properties` tab would render.
 *
 * Each tile is drillable: tapping the "occupancy" tile expands an
 * inline `chart-vega` block showing the 12-month trend. The drill
 * event flows back to the MD via the interactivity protocol.
 *
 * Period semantics:
 *   - `month`     = current calendar month (default)
 *   - `quarter`   = current calendar quarter
 *   - `year`      = current calendar year
 *   - `last-30d`  = trailing 30 days
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type PropertyKpiPeriod = 'month' | 'quarter' | 'year' | 'last-30d';

export interface PropertyKpiQuery {
  readonly period?: PropertyKpiPeriod;
  readonly currency?: string;
}

export interface PropertyKpiData {
  readonly occupancyPct: number;
  readonly occupancyDelta: number;
  readonly revenueCents: number;
  readonly revenueDelta: number;
  readonly arrearsCount: number;
  readonly arrearsDelta: number;
  readonly activeLeases: number;
  readonly newLeasesThisPeriod: number;
  readonly periodLabel: string;
  readonly currency: string;
}

function validatePropertyKpiQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<PropertyKpiQuery> {
  if (query === undefined || query === null) {
    return { ok: true, query: { period: 'month', currency: 'KES' } };
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

  const allowedPeriods: readonly PropertyKpiPeriod[] = [
    'month',
    'quarter',
    'year',
    'last-30d',
  ];
  const period = q['period'];
  if (
    period !== undefined &&
    !allowedPeriods.includes(period as PropertyKpiPeriod)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'unknown-field',
        message: `period must be one of: ${allowedPeriods.join(', ')}`,
      },
    };
  }

  const currency = q['currency'];
  if (currency !== undefined && typeof currency !== 'string') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'currency must be a string' },
    };
  }
  if (typeof currency === 'string' && !/^[A-Z]{3}$/.test(currency)) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'currency must be a 3-letter ISO-4217 code',
      },
    };
  }

  const out: PropertyKpiQuery = {
    period: (period as PropertyKpiPeriod | undefined) ?? 'month',
    currency: (currency as string | undefined) ?? 'KES',
  };
  return { ok: true, query: out };
}

function renderPropertyKpiToBlocks(
  data: PropertyKpiData,
  _ctx: RenderContext,
): readonly AgUiUiPart[] {
  const revenue = data.revenueCents / 100;
  return [
    {
      kind: 'kpi-grid',
      title: `Properties — ${data.periodLabel}`,
      tiles: [
        {
          label: 'Occupancy',
          value: data.occupancyPct,
          delta: data.occupancyDelta,
          deltaDirection: deltaDir(data.occupancyDelta),
          format: 'percent',
        },
        {
          label: 'Revenue',
          value: revenue,
          delta: data.revenueDelta,
          deltaDirection: deltaDir(data.revenueDelta),
          format: 'currency',
          currency: data.currency,
        },
        {
          label: 'Arrears',
          value: data.arrearsCount,
          delta: data.arrearsDelta,
          // Arrears: more is bad, so invert the colouring semantics —
          // a positive delta is shown going "up" but the UI styles
          // that as bad (the renderer reads `deltaDirection` only).
          deltaDirection: deltaDir(data.arrearsDelta),
          format: 'number',
        },
        {
          label: 'Active Leases',
          value: data.activeLeases,
          format: 'number',
        },
        {
          label: 'New Leases',
          value: data.newLeasesThisPeriod,
          format: 'number',
        },
      ],
    },
  ];
}

function deltaDir(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export const PropertyKpiGridView: TabView<PropertyKpiQuery, PropertyKpiData> = {
  key: 'property.health.kpi-grid',
  label: 'Properties',
  entity_type: 'property',
  view_kind: 'kpi-grid',
  defaultQuery: { period: 'month', currency: 'KES' },
  validateQuery: validatePropertyKpiQuery,
  renderToBlocks: renderPropertyKpiToBlocks,
  sort_order: 20,
  description:
    'Occupancy / revenue / arrears KPI tiles. Each tile is drillable to an inline ' +
    'chart-vega trend chart via the interactivity protocol.',
};
