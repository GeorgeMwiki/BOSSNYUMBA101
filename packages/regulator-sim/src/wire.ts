/**
 * Regulator simulation — composition root (default-OFF feature flag).
 *
 * The simulator ships behind a flag that is OFF unless explicitly enabled.
 * This package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_REGULATOR_SIM` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wireRegulatorSim} returns
 * `null` and the gateway simply never mounts the regulator-readiness route.
 *
 * The returned {@link RegulatorSim} is a thin, dependency-bound facade: the
 * host calls `sim.handle(input)` to run one audit-replay drill, persist the
 * run via the injected store, and fire-and-forget the audit sink — without
 * re-threading ports each time. Malformed input is rejected at the zod
 * boundary and returned as a structured failure rather than thrown.
 *
 * @module @bossnyumba/regulator-sim/wire
 */

import {
  auditReplayInputSchema,
  type AuditReplayInput,
  type AuditReplayResult,
} from './types.js';
import { replayAudit } from './audit-replay.js';
import {
  systemClock,
  type RegulatorAuditSink,
  type RegulatorAuditStore,
  type RegulatorClock,
} from './ports.js';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const REGULATOR_SIM_FLAG = 'BOSSNYUMBA_FEATURE_REGULATOR_SIM' as const;

/** Dependencies the regulator-sim facade binds once at wire time. */
export interface RegulatorSimDeps {
  readonly store: RegulatorAuditStore;
  readonly audit?: RegulatorAuditSink;
  readonly clock?: RegulatorClock;
}

/**
 * Dependencies for {@link wireRegulatorSim}. Extends the engine deps with a
 * single `enabled` boolean the caller derives from the feature flag.
 */
export interface WireRegulatorSimDeps extends RegulatorSimDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_REGULATOR_SIM`. The composition root
   * computes `flagValue === 'on'` and passes the boolean here; this package
   * never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Outcome of one regulator-readiness drill. */
export interface RegulatorSimOutcome {
  readonly runId: string;
  readonly ok: boolean;
  readonly result?: AuditReplayResult;
  readonly error?: string;
}

/** Dependency-bound regulator-sim facade returned by {@link wireRegulatorSim}. */
export interface RegulatorSim {
  /**
   * Run one audit-replay drill. The input is validated at the boundary with
   * zod; a malformed payload yields `{ ok: false, error }` rather than
   * throwing into the host route. On success the run is persisted via the
   * store and the audit sink is fired (fire-and-forget).
   */
  handle(input: AuditReplayInput): Promise<RegulatorSimOutcome>;
}

function emit(audit: RegulatorAuditSink | undefined, passed: boolean): void {
  if (!audit) return;
  try {
    audit.log({
      kind: 'audit_replay',
      passed,
      detail: passed ? 'audit replay passed' : 'audit replay produced findings',
    });
  } catch {
    // Audit sink is fire-and-forget; never let it break the hot path.
  }
}

/**
 * Wire the regulator simulator behind its feature flag.
 *
 * Returns a bound {@link RegulatorSim} when `deps.enabled` is true, or `null`
 * when the flag is off (default). Returning `null` is the single, explicit
 * signal the caller uses to skip mounting the regulator route entirely.
 */
export function wireRegulatorSim(
  deps: WireRegulatorSimDeps,
): RegulatorSim | null {
  if (!deps.enabled) return null;

  const store = deps.store;
  const audit = deps.audit;
  const clock = deps.clock ?? systemClock;

  return {
    handle: async (input: AuditReplayInput): Promise<RegulatorSimOutcome> => {
      const parsed = auditReplayInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          runId: '',
          ok: false,
          error: 'invalid audit replay input',
        };
      }

      const now = clock.now();
      const nowIso = now.toISOString();
      const runId = `run-${now.getTime()}`;

      await store.create({
        runId,
        status: 'pending',
        startedAt: nowIso,
      });

      // `input` is already typed AuditReplayInput; the zod parse above is the
      // boundary guard. Forward the original value to preserve the exact
      // optional-property shape (exactOptionalPropertyTypes).
      const result = replayAudit(input, nowIso);

      const persisted = await store.update(runId, {
        status: 'complete',
        completedAt: clock.now().toISOString(),
        result,
      });

      emit(audit, result.passed);

      return {
        runId: persisted.runId,
        ok: result.passed,
        result,
      };
    },
  };
}
