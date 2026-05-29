/**
 * Outcome Reconciliation Worker — Wave CLOSED-LOOP (real-estate).
 *
 * Port from Borjie services/api-gateway/src/workers/outcome-reconciliation-worker.ts
 *
 * Ticks every 6 hours. For each row in `outcome_predictions` where:
 *   - `created_at + prediction_horizon_days <= now()` (horizon elapsed)
 *   - no companion row in `outcome_reconciliations` yet
 *   - `prediction_confidence > 0` (skip explicit "unmodeled" rows)
 *
 * the worker:
 *   1. Resolves the target entity's CURRENT state via a per-entity
 *      resolver (closed-loop: same data plane the brain reads from).
 *   2. Shapes the observed_outcome jsonb to mirror the prediction.
 *   3. Inserts the outcome_observations row.
 *   4. Computes drift_score (scalar abs(% delta) or jsonb cosine-like).
 *   5. Inserts outcome_reconciliations with status:
 *        matched      drift < 0.15
 *        divergent    drift > 0.40
 *        undetermined 0.15 <= drift <= 0.40
 *        expired      observation could not be computed
 *
 * Real-estate prediction shapes the brain emits and this worker resolves:
 *   - "will this rent be paid on time?" — entityType=rent_invoice
 *   - "will this lease renew?"           — entityType=lease
 *   - "will this maintenance close by SLA?" — entityType=maintenance_ticket
 *
 * G8 — every tenant slice wrapped in `withWorkerTenantContext(BEGIN/COMMIT)`.
 *
 * Failure containment:
 *   - No DB → no-op + warn once.
 *   - Per-row failures isolated; loop continues.
 *   - All errors logged via Pino.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import { withWorkerTenantContext } from './with-tenant-context.js';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_BATCH = 50;
const MATCHED_DRIFT_BAND = 0.15;
const DIVERGENT_DRIFT_BAND = 0.40;

export interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

interface ExecRow {
  readonly [key: string]: unknown;
}

function rowsOf(result: unknown): ReadonlyArray<ExecRow> {
  if (Array.isArray(result)) return result as ReadonlyArray<ExecRow>;
  const wrapped = result as { rows?: ReadonlyArray<ExecRow> };
  return wrapped?.rows ?? [];
}

export interface PendingPrediction {
  readonly id: string;
  readonly tenantId: string;
  readonly actorKind: string;
  readonly actionKind: string;
  readonly actionTargetEntityType: string;
  readonly actionTargetEntityId: string;
  readonly predictedOutcome: Record<string, unknown>;
  readonly predictedValue: number | null;
  readonly predictedValueCurrency: string;
  readonly predictionConfidence: number;
  readonly rationale: string;
}

export interface ObservationResolverInput {
  readonly tenantId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly predictedOutcome: Readonly<Record<string, unknown>>;
}

export interface ObservationResolverResult {
  readonly observedOutcome: Readonly<Record<string, unknown>>;
  readonly observedValue: number | null;
  readonly observedCurrency: string;
  readonly narrative: string;
}

/**
 * Resolver port. The production composition root binds one resolver per
 * `entityType` (lease / rent_invoice / maintenance_ticket / application
 * / property_listing / ...); tests can pass an in-memory map. Returning
 * `null` lands the reconciliation in `expired` status.
 */
export type ObservationResolver = (
  input: ObservationResolverInput,
) => Promise<ObservationResolverResult | null>;

export interface ReconciliationWorkerOptions {
  readonly db: DbLike;
  readonly logger: Logger;
  readonly resolvers: ReadonlyMap<string, ObservationResolver>;
  readonly intervalMs?: number;
  readonly batchSize?: number;
  readonly now?: () => Date;
}

export interface ReconciliationWorker {
  start(): void;
  stop(): void;
  tickOnce(): Promise<void>;
}

/** Bound scalar drift to [0,1] via abs(% delta). */
function scalarDrift(predicted: number, observed: number): number {
  if (predicted === 0 && observed === 0) return 0;
  const denom = Math.max(Math.abs(predicted), 1);
  return Math.min(1, Math.abs((observed - predicted) / denom));
}

/** Cosine-like distance over shared keys for jsonb shapes. */
function jsonbDrift(
  predicted: Readonly<Record<string, unknown>>,
  observed: Readonly<Record<string, unknown>>,
): number {
  const keys = new Set([...Object.keys(predicted), ...Object.keys(observed)]);
  if (keys.size === 0) return 0;
  let matches = 0;
  for (const k of keys) {
    if (predicted[k] === observed[k]) matches += 1;
  }
  return 1 - matches / keys.size;
}

function pickStatus(drift: number): 'matched' | 'divergent' | 'undetermined' {
  if (drift < MATCHED_DRIFT_BAND) return 'matched';
  if (drift > DIVERGENT_DRIFT_BAND) return 'divergent';
  return 'undetermined';
}

/**
 * Read up to `batchSize` predictions that have eclipsed their horizon
 * and have no reconciliation row yet.
 */
