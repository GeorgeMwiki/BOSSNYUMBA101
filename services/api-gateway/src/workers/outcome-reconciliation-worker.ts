/**
 * Outcome Reconciliation Worker — Wave CLOSED-LOOP (real-estate).
 *
 * Port from Borjie services/api-gateway/src/workers/outcome-reconciliation-worker.ts
 * (CORE — held to sibling-parity; re-skinned for the real-estate pack only).
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
 *   3. Inserts the outcome_observations row (idempotent).
 *   4. Computes drift_score (scalar abs(% delta) or jsonb cosine-like).
 *   5. Inserts outcome_reconciliations with status:
 *        matched      drift < 0.15
 *        divergent    drift > 0.40
 *        undetermined 0.15 <= drift <= 0.40
 *        expired      observation could not be computed
 *      (idempotent — see TRACKING below).
 *   6. Extends the AI hash-chain (`ai_audit_chain`) with the reconciliation
 *      record so a tamper of either telemetry table breaks chain verify().
 *
 * Real-estate prediction shapes the brain emits and this worker resolves:
 *   - "will this rent be paid on time?" — entityType=rent_invoice
 *   - "will this lease renew?"           — entityType=lease
 *   - "will this maintenance close by SLA?" — entityType=maintenance_ticket
 *
 * Lifecycle (detection → tracking → closing):
 *   - DETECTION: `claim()` reads predictions whose horizon elapsed and that
 *     have NO reconciliation row yet (`NOT EXISTS`), confidence > 0.
 *   - TRACKING: exactly-once per (tenant, prediction). The
 *     `outcome_{observations,reconciliations}` UNIQUE (tenant_id,
 *     prediction_id) indexes + `ON CONFLICT DO NOTHING` make a re-tick or a
 *     racing replica a no-op — no double row, no double audit-chain entry on
 *     the happy path (the chain head re-reads inside the same txn).
 *   - CLOSING: once a reconciliation row exists the `NOT EXISTS` predicate
 *     drops the prediction from the next claim forever — no zombie loop.
 *     A missing resolver / null observation closes the row as `expired`
 *     rather than dangling.
 *
 * G8 — every tenant slice wrapped in `withWorkerTenantContext(BEGIN/COMMIT)`.
 *
 * Multi-replica safety: the SCHEDULED tick passes through `clusterLock`
 * (composition wires the Postgres advisory lock) so one replica reconciles
 * per cadence; the per-prediction `ON CONFLICT` is the second line of
 * defence. `tickOnce()` always bypasses the gate (ops / tests).
 *
 * Failure containment:
 *   - No DB → no-op + warn once.
 *   - Per-row failures isolated; loop continues.
 *   - All errors logged via Pino.
 */

import { createHash, randomUUID } from 'node:crypto';
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

/** Coerce a DB cell to a finite number or null — survives string/numeric/decimal. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Coerce a DB cell to a plain jsonb record — survives object or json-text. */
function toJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
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

/**
 * Map a raw DB row to a typed prediction, returning `null` when a required
 * identity column is missing/non-string so a malformed row can never crash
 * the tick (it is simply skipped — DETECTION stays robust).
 */
