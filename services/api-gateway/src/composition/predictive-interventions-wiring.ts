/**
 * Predictive-interventions wiring — composes the AI-native
 * `PredictiveInterventions` agent (from
 * `@bossnyumba/ai-copilot/ai-native/predictive-interventions`) on top
 * of the Drizzle-backed `tenant_predictions` /
 * `predictive_intervention_opportunities` storage adapter shipped in
 * `@bossnyumba/database` (commit e33cebc, migration 0106).
 *
 * The DB service exposes `insertPrediction`, `insertOpportunity`,
 * `listRecentPredictions`, and `listOpenOpportunities`. The agent's
 * port additionally requires `listActiveTenants(tenantId)` which joins
 * leases / occupancy / sentiment data — that join is a follow-on and
 * not yet wired in. For pilot deployments we return `[]` from
 * `listActiveTenants`, which makes `runNightly` a graceful no-op while
 * `predictOne` and `listRecent` remain fully functional.
 *
 * Optional ports (`llm`, `publisher`, `budgetGuard`) are passed through
 * undefined so the agent operates in degraded heuristic-baseline mode
 * with reduced confidence — pilot-acceptable until the LLM provider
 * and event bus are wired through environment configuration.
 *
 * Returns `null` when `deps.db` is absent (in-memory / test mode); the
 * caller is responsible for skipping the predictive-interventions
 * routes in that case.
 *
 * Tenant isolation is preserved end-to-end: the DB adapter scopes
 * every query by `tenantId` and `customerId`, and the agent threads
 * those ids through every emission.
 */

import { createDatabaseClient } from '@bossnyumba/database';
import { createTenantPredictionsService } from '@bossnyumba/database';
import {
  createPredictiveInterventions,
  type InterventionOpportunity,
  type InterventionSignalType,
  type PredictiveInterventionRepository,
  type TenantFeatureSnapshot,
  type TenantPrediction,
} from '@bossnyumba/ai-copilot/ai-native';

/**
 * DatabaseClient derived via `ReturnType<typeof createDatabaseClient>`
 * to sidestep the package-barrel `TS2709 Cannot use namespace ... as
 * a type` drift (see service-registry.ts).
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export interface PredictiveInterventionsWiringDeps {
  readonly db: DatabaseClient | null;
  readonly logger?: { warn(meta: object, msg: string): void };
}

export interface PredictiveInterventionsWiring {
  readonly agent: ReturnType<typeof createPredictiveInterventions>;
}

/**
 * Adapt the DB service into the agent's
 * `PredictiveInterventionRepository` port. `listActiveTenants` is the
 * one method the DB service does NOT expose — it requires a join with
 * occupancy / leases / sentiment-monitor signals — so we return an
 * empty list. `runNightly(tenantId)` then no-ops, while `predictOne`
 * and `listRecent` continue to work end-to-end.
 */
function createRepoAdapter(
  db: DatabaseClient,
  logger?: PredictiveInterventionsWiringDeps['logger'],
): PredictiveInterventionRepository {
  const svc = createTenantPredictionsService(db);

  return {
    async listActiveTenants(_tenantId: string): Promise<readonly TenantFeatureSnapshot[]> {
      // Pilot-acceptable empty contract — see module-level docstring.
      // Once the occupancy/lease repos expose an active-tenant feature
      // snapshot stream, swap this for the real join.
      if (logger) {
        logger.warn(
          { tenantId: _tenantId },
          'predictive-interventions.listActiveTenants returning [] (occupancy join not yet wired)',
        );
      }
      return [];
    },

    async insertPrediction(prediction: TenantPrediction): Promise<TenantPrediction> {
      // The agent's TenantPrediction and the DB service's
      // TenantPredictionShape are structurally identical (verified
      // field-by-field). Pass through unchanged; the DB adapter
      // returns the same record on success.
      const stored = await svc.insertPrediction(prediction);
      return {
        ...prediction,
        ...stored,
      };
    },

    async insertOpportunity(op: InterventionOpportunity): Promise<InterventionOpportunity> {
      // The DB service's `signalType` is `string`; the agent's is the
      // `InterventionSignalType` union. Narrow at the read boundary.
      const stored = await svc.insertOpportunity(op);
      return {
        ...op,
        ...stored,
        signalType: op.signalType,
      };
    },

    async listRecentPredictions(
      tenantId: string,
      customerId: string,
    ): Promise<readonly TenantPrediction[]> {
      const rows = await svc.listRecentPredictions(tenantId, customerId);
      // Shape is identical; cast horizonDays through to satisfy the
      // agent's union (DB service already clamps to 30|60|90).
      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        customerId: r.customerId,
        horizonDays: r.horizonDays,
        probPayOnTime: r.probPayOnTime,
        probPayLate: r.probPayLate,
        probDefault: r.probDefault,
        probChurn: r.probChurn,
        probDispute: r.probDispute,
        modelVersion: r.modelVersion,
        confidence: r.confidence,
        explanation: r.explanation,
        featureSnapshot: r.featureSnapshot,
        promptHash: r.promptHash,
        computedAt: r.computedAt,
      }));
    },
  };
}

/**
 * Coerce a free-form string from the DB layer into the agent's
 * `InterventionSignalType` union. Unknown values fall back to
 * `'high_default_risk'` rather than throwing — defensive for older
 * rows written before the union was finalised.
 */
export function narrowSignalType(value: string): InterventionSignalType {
  if (
    value === 'high_default_risk' ||
    value === 'high_churn_risk' ||
    value === 'high_dispute_risk' ||
    value === 'sentiment_collapse'
  ) {
    return value;
  }
  return 'high_default_risk';
}

/**
 * Build the predictive-interventions wiring. Returns `null` when no
 * DB client is available (the caller is responsible for skipping the
 * routes that depend on this agent).
 */
export function createPredictiveInterventionsWiring(
  deps: PredictiveInterventionsWiringDeps,
): PredictiveInterventionsWiring | null {
  if (!deps.db) {
    if (deps.logger) {
      deps.logger.warn(
        {},
        'predictive-interventions wiring skipped — no DB client available',
      );
    }
    return null;
  }

  const repo = createRepoAdapter(deps.db, deps.logger);
  const agent = createPredictiveInterventions({
    repo,
    // llm, publisher, budgetGuard intentionally omitted — agent runs
    // in degraded heuristic-baseline mode with reduced confidence.
  });

  return { agent };
}

export { createRepoAdapter as __createRepoAdapterForTests };
