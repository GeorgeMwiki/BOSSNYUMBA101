/**
 * Executive Brief Cron — Piece C.
 *
 * Scans `briefing_subscriptions WHERE next_due_at <= NOW() AND enabled = true`
 * every interval and calls the brief engine for each due subscription.
 *
 * Lifecycle:
 *   - `start()` arms an interval (default 5 min — tunable via env).
 *   - `tickOnce()` is exposed for tests and ops.
 *   - `stop()` clears the timer.
 *
 * Each tick:
 *   1. SELECT due subs (joined with personas for tier filtering).
 *   2. For each:
 *      a. Load persona row (filter T4/T5).
 *      b. Compute period_start / period_end from cadence.
 *      c. Call `executiveBriefService.generate(...)`.
 *      d. Persist resulting brief (insert into executive_briefs).
 *      e. Bump last_generated_at + next_due_at on the subscription.
 *      f. Increment cost-ledger (via the service's own port).
 *
 * Failure containment:
 *   - DB connectivity gone → no-op + warn.
 *   - Brief engine unwired → no-op + warn.
 *   - Per-subscription failures isolated; loop continues.
 *   - Kill-switch fail-closed honoured inside generateBrief.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  initExecutiveBriefService,
  type ExecutiveBriefService,
} from '../composition/executive-brief.composition';
import type { ExecutiveBrief } from '@bossnyumba/executive-brief-engine';
import { computeNextDueAt } from '../routes/executive-brief.hono';
import {
  withWorkerServiceRoleContext,
  withWorkerTenantContext,
} from './with-tenant-context.js';

// ─────────────────────────────────────────────────────────────────────
// Types + handle
// ─────────────────────────────────────────────────────────────────────

const ONE_MIN_MS = 60 * 1000;
const DEFAULT_INTERVAL_MS = 5 * ONE_MIN_MS;

export interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface ExecutiveBriefCronOptions {
  readonly db: DbLike;
  readonly logger: Logger;
  readonly intervalMs?: number;
  readonly enabled?: boolean;
  readonly now?: () => Date;
  /**
   * Optional cluster-wide single-flight gate (multi-replica safety). When
   * provided, the SCHEDULED tick body runs only on the replica that holds
   * the Postgres advisory lock — preventing 3 replicas from generating +
   * charging for the same brief 3×. When omitted (tests, single-process),
   * the tick runs directly. `tickOnce()` always bypasses the gate so ops /
   * tests can force a run.
   */
  readonly clusterLock?: (fn: () => Promise<void>) => Promise<void>;
}

export interface ExecutiveBriefCronHandle {
  start(): void;
  stop(): void;
  tickOnce(): Promise<TickResult>;
}

export interface TickResult {
  readonly scanned: number;
  readonly generated: number;
  readonly degraded: number;
  readonly refused: number;
  readonly failed: number;
}

