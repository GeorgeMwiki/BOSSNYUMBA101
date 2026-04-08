// @ts-nocheck

/**
 * Analytics / KPI HTTP routes
 *
 * Exposes KPI metrics to the owner-portal via a consistent REST surface.
 * Backed by SQLKPIDataProvider (drizzle + Postgres).
 *
 * Routes (mounted under /api/v1/analytics):
 *   GET /summary                   - Portfolio summary KPIs (occupancy, revenue, expenses, NOI)
 *   GET /occupancy                 - Occupancy rate trend + current split
 *   GET /revenue                   - Revenue breakdown (trend + by source)
 *   GET /expenses                  - Expense breakdown (trend + by category)
 *   GET /collection                - Rent collection rate
 *   GET /arrears                   - Arrears aging buckets
 *   GET /maintenance               - Maintenance ticket metrics
 *
 * Also exposes a generic dispatcher:
 *   GET /kpis/:metric              - Fetch any single metric by name
 *
 * Query params (all routes, all optional):
 *   - propertyId    - scope to a single property (repeatable)
 *   - startDate     - ISO date string, defaults to first day of 6 months ago
 *   - endDate       - ISO date string, defaults to today
 *   - months        - convenience for (now - N months ... now) if start/end absent
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  SQLKPIDataProvider,
  lastNMonthsPeriod,
  type KPIPeriod,
} from '../services/sql-kpi-data-provider';

function parsePeriod(query: Record<string, string | string[] | undefined>): KPIPeriod {
  const startDate = typeof query.startDate === 'string' ? query.startDate : undefined;
  const endDate = typeof query.endDate === 'string' ? query.endDate : undefined;
  const months = typeof query.months === 'string' ? parseInt(query.months, 10) : NaN;

  if (startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate),
      label: `${startDate}..${endDate}`,
    };
  }
  if (!Number.isNaN(months) && months > 0) {
    return lastNMonthsPeriod(months);
  }
  return lastNMonthsPeriod(6);
}

function parsePropertyIds(
  query: Record<string, string | string[] | undefined>
): string[] | undefined {
  const raw = query.propertyId;
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw;
  return [raw];
}

let providerPromise: Promise<SQLKPIDataProvider> | null = null;
async function getProvider(c): Promise<SQLKPIDataProvider> {
  const db = c.get('db');
  if (!db) {
    throw new Error('database client not available');
  }
  if (!providerPromise) {
    providerPromise = SQLKPIDataProvider.fromDatabase(db);
  }
  return providerPromise;
}

function scopedPropertyIds(auth, requested?: string[]): string[] | undefined {
  // If user has wildcard access, pass through the caller's requested filter.
  if (auth.propertyAccess?.includes('*')) {
    return requested;
  }
  // Otherwise enforce least privilege by intersecting.
  const allowed = auth.propertyAccess ?? [];
  if (!requested) return allowed.length > 0 ? allowed : undefined;
  return requested.filter((id) => allowed.includes(id));
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/summary', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const data = await provider.getPortfolioSummary(auth.tenantId, period, propertyIds);
  return c.json({ success: true, data });
});

app.get('/occupancy', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const result = await provider.getOccupancyRate(auth.tenantId, period, propertyIds);
  // Owner-portal OccupancyPage expects an array of { month, rate } directly.
  return c.json({ success: true, data: result.trend, meta: result });
});

app.get('/revenue', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const result = await provider.getRevenueBreakdown(auth.tenantId, period, propertyIds);
  return c.json({ success: true, data: result.trend, meta: result });
});

app.get('/expenses', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const result = await provider.getExpenseBreakdown(auth.tenantId, period, propertyIds);
  return c.json({ success: true, data: result.trend, meta: result });
});

app.get('/collection', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const data = await provider.getRentCollectionRate(auth.tenantId, period, propertyIds);
  return c.json({ success: true, data });
});

app.get('/arrears', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const data = await provider.getArrearsAging(auth.tenantId, propertyIds);
  return c.json({ success: true, data });
});

app.get('/maintenance', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));
  const data = await provider.getMaintenanceTicketsMetrics(auth.tenantId, period, propertyIds);
  return c.json({ success: true, data });
});

// Generic dispatcher: /api/v1/analytics/kpis/:metric
app.get('/kpis/:metric', async (c) => {
  const auth = c.get('auth');
  const provider = await getProvider(c);
  const metric = c.req.param('metric');
  const period = parsePeriod(c.req.query());
  const propertyIds = scopedPropertyIds(auth, parsePropertyIds(c.req.query()));

  try {
    switch (metric) {
      case 'summary':
      case 'portfolio':
        return c.json({ success: true, data: await provider.getPortfolioSummary(auth.tenantId, period, propertyIds) });
      case 'occupancy':
        return c.json({ success: true, data: await provider.getOccupancyRate(auth.tenantId, period, propertyIds) });
      case 'collection':
        return c.json({ success: true, data: await provider.getRentCollectionRate(auth.tenantId, period, propertyIds) });
      case 'arrears':
        return c.json({ success: true, data: await provider.getArrearsAging(auth.tenantId, propertyIds) });
      case 'maintenance':
        return c.json({ success: true, data: await provider.getMaintenanceTicketsMetrics(auth.tenantId, period, propertyIds) });
      case 'revenue':
        return c.json({ success: true, data: await provider.getRevenueBreakdown(auth.tenantId, period, propertyIds) });
      case 'expenses':
        return c.json({ success: true, data: await provider.getExpenseBreakdown(auth.tenantId, period, propertyIds) });
      default:
        return c.json(
          {
            success: false,
            error: {
              code: 'UNKNOWN_KPI_METRIC',
              message: `Unknown KPI metric "${metric}". Supported: summary, occupancy, collection, arrears, maintenance, revenue, expenses.`,
            },
          },
          400
        );
    }
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'KPI_COMPUTE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to compute KPI',
        },
      },
      500
    );
  }
});

export const analyticsRouter = app;
