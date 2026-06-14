/**
 * Public status board — UNAUTHENTICATED, cacheable.
 *
 * Mounted at /api/v1/public/status. The marketing /status page
 * (apps/marketing/src/components/StatusBoard.tsx) polls
 *   GET /api/v1/public/status
 * every 30s and expects:
 *   { success, data: { overall, components[{ component, current,
 *     lastChangedAt, history, uptimePct }], generatedAt, windowDays } }
 *
 * Source of truth: `service_status_components` (migration 0333) — the
 * maintained platform status board (api-gateway / database / auth / storage /
 * workers / realtime). NOT tenant-scoped; public-read RLS, service-role
 * writes. The read runs WITHOUT a tenant GUC (databaseMiddleware skips the
 * tenant tx for unauthenticated callers) and succeeds under the table's
 * PUBLIC SELECT policy.
 *
 * Honest-degrade (no fabrication):
 *   - A component absent from the table is reported as `unknown` so the grid
 *     is always complete but never invented.
 *   - If the DB read throws, the whole board collapses to all-`unknown` with
 *     overall `unknown` and a 200 — the marketing page renders a real
 *     "status unknown" surface rather than a hard error. (The middleware's
 *     own LIVE_DATA_NOT_CONFIGURED 503 still surfaces honestly upstream when
 *     no DB is wired at all.)
 *
 * Cacheable: `Cache-Control: public, max-age=15` — coarse health is safe to
 * cache for a few seconds and the board polls every 30s anyway. This also
 * blunts unauthenticated flood pressure on the gateway.
 *
 * NO auth, NO tenant data, NO money, NO PII — only green/amber/red health.
 */

import { Hono } from 'hono';

import { serviceStatusComponents } from '@bossnyumba/database';

import { databaseMiddleware } from '../middleware/database';
import { createLogger } from '../utils/logger';

const moduleLogger = createLogger('public-status');

const WINDOW_DAYS = 90;

// The fixed component grid the marketing page renders. Order is meaningful
// (top-to-bottom on the page). MUST match the ComponentName union in
// apps/marketing/src/components/StatusBoard.tsx + the i18n componentLabel keys.
const COMPONENTS = [
  'api-gateway',
  'database',
  'auth',
  'storage',
  'workers',
  'realtime',
] as const;
type ComponentName = (typeof COMPONENTS)[number];

type SimpleStatus = 'ok' | 'degraded' | 'outage' | 'unknown';

interface HistoryDay {
  readonly date: string;
  readonly status: SimpleStatus;
}

interface ComponentSummary {
  readonly component: ComponentName;
  readonly current: SimpleStatus;
  readonly lastChangedAt: string | null;
  readonly history: ReadonlyArray<HistoryDay>;
  readonly uptimePct: number;
}

interface StatusResponse {
  readonly overall: SimpleStatus;
  readonly components: ReadonlyArray<ComponentSummary>;
  readonly generatedAt: string;
  readonly windowDays: number;
}

// Worst-of rollup. outage > degraded > ok; unknown only wins when there is
// nothing better to report (so a single known-ok component still shows ok).
function rollupOverall(
  components: ReadonlyArray<ComponentSummary>,
): SimpleStatus {
  if (components.some((c) => c.current === 'outage')) return 'outage';
  if (components.some((c) => c.current === 'degraded')) return 'degraded';
  if (components.some((c) => c.current === 'ok')) return 'ok';
  return 'unknown';
}

function coerceStatus(value: unknown): SimpleStatus {
  return value === 'ok' || value === 'degraded' || value === 'outage'
    ? value
    : 'unknown';
}

function coerceHistory(value: unknown): ReadonlyArray<HistoryDay> {
  if (!Array.isArray(value)) return [];
  const out: HistoryDay[] = [];
  for (const entry of value) {
    if (entry && typeof entry === 'object') {
      const date = (entry as Record<string, unknown>).date;
      const status = (entry as Record<string, unknown>).status;
      if (typeof date === 'string') {
        out.push({ date, status: coerceStatus(status) });
      }
    }
  }
  return out;
}

function coerceISO(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function coerceUptime(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, n));
}

/** All-unknown board — the honest-degrade fallback (never fabricated green). */
function unknownBoard(generatedAt: string): StatusResponse {
  return {
    overall: 'unknown',
    components: COMPONENTS.map((component) => ({
      component,
      current: 'unknown' as const,
      lastChangedAt: null,
      history: [],
      uptimePct: 100,
    })),
    generatedAt,
    windowDays: WINDOW_DAYS,
  };
}

export function createPublicStatusRouter(): Hono {
  const app = new Hono();
  // No auth — public surface. databaseMiddleware skips the tenant tx for
  // unauthenticated callers and binds the singleton db handle; the table's
  // PUBLIC SELECT policy lets the read succeed.
  app.use('*', databaseMiddleware);

  app.get('/', async (c: any) => {
    const generatedAt = new Date().toISOString();
    c.header('Cache-Control', 'public, max-age=15');

    const db = c.get('db');
    if (!db) {
      // No DB at all — honest unknown board (still a 200 so the page renders
      // a real "status unknown" surface instead of crashing).
      return c.json({ success: true, data: unknownBoard(generatedAt) }, 200);
    }

    try {
      const rows = await db
        .select({
          component: serviceStatusComponents.component,
          currentStatus: serviceStatusComponents.currentStatus,
          lastChangedAt: serviceStatusComponents.lastChangedAt,
          history: serviceStatusComponents.history,
          uptimePct: serviceStatusComponents.uptimePct,
        })
        .from(serviceStatusComponents);

      const byComponent = new Map<string, Record<string, unknown>>();
      for (const row of Array.isArray(rows) ? rows : []) {
        byComponent.set(String(row.component), row);
      }

      // Build the full grid in fixed order; absent components → unknown.
      const components: ReadonlyArray<ComponentSummary> = COMPONENTS.map(
        (component) => {
          const row = byComponent.get(component);
          if (!row) {
            return {
              component,
              current: 'unknown' as const,
              lastChangedAt: null,
              history: [],
              uptimePct: 100,
            };
          }
          return {
            component,
            current: coerceStatus(row.currentStatus),
            lastChangedAt: coerceISO(row.lastChangedAt),
            history: coerceHistory(row.history),
            uptimePct: coerceUptime(row.uptimePct),
          };
        },
      );

      const data: StatusResponse = {
        overall: rollupOverall(components),
        components,
        generatedAt,
        windowDays: WINDOW_DAYS,
      };
      return c.json({ success: true, data }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'status read failed';
      moduleLogger.error('public status read failed', {
        evt: 'public_status_read_failed',
        reason: message,
      });
      // Honest-degrade: surface an all-unknown board (200) rather than a 5xx,
      // so the marketing page renders the real "status unknown" surface.
      return c.json({ success: true, data: unknownBoard(generatedAt) }, 200);
    }
  });

  return app;
}

const app = createPublicStatusRouter();
export default app;
export const publicStatusRouter = app;
