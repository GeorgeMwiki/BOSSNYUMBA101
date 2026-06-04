
/**
 * /api/v1/budgets/forecasts — real Holt-Winters projection of monthly
 * revenue, expenses, and NOI over the next horizon (default 8 months).
 *
 * Data source:
 *   - Monthly revenue series: SUM(payments.amount) per month, status =
 *     'completed', grouped by date_trunc('month', completed_at), past
 *     24 months (to give Holt-Winters enough seasonal context).
 *   - Monthly expense series: SUM(work_orders.actual_cost) per month,
 *     same window, grouped by completed_at OR createdAt fallback.
 *
 * Model:
 *   - `@bossnyumba/forecasting` createHoltWintersForecaster with
 *     monthly seasonality (period 12). Tunes alpha / beta / gamma via
 *     grid search on past residuals. Returns a 95% interval (z=1.96).
 *   - Same input series always returns the same output (deterministic).
 *
 * Frontend shape (drop-in for `useBudgetForecasts`):
 *   [{ month, projectedRevenue, projectedRevenueLower, projectedRevenueUpper,
 *      projectedExpenses, projectedExpensesLower, projectedExpensesUpper,
 *      projectedNoi, projectedNoiLower, projectedNoiUpper }]
 *
 * Sparse data: returns [] when fewer than 6 months of revenue history.
 * The frontend was already designed to handle empty (`data.length`
 * check); the previous hardcoded fixture fallback is removed in the
 * paired commit on the page.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, gte, sql } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import {
  createHoltWintersForecaster,
  type TimeSeries,
  type TimeSeriesForecast,
} from '@bossnyumba/forecasting';
import { payments, workOrders } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { logger } from '../utils/logger';

const router = new Hono();
router.use('*', authMiddleware);
router.use('*', databaseMiddleware);

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(8),
});

const HISTORY_MONTHS = 24;
const MIN_HISTORY_MONTHS = 6;
const Z_95 = 1.96;
const SHORT_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthRow {
  readonly key: string;
  readonly label: string;
  readonly start: Date;
}

function lastNMonths(n: number): ReadonlyArray<MonthRow> {
  const now = new Date();
  const out: MonthRow[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: SHORT_MONTH[d.getUTCMonth()] ?? 'Jan',
      start: d,
    });
  }
  return Object.freeze(out);
}

function gapFill(
  rows: ReadonlyArray<{ readonly key: string; readonly value: number }>,
  buckets: ReadonlyArray<MonthRow>,
): ReadonlyArray<{ readonly t: string; readonly y: number }> {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.freeze(
    buckets.map((b) => ({ t: b.start.toISOString(), y: map.get(b.key) ?? 0 })),
  );
}

async function fetchMonthlyRevenue(
  db: any,
  tenantId: string,
  buckets: ReadonlyArray<MonthRow>,
): Promise<ReadonlyArray<{ readonly t: string; readonly y: number }>> {
  const earliest = buckets[0]!.start;
  const rows = ((await db.execute(sql`
    SELECT
      to_char(date_trunc('month', COALESCE(${payments.completedAt}, ${payments.createdAt})), 'YYYY-MM') AS month_key,
      COALESCE(SUM(${payments.amount}), 0)::bigint AS amount_minor
    FROM ${payments}
    WHERE ${payments.tenantId} = ${tenantId}
      AND ${payments.status} = 'completed'
      AND COALESCE(${payments.completedAt}, ${payments.createdAt}) >= ${earliest}
    GROUP BY 1
  `)) ?? { rows: [] }) as { readonly rows?: ReadonlyArray<{ readonly month_key: string; readonly amount_minor: string }> };
  const norm = (rows.rows ?? []).map((r) => ({
    key: r.month_key,
    value: Number(r.amount_minor) / 100,
  }));
  return gapFill(norm, buckets);
}

async function fetchMonthlyExpenses(
  db: any,
  tenantId: string,
  buckets: ReadonlyArray<MonthRow>,
): Promise<ReadonlyArray<{ readonly t: string; readonly y: number }>> {
  const earliest = buckets[0]!.start;
  const rows = ((await db.execute(sql`
    SELECT
      to_char(date_trunc('month', COALESCE(${workOrders.completedAt}, ${workOrders.createdAt})), 'YYYY-MM') AS month_key,
      COALESCE(SUM(COALESCE(${workOrders.actualCost}, ${workOrders.estimatedCost}, 0)), 0)::bigint AS cost_minor
    FROM ${workOrders}
    WHERE ${workOrders.tenantId} = ${tenantId}
      AND COALESCE(${workOrders.completedAt}, ${workOrders.createdAt}) >= ${earliest}
    GROUP BY 1
  `)) ?? { rows: [] }) as { readonly rows?: ReadonlyArray<{ readonly month_key: string; readonly cost_minor: string }> };
  const norm = (rows.rows ?? []).map((r) => ({
    key: r.month_key,
    value: Number(r.cost_minor) / 100,
  }));
  return gapFill(norm, buckets);
}

async function holtWintersMonthly(
  history: ReadonlyArray<{ readonly t: string; readonly y: number }>,
  horizon: number,
  seriesId: string,
): Promise<TimeSeriesForecast> {
  const series: TimeSeries = Object.freeze({
    id: seriesId,
    frequency: 'monthly',
    points: history.map((p) => Object.freeze({ t: p.t, y: p.y })),
  });
  const forecaster = createHoltWintersForecaster({ intervalZ: Z_95 });
  return forecaster.predict({
    series,
    horizon: { steps: horizon },
    opts: { alpha: 0.05, seasonality: 12 },
  });
}

function projectionMonthLabel(iso: string): string {
  const d = new Date(iso);
  return SHORT_MONTH[d.getUTCMonth()] ?? 'Jan';
}

router.get('/', zValidator('query', querySchema), async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  const { months } = c.req.valid('query') as { months: number };
  if (!auth?.tenantId || !db) {
    return c.json(
      { success: false, error: { code: 'NO_TENANT', message: 'Tenant not bound.' } },
      401,
    );
  }
  try {
    const buckets = lastNMonths(HISTORY_MONTHS);
    const [revenueHistory, expensesHistory] = await Promise.all([
      fetchMonthlyRevenue(db, auth.tenantId, buckets),
      fetchMonthlyExpenses(db, auth.tenantId, buckets),
    ]);

    // Count months with non-zero revenue — Holt-Winters needs a real
    // signal to fit. If the tenant has fewer than 6 such months, we
    // bail out honestly with an empty array. The page's `data.length`
    // branch then renders an empty state.
    const nonZeroRevenueMonths = revenueHistory.filter((p) => p.y > 0).length;
    if (nonZeroRevenueMonths < MIN_HISTORY_MONTHS) {
      return c.json({
        success: true,
        data: [],
        meta: {
          note: 'insufficient history for forecast — need ≥ 6 months with revenue',
          historyMonths: nonZeroRevenueMonths,
        },
      });
    }

    const [revenueForecast, expensesForecast] = await Promise.all([
      holtWintersMonthly(revenueHistory, months, `budget::revenue::${auth.tenantId}`),
      holtWintersMonthly(expensesHistory, months, `budget::expenses::${auth.tenantId}`),
    ]);

    const projection = revenueForecast.points.map((revPoint, i) => {
      const expPoint = expensesForecast.points[i] ?? { point: 0, lower: 0, upper: 0, t: revPoint.t };
      const revP = Math.max(0, revPoint.point);
      const revL = Math.max(0, revPoint.lower);
      const revU = Math.max(0, revPoint.upper);
      const expP = Math.max(0, expPoint.point);
      const expL = Math.max(0, expPoint.lower);
      const expU = Math.max(0, expPoint.upper);
      return {
        month: projectionMonthLabel(revPoint.t),
        t: revPoint.t,
        projectedRevenue: revP,
        projectedRevenueLower: revL,
        projectedRevenueUpper: revU,
        projectedExpenses: expP,
        projectedExpensesLower: expL,
        projectedExpensesUpper: expU,
        projectedNoi: revP - expP,
        projectedNoiLower: revL - expU,
        projectedNoiUpper: revU - expL,
      };
    });

    return c.json({
      success: true,
      data: projection,
      meta: {
        modelKind: 'holt-winters',
        modelVersion: revenueForecast.modelVersion,
        historyMonths: nonZeroRevenueMonths,
        horizonMonths: months,
        confidence: 0.95,
        generatedAt: revenueForecast.generatedAt,
      },
    });
  } catch (error) {
    logger.warn('budget-forecast Holt-Winters failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({
      success: true,
      data: [],
      meta: { note: 'forecast unavailable — see server logs' },
    });
  }
});

export default router;