function rowToPrediction(r: ExecRow): PendingPrediction | null {
  const id = r.id == null ? null : String(r.id);
  const tenantId = r.tenant_id == null ? null : String(r.tenant_id);
  const actorKind = r.actor_kind == null ? null : String(r.actor_kind);
  const actionKind = r.action_kind == null ? null : String(r.action_kind);
  const entityType =
    r.action_target_entity_type == null
      ? null
      : String(r.action_target_entity_type);
  const entityId =
    r.action_target_entity_id == null
      ? null
      : String(r.action_target_entity_id);
  if (!id || !tenantId || !actorKind || !actionKind || !entityType || !entityId) {
    return null;
  }
  return {
    id,
    tenantId,
    actorKind,
    actionKind,
    actionTargetEntityType: entityType,
    actionTargetEntityId: entityId,
    predictedOutcome: toJsonRecord(r.predicted_outcome),
    predictedValue: toNumber(r.predicted_value),
    // UNIV — defer to the prediction row's own currency; the launch-beachhead
    // default is only a last-resort fallback when the column is somehow null.
    predictedValueCurrency: String(r.predicted_value_currency ?? 'TZS'),
    predictionConfidence: toNumber(r.prediction_confidence) ?? 0,
    rationale: r.rationale == null ? '' : String(r.rationale),
  };
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
  /**
   * Re-build the resolver map onto the connection-pinned handle that
   * `withWorkerTenantContext` reserves per tenant. Supplied by the composition
   * root. Required so the resolver's RLS-scoped reads (lease / invoice /
   * maintenance) run on the SAME reserved connection the tenant `SET LOCAL`
   * bound. Absent in tests (in-memory resolvers — no real pool), where the
   * passed-through `resolvers` are used directly.
   */
  readonly rebindResolvers?: (
    db: DbLike,
  ) => ReadonlyMap<string, ObservationResolver>;
  readonly intervalMs?: number;
  readonly batchSize?: number;
  readonly enabled?: boolean;
  readonly now?: () => Date;
  /**
   * Optional cluster-wide single-flight gate (multi-replica safety). When
   * provided, the SCHEDULED tick runs only on the replica holding the
   * Postgres advisory lock — so 3 replicas don't all reconcile the same
   * predictions + write duplicate `outcome_reconciliations` rows.
   * `tickOnce()` always bypasses the gate (ops / tests).
   */
  readonly clusterLock?: (fn: () => Promise<void>) => Promise<void>;
}

export interface ReconciliationTickResult {
  readonly claimed: number;
  readonly matched: number;
  readonly divergent: number;
  readonly undetermined: number;
  readonly expired: number;
  readonly errored: number;
}

export interface ReconciliationWorker {
  start(): void;
  stop(): void;
  tickOnce(): Promise<ReconciliationTickResult>;
}

/**
 * Bound scalar drift to [0,1] via abs(% delta).
 *   - both zero        → 0 (perfect)
 *   - predicted zero,
 *     observed non-zero → 1 (no proportional baseline — total surprise)
 *   - otherwise        → min(1, abs((observed - predicted) / predicted))
 *
 * NOTE: the proportional baseline is `predicted` (not `max(|predicted|,1)`)
 * so a small predicted value that lands far off scores high drift — the
 * previous `max(...,1)` denominator UNDER-reported drift for sub-unit
 * predictions. Matches Borjie SOTA.
 */
export function scalarDrift(predicted: number, observed: number): number {
  if (predicted === 0 && observed === 0) return 0;
  if (predicted === 0) return 1;
  const ratio = Math.abs((observed - predicted) / predicted);
  return Math.min(1, ratio);
}

/**
 * Cosine-like distance over shared keys for jsonb shapes. Numeric keys use
 * `1 - scalarDrift` so a near-miss scores as partial agreement; booleans and
 * strings are exact-match. Keys present on only one side count against the
 * similarity but never raise drift above 1. 0 = identical, 1 = no overlap.
 */
export function jsonbDrift(
  predicted: Readonly<Record<string, unknown>>,
  observed: Readonly<Record<string, unknown>>,
): number {
  const keys = new Set<string>([
    ...Object.keys(predicted),
    ...Object.keys(observed),
  ]);
  if (keys.size === 0) return 0;
  let agree = 0;
  let total = 0;
  for (const key of keys) {
    total += 1;
    const a = predicted[key];
    const b = observed[key];
    if (a === undefined || b === undefined) continue;
    if (typeof a === 'number' && typeof b === 'number') {
      agree += 1 - scalarDrift(a, b);
      continue;
    }
    if (typeof a === 'boolean' && typeof b === 'boolean') {
      agree += a === b ? 1 : 0;
      continue;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      agree += a === b ? 1 : 0;
      continue;
    }
  }
  const sim = total === 0 ? 0 : agree / total;
  return Math.max(0, Math.min(1, 1 - sim));
}