interface DueSubscription {
  readonly id: string;
  readonly tenantId: string;
  readonly personaId: string;
  readonly cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';
  readonly localTime: string;
  readonly modulesInScope: ReadonlyArray<string>;
  readonly locale: string;
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export function createExecutiveBriefCron(
  options: ExecutiveBriefCronOptions,
): ExecutiveBriefCronHandle {
  const envIntervalMs = Number(process.env.EXECUTIVE_BRIEF_CRON_INTERVAL_MS);
  const intervalMs = Math.max(
    ONE_MIN_MS,
    options.intervalMs ??
      (Number.isFinite(envIntervalMs) && envIntervalMs > 0 ? envIntervalMs : DEFAULT_INTERVAL_MS),
  );
  const enabled =
    options.enabled ??
    (process.env.NODE_ENV !== 'test' &&
      process.env.EXECUTIVE_BRIEF_CRON_DISABLED !== 'true');
  const nowFn = options.now ?? (() => new Date());

  // Lazy-init service so cron + on-demand share the singleton.
  const service: ExecutiveBriefService | null = initExecutiveBriefService({ db: options.db });

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  // Scheduled ticks pass through the cluster-lock gate (when wired) so only
  // one replica runs the cost-bearing brief generation per cadence.
  // `tickOnce()` stays ungated for ops/tests.
  async function scheduledTick(): Promise<void> {
    if (options.clusterLock) {
      await options.clusterLock(async () => {
        await tick();
      });
      return;
    }
    await tick();
  }

  async function tick(): Promise<TickResult> {
    const result: TickResult = {
      scanned: 0,
      generated: 0,
      degraded: 0,
      refused: 0,
      failed: 0,
    };
    if (running) return result;
    running = true;
    const started = Date.now();
    try {
      if (!service) {
        options.logger.warn(
          'executive-brief-cron: service uninitialised — skipping tick',
        );
        return result;
      }
      // Cross-tenant scan (next_due_at across ALL tenants) — bind
      // service-role so the FORCE-RLS `briefing_subscriptions` rows are
      // visible under the non-BYPASS prod role (mig 0336 adds the bypass
      // policy). Without it the scan returns ZERO due subs and no brief is
      // ever generated for anyone.
      const due = await withWorkerServiceRoleContext(options.db, (pinned) =>
        fetchDueSubscriptions(pinned, nowFn()),
      );
      const mutable = result as { scanned: number };
      mutable.scanned = due.length;

      for (const sub of due) {
        try {
          const periodEnd = nowFn();
          const periodStart = computePeriodStart(sub.cadence, periodEnd);
          // Per-tenant: bind tenant context so the FORCE-RLS `personas`
          // read resolves (else it returns null and every due sub is
          // skipped). The cost-bearing `service.generate` below is left
          // OUTSIDE any transaction — it does LLM work and must not hold a
          // DB connection/txn across a network call.
          const persona = await withWorkerTenantContext(
            options.db,
            sub.tenantId,
            (pinned) => loadPersona(pinned, sub.tenantId, sub.personaId),
          );
          if (!persona) {
            (result as { failed: number }).failed += 1;
            continue;
          }
          if (persona.powerTier > 3) {
            (result as { refused: number }).refused += 1;
            continue;
          }
          const outcome = await service.generate({
            tenantId: sub.tenantId,
            persona,
            modulesInScope: [...sub.modulesInScope],
            periodStart,
            periodEnd,
            locale: sub.locale,
          });
          if (outcome.status === 'refused') {
            (result as { refused: number }).refused += 1;
            continue;
          }
          await withWorkerTenantContext(options.db, sub.tenantId, (pinned) =>
            persistBrief(pinned, outcome.brief),
          );
          if (outcome.status === 'degraded') {
            (result as { degraded: number }).degraded += 1;
          } else {
            (result as { generated: number }).generated += 1;
          }
          await withWorkerTenantContext(options.db, sub.tenantId, (pinned) =>
            bumpSubscription(pinned, sub, nowFn()),
          );
        } catch (err) {
          options.logger.error(
            { subId: sub.id, tenantId: sub.tenantId, err: err instanceof Error ? err.message : String(err) },
            'executive-brief-cron: subscription tick failed',
          );
          (result as { failed: number }).failed += 1;
        }
      }
      options.logger.info(
        { durationMs: Date.now() - started, ...result },
        'executive-brief-cron: tick complete',
      );
    } finally {
      running = false;
    }
    return result;
  }

  return {
    start() {
      if (!enabled) {
        options.logger.info('executive-brief-cron: disabled by env');
        return;
      }
      if (timer) {
        options.logger.warn('executive-brief-cron: already running');
        return;
      }
      options.logger.info({ intervalMs }, 'executive-brief-cron started');
      timer = setInterval(() => {
        void scheduledTick();
      }, intervalMs);
      if (typeof timer.unref === 'function') timer.unref();
      void scheduledTick();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        options.logger.info('executive-brief-cron stopped');
      }
    },
    async tickOnce() {
      return tick();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// SQL helpers
// ─────────────────────────────────────────────────────────────────────

async function fetchDueSubscriptions(db: DbLike, now: Date): Promise<ReadonlyArray<DueSubscription>> {
  const res = await db.execute(sql`
    SELECT id, tenant_id, persona_id, cadence, local_time, modules_in_scope, locale
      FROM briefing_subscriptions
     WHERE enabled = TRUE
       AND next_due_at <= ${now.toISOString()}
       AND cadence <> 'ON_DEMAND'
     ORDER BY next_due_at ASC
     LIMIT 500
  `);
  const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    tenantId: String(r.tenant_id),
    personaId: String(r.persona_id),
    cadence: String(r.cadence) as DueSubscription['cadence'],
    localTime: String(r.local_time),
    modulesInScope: (r.modules_in_scope as string[]) || [],
    locale: String(r.locale || 'en'),
  }));
}

