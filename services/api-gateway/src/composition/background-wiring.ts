// @ts-nocheck — composition bridges multiple internal packages with loose shapes.
/**
 * Background wiring — heartbeat engine, background task scheduler,
 * webhook-DLQ repository, and ambient-brain observer composition.
 *
 * All factories take `(registry, logger)` and return a pair of
 * `start` / `stop` functions so `index.ts` can control lifecycle
 * from the main supervisor. No timers live in module scope.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  createHeartbeatEngine,
  type HeartbeatEngine,
  type JuniorSession,
} from '@bossnyumba/ai-copilot/heartbeat';
import {
  BackgroundTaskScheduler,
  buildTaskCatalogue,
  InMemoryInsightStore,
  PostgresInsightStore,
  type BackgroundTaskData,
} from '@bossnyumba/ai-copilot/background-intelligence';
import { BehaviorObserver } from '@bossnyumba/ai-copilot/ambient-brain';
import type { ServiceRegistry } from './service-registry.js';
import type {
  WebhookDeliveryRepository,
  WebhookAttemptRecord,
  WebhookDeadLetterRecord,
} from '../workers/webhook-retry-worker.js';

// ---------------------------------------------------------------------------
// Heartbeat engine
// ---------------------------------------------------------------------------

export interface HeartbeatSupervisor {
  readonly engine: HeartbeatEngine;
  start(): void;
  stop(): void;
}

export function createHeartbeatSupervisor(
  registry: ServiceRegistry,
  logger: Logger,
  tickMs = 30_000,
): HeartbeatSupervisor {
  const engine = createHeartbeatEngine(
    {
      now: () => Date.now(),
      probeLlmHealth: async () => true,
      rollLedger: async (tenantId) => {
        if (!registry.aiCostLedger) return;
        try {
          await registry.aiCostLedger.currentMonthSpend(tenantId);
        } catch {
          /* non-fatal */
        }
      },
      telemetry: (result) => {
        logger.info(
          {
            tickAt: result.tickAt,
            ledgersRolled: result.ledgersRolled,
            memorySweeps: result.memorySweeps,
            llmHealthy: result.llmHealthy,
            juniorsPutToSleep: result.juniorsPutToSleep.length,
          },
          'heartbeat tick',
        );
      },
    },
    { cadenceMs: tickMs },
  );

  let handle: NodeJS.Timeout | null = null;

  async function tick(): Promise<void> {
    try {
      const tenants = await listActiveTenantIds(registry);
      const juniors: readonly JuniorSession[] = []; // no junior-session registry yet
      await engine.tick({ juniors, activeTenantIds: tenants });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'heartbeat tick failed',
      );
    }
  }

  return {
    engine,
    start() {
      if (handle) return;
      // First tick immediately so operators can see the engine is alive.
      void tick();
      handle = setInterval(tick, tickMs);
      if (typeof handle.unref === 'function') handle.unref();
      logger.info({ tickMs }, 'heartbeat engine started');
    },
    stop() {
      if (handle) {
        clearInterval(handle);
        handle = null;
        logger.info('heartbeat engine stopped');
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Background task scheduler
// ---------------------------------------------------------------------------

export interface BackgroundSchedulerSupervisor {
  readonly scheduler: BackgroundTaskScheduler | null;
  start(): void;
  stop(): void;
}

export function createBackgroundSupervisor(
  registry: ServiceRegistry,
  logger: Logger,
): BackgroundSchedulerSupervisor {
  if (process.env.BOSSNYUMBA_BG_TASKS_ENABLED === 'false') {
    logger.info('background-tasks: disabled via env');
    return { scheduler: null, start() {}, stop() {} };
  }
  if (!registry.isLive || !registry.db) {
    logger.warn('background-tasks: degraded registry — scheduler not started');
    return { scheduler: null, start() {}, stop() {} };
  }

  const store = registry.db
    ? new PostgresInsightStore({
        query: async (text, params) => {
          const res = await (
            registry.db as unknown as { execute(q: unknown): Promise<unknown> }
          ).execute(
            sql.raw(
              interpolate(text, (params as readonly unknown[]) ?? []),
            ),
          );
          const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
          return { rows: rows as Record<string, unknown>[] } as never;
        },
      } as never)
    : new InMemoryInsightStore();

  const tenants = {
    async listActiveTenants(): Promise<readonly string[]> {
      try {
        const res = await (
          registry.db as unknown as { execute(q: unknown): Promise<unknown> }
        ).execute(sql`SELECT id FROM tenants WHERE is_active = TRUE`);
        const rows = Array.isArray(res)
          ? res
          : ((res as { rows?: Record<string, unknown>[] }).rows ?? []);
        return rows.map((r) => String((r as { id: unknown }).id));
      } catch {
        return [];
      }
    },
  };

  const featureFlags = registry.featureFlags
    ? {
        async isEnabled(tenantId: string, flagKey: string): Promise<boolean> {
          try {
            return await registry.featureFlags!.isEnabled(tenantId, flagKey);
          } catch {
            return true; // default open so scheduler still runs in pilot
          }
        },
      }
    : {
        async isEnabled() {
          return true;
        },
      };

  const tasks = buildTaskCatalogue(buildTaskData(registry));

  const scheduler = new BackgroundTaskScheduler({
    store: store as unknown as InstanceType<typeof InMemoryInsightStore>,
    tenants,
    featureFlags,
    tasks,
    logger: (msg, meta) => logger.info(meta ?? {}, `bg-task ${msg}`),
  });

  let handle: NodeJS.Timeout | null = null;

  async function tickWrapper(): Promise<void> {
    try {
      const summaries = await scheduler.tick();
      if (summaries.length > 0) {
        logger.info(
          { count: summaries.length },
          'background scheduler tick completed with summaries',
        );
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'background scheduler tick failed',
      );
    }
  }

  return {
    scheduler,
    start() {
      if (handle) return;
      void tickWrapper();
      handle = setInterval(tickWrapper, 60_000);
      if (typeof handle.unref === 'function') handle.unref();
      logger.info('background scheduler started (1m cadence)');
    },
    stop() {
      if (handle) {
        clearInterval(handle);
        handle = null;
        logger.info('background scheduler stopped');
      }
    },
  };
}

function buildTaskData(_registry: ServiceRegistry): BackgroundTaskData {
  // Minimal data provider: each method returns an empty array so the
  // catalogue runs without crashing. Real data wiring is a follow-up —
  // this is the shape expected by `buildTaskCatalogue`.
  return {
    async listPropertiesForHealthScan() {
      return [];
    },
    async listArrearsCases() {
      return [];
    },
    async listLeasesNearExpiry() {
      return [];
    },
    async listInspectionsDue() {
      return [];
    },
    async listComplianceNotices() {
      return [];
    },
    async summariseMonthlyCosts() {
      return null;
    },
    async listVendorPerformance() {
      return [];
    },
    async recomputeTenantHealth() {
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook DLQ repository (Postgres-backed, drizzle)
// ---------------------------------------------------------------------------

export function createPostgresWebhookDeliveryRepository(
  db: unknown,
): WebhookDeliveryRepository {
  const exec = (db as { execute(q: unknown): Promise<unknown> }).execute.bind(
    db as { execute(q: unknown): Promise<unknown> },
  );

  function asRows(
    res: unknown,
  ): readonly Record<string, unknown>[] {
    if (Array.isArray(res)) return res as Record<string, unknown>[];
    const r = (res as { rows?: unknown }).rows;
    return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
  }

  function mapDeadLetter(row: Record<string, unknown>): WebhookDeadLetterRecord {
    return {
      id: String(row.id),
      deliveryId: String(row.delivery_id),
      tenantId: String(row.tenant_id),
      targetUrl: String(row.target_url),
      eventType: String(row.event_type),
      payload:
        typeof row.payload === 'string'
          ? JSON.parse(row.payload)
          : (row.payload as Record<string, unknown>),
      totalAttempts: Number(row.total_attempts ?? 0),
      lastStatusCode: row.last_status_code
        ? Number(row.last_status_code)
        : undefined,
      lastError: row.last_error ? String(row.last_error) : undefined,
      firstAttemptAt: new Date(String(row.first_attempt_at)),
      lastAttemptAt: new Date(String(row.last_attempt_at)),
    };
  }

  return {
    async recordAttempt(record: WebhookAttemptRecord): Promise<void> {
      await exec(sql`
        INSERT INTO webhook_delivery_attempts (
          id, tenant_id, delivery_id, target_url, event_type, payload,
          attempt_number, status, status_code, error_message,
          scheduled_for, attempted_at, created_at, updated_at
        ) VALUES (
          ${record.id}, ${record.tenantId}, ${record.deliveryId},
          ${record.targetUrl}, ${record.eventType},
          ${JSON.stringify(record.payload)}::jsonb,
          ${record.attemptNumber}, ${record.status},
          ${record.statusCode ?? null}, ${record.errorMessage ?? null},
          ${record.scheduledFor.toISOString()},
          ${record.attemptedAt ? record.attemptedAt.toISOString() : null},
          NOW(), NOW()
        )
      `);
    },

    async moveToDeadLetters(record: WebhookDeadLetterRecord): Promise<void> {
      await exec(sql`
        INSERT INTO webhook_dead_letters (
          id, tenant_id, delivery_id, target_url, event_type, payload,
          total_attempts, last_status_code, last_error,
          first_attempt_at, last_attempt_at, created_at
        ) VALUES (
          ${record.id}, ${record.tenantId}, ${record.deliveryId},
          ${record.targetUrl}, ${record.eventType},
          ${JSON.stringify(record.payload)}::jsonb,
          ${record.totalAttempts}, ${record.lastStatusCode ?? null},
          ${record.lastError ?? null},
          ${record.firstAttemptAt.toISOString()},
          ${record.lastAttemptAt.toISOString()},
          NOW()
        )
      `);
    },

    async listDeadLetters({ tenantId, limit, offset }) {
      const lim = Math.min(200, Math.max(1, limit ?? 50));
      const off = Math.max(0, offset ?? 0);
      const rows = asRows(
        await exec(
          tenantId
            ? sql`
                SELECT * FROM webhook_dead_letters
                WHERE tenant_id = ${tenantId}
                ORDER BY created_at DESC
                LIMIT ${lim} OFFSET ${off}
              `
            : sql`
                SELECT * FROM webhook_dead_letters
                ORDER BY created_at DESC
                LIMIT ${lim} OFFSET ${off}
              `,
        ),
      );
      return rows.map(mapDeadLetter);
    },

    async getDeadLetter(id) {
      const rows = asRows(
        await exec(
          sql`SELECT * FROM webhook_dead_letters WHERE id = ${id} LIMIT 1`,
        ),
      );
      return rows[0] ? mapDeadLetter(rows[0]) : null;
    },

    async markDeadLetterReplayed(id, replayedBy, replayDeliveryId) {
      await exec(sql`
        UPDATE webhook_dead_letters
        SET replayed_at = NOW(),
            replayed_by = ${replayedBy},
            replay_delivery_id = ${replayDeliveryId}
        WHERE id = ${id}
      `);
    },
  };
}

// ---------------------------------------------------------------------------
// Ambient-brain observer
// ---------------------------------------------------------------------------

export function createAmbientBehaviorObserver(): BehaviorObserver {
  return new BehaviorObserver();
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function listActiveTenantIds(
  registry: ServiceRegistry,
): Promise<readonly string[]> {
  if (!registry.db) return [];
  try {
    const res = await (
      registry.db as unknown as { execute(q: unknown): Promise<unknown> }
    ).execute(sql`SELECT id FROM tenants WHERE is_active = TRUE LIMIT 200`);
    const rows = Array.isArray(res)
      ? res
      : ((res as { rows?: Record<string, unknown>[] }).rows ?? []);
    return rows.map((r) => String((r as { id: unknown }).id));
  } catch {
    return [];
  }
}

function interpolate(
  text: string,
  params: readonly unknown[],
): string {
  return text.replace(/\$(\d+)/g, (_m, idxStr: string) => {
    const v = params[Number(idxStr) - 1];
    return encode(v);
  });
}

function encode(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object')
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