function pickStatus(drift: number): 'matched' | 'divergent' | 'undetermined' {
  if (drift < MATCHED_DRIFT_BAND) return 'matched';
  if (drift > DIVERGENT_DRIFT_BAND) return 'divergent';
  return 'undetermined';
}

/**
 * Capture which prediction features tracked reality and which missed — the
 * durable learning signal the calibration / sleep passes read back.
 */
function buildLearningSignal(
  prediction: PendingPrediction,
  observed: Readonly<Record<string, unknown>>,
  drift: number,
  status: 'matched' | 'divergent' | 'undetermined',
): Record<string, unknown> {
  const wellPredictedKeys: string[] = [];
  const poorlyPredictedKeys: string[] = [];
  for (const key of Object.keys(prediction.predictedOutcome)) {
    const a = prediction.predictedOutcome[key];
    const b = observed[key];
    if (a === undefined || b === undefined) continue;
    if (typeof a === 'number' && typeof b === 'number') {
      if (scalarDrift(a, b) < MATCHED_DRIFT_BAND) wellPredictedKeys.push(key);
      else poorlyPredictedKeys.push(key);
    } else if (a === b) {
      wellPredictedKeys.push(key);
    } else {
      poorlyPredictedKeys.push(key);
    }
  }
  return {
    action_kind: prediction.actionKind,
    actor_kind: prediction.actorKind,
    entity_type: prediction.actionTargetEntityType,
    status,
    drift_score: Number(drift.toFixed(4)),
    confidence: prediction.predictionConfidence,
    well_predicted_keys: wellPredictedKeys,
    poorly_predicted_keys: poorlyPredictedKeys,
    rationale_excerpt: prediction.rationale.slice(0, 400),
  };
}

/**
 * Read up to `batchSize` predictions that have eclipsed their horizon
 * and have no reconciliation row yet (DETECTION). The `NOT EXISTS`
 * predicate is also the CLOSING guard — once a reconciliation lands, the
 * prediction never re-enters this set.
 */
