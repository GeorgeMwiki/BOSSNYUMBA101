/**
 * Monthly-close wiring — composes the `MonthlyCloseOrchestrator` with the
 * Drizzle-backed `monthly_close_runs` storage adapter (migration 0099,
 * shipped in commit e33cebc) so the orchestrator is constructable in
 * production today.
 *
 * Wave 28 Phase A Agent PhA2 → Phase B follow-on. Persistence is the
 * load-bearing piece for the human-in-the-loop story (resume + audit
 * trail), so we wire the real `RunStorePort` even before the rest of
 * the side-effect ports have concrete adapters. The remaining ports —
 * reconciliation, statements, disbursement, notifications, events,
 * autonomy policy — are intentionally implemented as graceful no-op
 * stubs that:
 *
 *   - return zero-valued / empty results so step bodies execute end-to-
 *     end without throwing (the orchestrator marks each step `executed`
 *     in `monthly_close_run_steps` so operators can SEE the run worked
 *     against real Postgres),
 *   - emit a single `console.warn` the first time each stub is invoked
 *     so degraded mode is observable in logs, and
 *   - default the autonomy policy to `autonomousModeEnabled = false`
 *     which forces the disbursement step to park as `awaiting_approval`
 *     — that is the safe degraded-mode posture until a real
 *     `AutonomyPolicyPort` is plumbed in.
 *
 * Each stub carries a `TODO: replace with real <X>Port adapter` comment
 * pointing at the eventual concrete adapter (payments-ledger, statement
 * generator, payouts service, notification dispatch, event bus). The
 * router (`routes/monthly-close.router.ts`) already tolerates a missing
 * orchestrator — what we want from this wiring is for the orchestrator
 * to BE present, persist runs/steps to Postgres, and produce a faithful
 * audit trail the moment migration 0099 is applied.
 *
 * The DI shape mirrors `classroom-wiring.ts` so the parent composition
 * root can drop the factory output straight into its `ServiceRegistry`.
 */

import { MonthlyClose } from '@bossnyumba/ai-copilot/orchestrators';
import {
  createMonthlyCloseRunsService,
  createDatabaseClient,
} from '@bossnyumba/database';

const { MonthlyCloseOrchestrator } = MonthlyClose;

type ReconciliationPort = MonthlyClose.ReconciliationPort;
type StatementPort = MonthlyClose.StatementPort;
type DisbursementPort = MonthlyClose.DisbursementPort;
type NotificationPort = MonthlyClose.NotificationPort;
type EventPort = MonthlyClose.EventPort;
type AutonomyPolicyPort = MonthlyClose.AutonomyPolicyPort;
type RunStorePort = MonthlyClose.RunStorePort;
type OrchestratorLogger = MonthlyClose.OrchestratorLogger;
type MonthlyCloseOrchestratorDeps = MonthlyClose.MonthlyCloseOrchestratorDeps;

/**
 * DatabaseClient derived via `ReturnType<typeof createDatabaseClient>`
 * so we sidestep the package-barrel `TS2709 Cannot use namespace ... as
 * a type` drift documented in service-registry.ts.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export interface MonthlyCloseWiringDeps {
  readonly db: DatabaseClient | null;
  readonly logger?: {
    warn(meta: object, msg: string): void;
    info(meta: object, msg: string): void;
  };
}

export interface MonthlyCloseWiring {
  readonly orchestrator: InstanceType<typeof MonthlyCloseOrchestrator>;
}

/**
 * Build the monthly-close wiring. Returns null when no Drizzle client
 * is available — DATABASE_URL must be set for the run/step audit trail
 * to be durable. Routers already render a 503 envelope when they see a
 * null orchestrator, so this short-circuit is the load-bearing degraded-
 * mode signal.
 */
export function createMonthlyCloseWiring(
  deps: MonthlyCloseWiringDeps,
): MonthlyCloseWiring | null {
  if (!deps.db) {
    return null;
  }

  const logger = adaptLogger(deps.logger);
  const store = adaptStore(createMonthlyCloseRunsService(deps.db));

  const orchestratorDeps: MonthlyCloseOrchestratorDeps = {
    store,
    reconciliation: createStubReconciliationPort(logger),
    statements: createStubStatementPort(logger),
    disbursement: createStubDisbursementPort(logger),
    notifications: createStubNotificationPort(logger),
    eventBus: createStubEventPort(logger),
    autonomy: createStubAutonomyPort(logger),
    logger,
  };

  return {
    orchestrator: new MonthlyCloseOrchestrator(orchestratorDeps),
  };
}

// ---------------------------------------------------------------------------
// Logger adaptation
// ---------------------------------------------------------------------------