async function loadPersona(db: DbLike, tenantId: string, personaId: string) {
  const res = await db.execute(sql`
    SELECT id, tenant_id, slug, display_name_en, display_name_sw, power_tier,
           scope_predicate_jsonb, tool_catalog_ids, channel_allowlist,
           max_action_tier, memory_namespace_template, ui_section_filter_jsonb,
           is_built_in
      FROM personas
     WHERE id = ${personaId}
       AND tenant_id = ${tenantId}
     LIMIT 1
  `);
  const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    slug: String(r.slug),
    displayNameEn: String(r.display_name_en),
    displayNameSw: r.display_name_sw ? String(r.display_name_sw) : undefined,
    powerTier: Number(r.power_tier) as 1 | 2 | 3 | 4 | 5,
    scopePredicate: (r.scope_predicate_jsonb as { kind: string }) || { kind: 'tenant_scope' },
    toolCatalogIds: (r.tool_catalog_ids as string[]) || [],
    channelAllowlist: (r.channel_allowlist as Array<'web' | 'mobile' | 'whatsapp' | 'sms' | 'voice'>) || ['web'],
    maxActionTier: (String(r.max_action_tier) as 'LOW' | 'MEDIUM' | 'HIGH' | 'SOVEREIGN'),
    memoryNamespaceTemplate: String(r.memory_namespace_template),
    uiSectionFilter: (r.ui_section_filter_jsonb as string[]) || [],
    isBuiltIn: Boolean(r.is_built_in),
  };
}

async function persistBrief(db: DbLike, brief: ExecutiveBrief): Promise<void> {
  await db.execute(sql`
    INSERT INTO executive_briefs (
      id, tenant_id, persona_id, scope_jsonb, gaps_jsonb, opportunities_jsonb,
      risks_jsonb, recommended_actions_jsonb, approval_packets_jsonb, citations_jsonb,
      locale, generated_at, period_start, period_end, generator_version,
      cost_micros, hash, prev_hash, audit_chain_link, status
    ) VALUES (
      ${brief.id}, ${brief.tenantId}, ${brief.personaId}, ${JSON.stringify(brief.scope)}::jsonb,
      ${JSON.stringify(brief.gaps)}::jsonb, ${JSON.stringify(brief.opportunities)}::jsonb,
      ${JSON.stringify(brief.risks)}::jsonb, ${JSON.stringify(brief.recommendedActions)}::jsonb,
      ${JSON.stringify(brief.approvalPackets)}::jsonb, ${JSON.stringify(brief.citations)}::jsonb,
      ${brief.locale}, ${brief.generatedAt.toISOString()},
      ${brief.periodStart.toISOString()}, ${brief.periodEnd.toISOString()},
      ${brief.generatorVersion}, ${brief.costMicros ?? null}, ${brief.hash},
      ${brief.prevHash}, ${brief.auditChainLink}, ${brief.status}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

async function bumpSubscription(db: DbLike, sub: DueSubscription, now: Date): Promise<void> {
  const next = computeNextDueAt(sub.cadence, sub.localTime, now);
  await db.execute(sql`
    UPDATE briefing_subscriptions
       SET last_generated_at = ${now.toISOString()},
           next_due_at = ${next.toISOString()},
           updated_at = NOW()
     WHERE id = ${sub.id}
  `);
}

function computePeriodStart(cadence: DueSubscription['cadence'], end: Date): Date {
  const start = new Date(end);
  switch (cadence) {
    case 'WEEKLY':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'MONTHLY':
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case 'ON_DEMAND':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'DAILY':
    default:
      start.setUTCDate(start.getUTCDate() - 1);
      break;
  }
  return start;
}