async function fetchPendingPredictions(
  db: DbLike,
  batchSize: number,
  nowIso: string,
): Promise<ReadonlyArray<PendingPrediction>> {
  const result = await db.execute(sql`
    SELECT
      p.id, p.tenant_id, p.actor_kind, p.action_kind,
      p.action_target_entity_type, p.action_target_entity_id,
      p.predicted_outcome, p.predicted_value, p.predicted_value_currency,
      p.prediction_confidence, p.rationale
    FROM outcome_predictions p
    WHERE p.prediction_confidence > 0
      AND p.created_at + (p.prediction_horizon_days::text || ' days')::interval <= ${nowIso}
      AND NOT EXISTS (
        SELECT 1 FROM outcome_reconciliations r
         WHERE r.prediction_id = p.id
           AND r.tenant_id     = p.tenant_id
      )
    ORDER BY p.created_at ASC
    LIMIT ${batchSize}
  `);
  const out: PendingPrediction[] = [];
  for (const row of rowsOf(result)) {
    const p = rowToPrediction(row);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Insert the observation row. Idempotent via the UNIQUE
 * (tenant_id, prediction_id) index — a re-tick / racing replica is a
 * no-op (TRACKING). Returns the row id (best-effort; null on failure).
 */
async function recordObservation(
  db: DbLike,
  tenantId: string,
  predictionId: string,
  observation: ObservationResolverResult,
  gapPct: number | null,
  nowIso: string,
): Promise<string | null> {
  const id = randomUUID();
  try {
    await db.execute(sql`
      INSERT INTO outcome_observations (
        id, tenant_id, prediction_id, observed_outcome,
        observed_value, observed_value_currency,
        observed_at, gap_pct, calibrated, narrative
      )
      VALUES (
        ${id}, ${tenantId}, ${predictionId},
        ${JSON.stringify(observation.observedOutcome)}::jsonb,
        ${observation.observedValue},
        ${observation.observedCurrency},
        ${nowIso},
        ${gapPct},
        ${false},
        ${observation.narrative.slice(0, 4000)}
      )
      ON CONFLICT (tenant_id, prediction_id) DO NOTHING
    `);
    return id;
  } catch {
    return null;
  }
}

/**
 * Insert the reconciliation row. Idempotent via the UNIQUE
 * (tenant_id, prediction_id) index — the single source of truth that the
 * loop fires exactly once cluster-wide (TRACKING / CLOSING).
 */
async function recordReconciliation(
  db: DbLike,
  payload: {
    readonly tenantId: string;
    readonly predictionId: string;
    readonly observationId: string | null;
    readonly status: 'matched' | 'divergent' | 'undetermined' | 'expired';
    readonly driftScore: number;
    readonly learningSignal: Readonly<Record<string, unknown>>;
    readonly auditHashId: string | null;
    readonly nowIso: string;
  },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO outcome_reconciliations (
      id, tenant_id, prediction_id, observation_id, status,
      drift_score, learning_signal, audit_hash_id, reconciled_at
    )
    VALUES (
      ${randomUUID()}, ${payload.tenantId}, ${payload.predictionId},
      ${payload.observationId}, ${payload.status},
      ${payload.driftScore.toFixed(4)},
      ${JSON.stringify(payload.learningSignal)}::jsonb,
      ${payload.auditHashId},
      ${payload.nowIso}
    )
    ON CONFLICT (tenant_id, prediction_id) DO NOTHING
  `);
}

/**
 * Extend the per-tenant AI hash-chain with the reconciliation record so a
 * tamper of either telemetry table breaks `ai_audit_chain` verify().
 * Append-only, hash-chained (CLAUDE.md hard rule). Runs inside the caller's
 * already-open tenant transaction (the head re-read + insert are atomic, so
 * the chain stays gap-free under the per-tenant single-flight). Best-effort:
 * a chain fault is logged and the reconciliation still commits — the
 * telemetry row is the primary record; the chain is the tamper witness.
 */
async function appendReconciliationAudit(
  db: DbLike,
  payload: {
    readonly tenantId: string;
    readonly predictionId: string;
    readonly status: string;
    readonly driftScore: number;
    readonly learningSignal: Readonly<Record<string, unknown>>;
  },
  nowIso: string,
  logger: Logger,
): Promise<string | null> {
  const id = randomUUID();
  const canonical = JSON.stringify({
    tenantId: payload.tenantId,
    predictionId: payload.predictionId,
    status: payload.status,
    drift: payload.driftScore,
    learning: payload.learningSignal,
  });
  try {
    const headRes = await db.execute(sql`
      SELECT COALESCE(MAX(sequence_id), 0)::bigint AS max_seq,
             (SELECT this_hash FROM ai_audit_chain
               WHERE tenant_id = ${payload.tenantId}
               ORDER BY sequence_id DESC LIMIT 1) AS last_hash
        FROM ai_audit_chain
       WHERE tenant_id = ${payload.tenantId}
    `);
    const head = rowsOf(headRes)[0] ?? {};
    const maxSeq = toNumber(head.max_seq) ?? 0;
    const lastHashRaw = head.last_hash;
    const lastHash =
      typeof lastHashRaw === 'string' && lastHashRaw.length > 0
        ? lastHashRaw
        : '';
    const sequenceId = maxSeq + 1;
    const thisHash = createHash('sha256')
      .update(lastHash + canonical)
      .digest('hex');
    await db.execute(sql`
      INSERT INTO ai_audit_chain (
        id, tenant_id, sequence_id, turn_id, action,
        prev_hash, this_hash, payload, created_at
      ) VALUES (
        ${id},
        ${payload.tenantId},
        ${sequenceId},
        ${`reconcile:${payload.predictionId}`},
        ${'closed_loop.reconcile'},
        ${lastHash},
        ${thisHash},
        ${JSON.stringify({
          predictionId: payload.predictionId,
          status: payload.status,
          driftScore: payload.driftScore,
          learningSignal: payload.learningSignal,
        })}::jsonb,
        ${nowIso}
      )
    `);
    return id;
  } catch (err) {
    logger.warn(
      {
        worker: 'outcome-reconciliation',
        predictionId: payload.predictionId,
        err: err instanceof Error ? err.message : String(err),
      },
      'outcome-reconciliation: audit append failed (reconciliation still recorded)',
    );
    return null;
  }
}

async function reconcileOne(
  prediction: PendingPrediction,
  resolvers: ReadonlyMap<string, ObservationResolver>,
  db: DbLike,
  nowIso: string,
  logger: Logger,
): Promise<'matched' | 'divergent' | 'undetermined' | 'expired' | 'errored'> {
  const resolver = resolvers.get(prediction.actionTargetEntityType);
  if (!resolver) {
    // CLOSING: no resolver wired ⇒ close as expired so the row never loops.
    const learning = {
      action_kind: prediction.actionKind,
      actor_kind: prediction.actorKind,
      entity_type: prediction.actionTargetEntityType,
      status: 'expired',
      reason: 'no_resolver',
    };
    const auditHashId = await appendReconciliationAudit(
      db,
      {
        tenantId: prediction.tenantId,
        predictionId: prediction.id,
        status: 'expired',
        driftScore: 0,
        learningSignal: learning,
      },
      nowIso,
      logger,
    );
    await recordReconciliation(db, {
      tenantId: prediction.tenantId,
      predictionId: prediction.id,
      observationId: null,
      status: 'expired',
      driftScore: 0,
      learningSignal: learning,
      auditHashId,
      nowIso,
    });
    return 'expired';
  }

  let observation: ObservationResolverResult | null = null;
  try {
    observation = await resolver({
      tenantId: prediction.tenantId,
      entityType: prediction.actionTargetEntityType,
      entityId: prediction.actionTargetEntityId,
      predictedOutcome: prediction.predictedOutcome,
    });
  } catch (err) {
    logger.warn(
      {
        worker: 'outcome-reconciliation',
        predictionId: prediction.id,
        err: err instanceof Error ? err.message : String(err),
      },
      'outcome-reconciliation: resolver threw',
    );
    observation = null;
  }

  if (observation === null) {
    // CLOSING: observation unavailable ⇒ close as expired (no dangling row).
    const learning = {
      action_kind: prediction.actionKind,
      actor_kind: prediction.actorKind,
      entity_type: prediction.actionTargetEntityType,
      status: 'expired',
      reason: 'observation_null',
    };
    const auditHashId = await appendReconciliationAudit(
      db,
      {
        tenantId: prediction.tenantId,
        predictionId: prediction.id,
        status: 'expired',
        driftScore: 0,
        learningSignal: learning,
      },
      nowIso,
      logger,
    );
    await recordReconciliation(db, {
      tenantId: prediction.tenantId,
      predictionId: prediction.id,
      observationId: null,
      status: 'expired',
      driftScore: 0,
      learningSignal: learning,
      auditHashId,
      nowIso,
    });
    return 'expired';
  }

  // Scalar drift takes precedence when a monetary forecast was made;
  // otherwise the jsonb envelope drives the score.
  let drift: number;
  let gapPct: number | null = null;
  if (prediction.predictedValue !== null && observation.observedValue !== null) {
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
    nowIso,
  );
  const learning = buildLearningSignal(
    prediction,
    observation.observedOutcome,
    drift,
    status,
  );
  const auditHashId = await appendReconciliationAudit(
    db,
    {
      tenantId: prediction.tenantId,
      predictionId: prediction.id,
      status,
      driftScore: drift,
      learningSignal: learning,
    },
    nowIso,
    logger,
  );
  await recordReconciliation(db, {
    tenantId: prediction.tenantId,
    predictionId: prediction.id,
    observationId,
    status,
    driftScore: drift,
    learningSignal: learning,
    auditHashId,
    nowIso,
  });

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
  return status;
}

export function createReconciliationWorker(
  options: ReconciliationWorkerOptions,
): ReconciliationWorker {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const now = options.now ?? (() => new Date());
  const enabled = options.enabled !== false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const EMPTY_RESULT: ReconciliationTickResult = {
    claimed: 0,
    matched: 0,
    divergent: 0,
    undetermined: 0,
    expired: 0,
    errored: 0,
  };

  async function tickOnce(): Promise<ReconciliationTickResult> {
    const nowIso = now().toISOString();
    let pending: ReadonlyArray<PendingPrediction>;
    try {
      pending = await fetchPendingPredictions(options.db, batchSize, nowIso);
    } catch (err) {
      options.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'outcome-reconciliation: fetch failed',
      );
      return EMPTY_RESULT;
    }

    let matched = 0;
    let divergent = 0;
    let undetermined = 0;
    let expired = 0;
    let errored = 0;

    // Group by tenant so the G8 BEGIN/COMMIT wraps the whole tenant slice.
    const byTenant = new Map<string, PendingPrediction[]>();
    for (const p of pending) {
      const list = byTenant.get(p.tenantId);
      if (list) list.push(p);
      else byTenant.set(p.tenantId, [p]);
    }

    for (const [tenantId, predictions] of byTenant) {
      try {
        await withWorkerTenantContext(options.db, tenantId, async (pinned) => {
          // Re-bind the resolvers onto the pinned (reserved) connection so
          // their RLS-scoped reads run under the tenant GUC the SET LOCAL set.
          // Falls back to the passed-through resolvers (in-memory test fakes).
          const resolvers = options.rebindResolvers?.(pinned) ?? options.resolvers;
          for (const prediction of predictions) {
            try {
              const verdict = await reconcileOne(
                prediction,
                resolvers,
                // Pinned (reserved) connection — the reconcile read/write must
                // run on the connection the per-tenant SET LOCAL bound, not the
                // pooled `options.db`.
                pinned,
                nowIso,
                options.logger,
              );
              if (verdict === 'matched') matched += 1;
              else if (verdict === 'divergent') divergent += 1;
              else if (verdict === 'undetermined') undetermined += 1;
              else if (verdict === 'expired') expired += 1;
              else errored += 1;
            } catch (err) {
              errored += 1;
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
        });
      } catch (err) {
        // A tenant-slice txn failure (e.g. BEGIN/COMMIT) marks the whole
        // slice errored but never stalls the other tenants.
        errored += predictions.length;
        options.logger.error(
          {
            tenantId,
            err: err instanceof Error ? err.message : String(err),
          },
          'outcome-reconciliation: tenant slice failed',
        );
      }
    }

    const result: ReconciliationTickResult = {
      claimed: pending.length,
      matched,
      divergent,
      undetermined,
      expired,
      errored,
    };
    if (pending.length > 0) {
      options.logger.info(
        { worker: 'outcome-reconciliation', ...result },
        'outcome-reconciliation: tick done',
      );
    }
    return result;
  }

  // Scheduled ticks pass through the cluster-lock gate (when wired) so only
  // one replica reconciles per cadence. `tickOnce()` stays ungated.
  async function scheduledTick(): Promise<void> {
    if (options.clusterLock) {
      await options.clusterLock(async () => {
        await tickOnce();
      });
      return;
    }
    await tickOnce();
  }

  return {
    start() {
      if (!enabled) {
        options.logger.info(
          { worker: 'outcome-reconciliation' },
          'outcome-reconciliation: disabled by config',
        );
        return;
      }
      if (timer) return;
      timer = setInterval(() => {
        void scheduledTick().catch((err) => {
          options.logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            'outcome-reconciliation: tick threw',
          );
        });
      }, intervalMs);
      if (typeof (timer as { unref?: () => void }).unref === 'function') {
        (timer as { unref: () => void }).unref();
      }
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