function adaptLogger(
  injected: MonthlyCloseWiringDeps['logger'],
): OrchestratorLogger {
  if (injected) {
    return {
      info(meta, msg) {
        injected.info(meta, msg);
      },
      warn(meta, msg) {
        injected.warn(meta, msg);
      },
      error(meta, msg) {
        // Caller may not implement `error` — degrade to warn so we
        // never lose error context.
        const maybeError = (injected as { error?: unknown }).error;
        if (typeof maybeError === 'function') {
          (maybeError as (m: object, s: string) => void).call(
            injected,
            meta,
            msg,
          );
          return;
        }
        injected.warn(meta, msg);
      },
    };
  }
  return {
    info(meta, msg) {
      // eslint-disable-next-line no-console
      console.info('[monthly-close]', msg, meta);
    },
    warn(meta, msg) {
      // eslint-disable-next-line no-console
      console.warn('[monthly-close]', msg, meta);
    },
    error(meta, msg) {
      // eslint-disable-next-line no-console
      console.error('[monthly-close]', msg, meta);
    },
  };
}

// ---------------------------------------------------------------------------
// Store adapter — duck-types createMonthlyCloseRunsService into RunStorePort
// ---------------------------------------------------------------------------

/**
 * The Drizzle adapter shipped in `@bossnyumba/database` matches the
 * `RunStorePort` shape exactly (string-typed `stepName` widens to the
 * orchestrator's `Step` literal union). We re-cast at the boundary
 * rather than have the adapter compile-depend on `@bossnyumba/ai-copilot`.
 */
function adaptStore(
  svc: ReturnType<typeof createMonthlyCloseRunsService>,
): RunStorePort {
  return svc as unknown as RunStorePort;
}

// ---------------------------------------------------------------------------
// Stub ports — degraded-mode safe defaults
// ---------------------------------------------------------------------------

/**
 * Internal helper — guarantees each stub port logs a single
 * `degraded_port` warning on first invocation rather than spamming the
 * logger on every step. Returns a function that is idempotent for the
 * lifetime of this module instance.
 */
function makeOnceWarner(
  logger: OrchestratorLogger,
  portName: string,
): () => void {
  let warned = false;
  return () => {
    if (warned) return;
    warned = true;
    logger.warn(
      { port: portName, status: 'degraded' },
      `monthly-close: ${portName} running in degraded stub mode — TODO replace with real adapter`,
    );
  };
}

// TODO: replace with real ReconciliationPort adapter wired to the
// payments-ledger reconciliation engine (PaymentReconciliationService).
function createStubReconciliationPort(
  logger: OrchestratorLogger,
): ReconciliationPort {
  const warn = makeOnceWarner(logger, 'reconciliation');
  return {
    async reconcileForPeriod() {
      warn();
      return {
        reconciled: 0,
        unmatched: 0,
        grossRentMinor: 0,
        currency: 'KES',
      };
    },
  };
}

// TODO: replace with real StatementPort adapter wired to the owner
// statement generator (domain-services/statements).
function createStubStatementPort(
  logger: OrchestratorLogger,
): StatementPort {
  const warn = makeOnceWarner(logger, 'statements');
  return {
    async generateOwnerStatementsForPeriod() {
      warn();
      return { statements: [] };
    },
  };
}

// TODO: replace with real DisbursementPort adapter wired to the
// payouts service + per-tenant maintenance ledger.
function createStubDisbursementPort(
  logger: OrchestratorLogger,
): DisbursementPort {
  const warn = makeOnceWarner(logger, 'disbursement');
  return {
    async computeBreakdown() {
      warn();
      return {
        grossRentMinor: 0,
        platformFeeMinor: 0,
        maintenanceMinor: 0,
        currency: 'KES',
        destination: 'pending_destination',
      };
    },
    async executeDisbursement(input) {
      warn();
      // No real money should move via the stub. Surface a
      // deterministic-but-clearly-fake disbursement id so audit logs
      // make the degraded path obvious.
      return {
        disbursementId: `stub_disbursement_${input.idempotencyKey}`,
        status: 'stubbed',
      };
    },
  };
}

// TODO: replace with real NotificationPort adapter wired to the
// notification_dispatch_log + email/SMS provider integrations.
function createStubNotificationPort(
  logger: OrchestratorLogger,
): NotificationPort {
  const warn = makeOnceWarner(logger, 'notifications');
  return {
    async sendStatementEmail(input) {
      warn();
      return {
        dispatchId: `stub_dispatch_${input.tenantId}_${input.ownerId}`,
      };
    },
  };
}

// TODO: replace with real EventPort adapter wired to the platform
// event bus (Wave-2 EventBus / Kafka outbox).
function createStubEventPort(logger: OrchestratorLogger): EventPort {
  const warn = makeOnceWarner(logger, 'eventBus');
  return {
    async publish() {
      warn();
      // The orchestrator already wraps publish() in a try/catch
      // (`safePublish`), so swallowing here is belt-and-braces.
    },
  };
}

// TODO: replace with real AutonomyPolicyPort adapter wired to the
// AutonomyPolicyService living in `composition/autonomy-policy-repository`.
// Default returns `autonomousModeEnabled: false` so any disbursement
// batch is parked for human approval — the safe degraded posture.
function createStubAutonomyPort(
  logger: OrchestratorLogger,
): AutonomyPolicyPort {
  const warn = makeOnceWarner(logger, 'autonomy');
  return {
    async getPolicy() {
      warn();
      return {
        autonomousModeEnabled: false,
        finance: {
          autoApproveRefundsMinorUnits: 0,
        },
      };
    },
  };
}