async function fetchPendingPredictions(
  db: DbLike,
  batchSize: number,
): Promise<ReadonlyArray<PendingPrediction>> {
  const result = await db.execute(sql`
    SELECT
      p.id, p.tenant_id, p.actor_kind, p.action_kind,
      p.action_target_entity_type, p.action_target_entity_id,
      p.predicted_outcome, p.predicted_value, p.predicted_value_currency,
      p.prediction_confidence, p.rationale
    FROM outcome_predictions p
    LEFT JOIN outcome_reconciliations r ON r.prediction_id = p.id
    WHERE r.id IS NULL
      AND p.prediction_confidence > 0
      AND p.created_at + (p.prediction_horizon_days::text || ' days')::interval <= now()
    LIMIT ${batchSize}
  `);
  const rows = rowsOf(result);
  return rows.map((r) => ({
    id: String(r.id),
    tenantId: String(r.tenant_id),
    actorKind: String(r.actor_kind),
    actionKind: String(r.action_kind),
    actionTargetEntityType: String(r.action_target_entity_type),
    actionTargetEntityId: String(r.action_target_entity_id),
    predictedOutcome: (r.predicted_outcome ?? {}) as Record<string, unknown>,
    predictedValue: r.predicted_value == null ? null : Number(r.predicted_value),
    predictedValueCurrency: String(r.predicted_value_currency ?? 'TZS'),
    predictionConfidence: Number(r.prediction_confidence ?? 0),
    rationale: String(r.rationale ?? ''),
  }));
}

async function recordObservation(
  db: DbLike,
  tenantId: string,
  predictionId: string,
  observation: ObservationResolverResult,
  gapPct: number | null,
): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO outcome_observations (
      tenant_id, prediction_id, observed_outcome,
      observed_value, observed_value_currency,
      gap_pct, narrative
    )
    VALUES (
      ${tenantId}, ${predictionId},
      ${JSON.stringify(observation.observedOutcome)}::jsonb,
      ${observation.observedValue},
      ${observation.observedCurrency},
      ${gapPct},
      ${observation.narrative}
    )
    RETURNING id
  `);
  const rows = rowsOf(result);
  return String(rows[0]?.id ?? '');
}

async function recordReconciliation(
  db: DbLike,
  tenantId: string,
  predictionId: string,
  observationId: string | null,
  status: 'matched' | 'divergent' | 'undetermined' | 'expired',
  driftScore: number,
  learningSignal: Record<string, unknown>,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO outcome_reconciliations (
      tenant_id, prediction_id, observation_id, status,
      drift_score, learning_signal
    )
    VALUES (
      ${tenantId}, ${predictionId}, ${observationId},
      ${status}, ${driftScore},
      ${JSON.stringify(learningSignal)}::jsonb
    )
  `);
}

async function reconcileOne(
  prediction: PendingPrediction,
  resolvers: ReadonlyMap<string, ObservationResolver>,
  db: DbLike,
  logger: Logger,
): Promise<void> {
  const resolver = resolvers.get(prediction.actionTargetEntityType);
  if (!resolver) {
    await recordReconciliation(
      db,
      prediction.tenantId,
      prediction.id,
      null,
      'expired',
      1,
      {
        reason: 'no_resolver',
        entityType: prediction.actionTargetEntityType,
      },
    );
    return;
  }

  const observation = await resolver({
    tenantId: prediction.tenantId,
    entityType: prediction.actionTargetEntityType,
    entityId: prediction.actionTargetEntityId,
    predictedOutcome: prediction.predictedOutcome,
  });

  if (observation === null) {
    await recordReconciliation(
      db,
      prediction.tenantId,
      prediction.id,
      null,
      'expired',
      1,
      { reason: 'observation_null' },
    );
    return;
  }

  let drift: number;
  let gapPct: number | null = null;
  if (
    prediction.predictedValue !== null &&
    observation.observedValue !== null
  ) {
    drift = scalarDrift(prediction.predictedValue, observation.observedValue);
    gapPct = drift;
  } else {
    drift = jsonbDrift(prediction.predictedOutcome, observation.observedOutcome);
  }

  const status = pickStatus(drift);
  const observationId = await recordObservation(
    db,
    prediction.tenantId,
    prediction.id,
    observation,
    gapPct,
  );
  await recordReconciliation(
    db,
    prediction.tenantId,
    prediction.id,
    observationId,
    status,
    drift,
    {
      drift_score: drift,
      actor_kind: prediction.actorKind,
      action_kind: prediction.actionKind,
      rationale_summary: prediction.rationale.slice(0, 200),
    },
  );

  logger.info(
    {
      predictionId: prediction.id,
      tenantId: prediction.tenantId,
      entityType: prediction.actionTargetEntityType,
      status,
      drift,
    },
    'outcome-reconciliation: reconciled',
  );
}

export function createReconciliationWorker(
  options: ReconciliationWorkerOptions,
): ReconciliationWorker {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tickOnce(): Promise<void> {
    let pending: ReadonlyArray<PendingPrediction>;
    try {
      pending = await fetchPendingPredictions(options.db, batchSize);
    } catch (err) {
      options.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'outcome-reconciliation: fetch failed',
      );
      return;
    }

    // Group by tenant so G8 BEGIN/COMMIT wraps the whole tenant slice.
    const byTenant = new Map<string, PendingPrediction[]>();
    for (const p of pending) {
      const list = byTenant.get(p.tenantId);
      if (list) list.push(p);
      else byTenant.set(p.tenantId, [p]);
    }

    for (const [tenantId, predictions] of byTenant) {
      await withWorkerTenantContext(
        options.db,
        tenantId,
        async () => {
          for (const prediction of predictions) {
            try {
              await reconcileOne(
                prediction,
                options.resolvers,
                options.db,
                options.logger,
              );
            } catch (err) {
              options.logger.error(
                {
                  predictionId: prediction.id,
                  tenantId: prediction.tenantId,
                  err: err instanceof Error ? err.message : String(err),
                },
                'outcome-reconciliation: reconcile failed',
              );
            }
          }
        },
      );
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void tickOnce().catch((err) => {
          options.logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            'outcome-reconciliation: tick threw',
          );
        });
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    tickOnce,
  };
}
