/**
 * Learning-signal-emitter — injected ports.
 *
 * The emitter is pure routing + scoring logic; everything with a side effect
 * is a port the host wires at boot. There is NO Supabase / Drizzle / HTTP /
 * `process.env` / `console` import in this package — the kernel composition
 * root supplies real adapters; tests supply in-memory fakes.
 *
 * Seams:
 *   - {@link SignalStore}     — append-only persistence for emitted signals
 *                               (immutable double-entry-style: create + mark
 *                               routed, never mutate the signal body).
 *   - {@link SignalSinks}     — the fan-out targets (belief / reflexion /
 *                               mastery / pattern / persona / preference).
 *                               Each is optional; an absent sink is "not
 *                               configured", never a failure.
 *   - {@link SignalAuditSink} — fire-and-forget audit (never awaited).
 *   - {@link Clock}           — injectable wall-clock for deterministic tests.
 *
 * @module @bossnyumba/learning-signal-emitter/ports
 */

import type { LearningSignal, SignalRoute } from './types';

/**
 * Append-only persistence port for emitted signals. The host backs this with
 * the `learning_signals` table (UNIQUE on `signal_hash` absorbs idempotent
 * re-emits) or an in-memory map in tests.
 *
 * Signals are immutable by contract — there is no `update`/`delete`. `create`
 * is idempotent on `signalHash`: a duplicate returns the already-stored row
 * rather than throwing, so an at-least-once re-emit is a safe no-op. `markRouted`
 * appends the resolved route list as an immutable side-record.
 */
export interface SignalStore {
  /** Look up a previously stored signal by its idempotency hash. */
  get(signalHash: string): Promise<LearningSignal | null>;
  /**
   * Store a freshly built signal. Idempotent on `signalHash`: if one already
   * exists, the stored copy is returned unchanged (no mutation).
   */
  create(signal: LearningSignal): Promise<LearningSignal>;
  /**
   * Record where a signal was fanned out to. Append-only audit side-record;
   * the signal body itself is never mutated.
   */
  markRouted(
    signalHash: string,
    routes: ReadonlyArray<SignalRoute>,
  ): Promise<void>;
}

/**
 * Plug-in fan-out surface. Each downstream learning primitive exposes a tiny
 * adapter so the emitter never reaches into module internals. Adapters return
 * `true` when they accepted the signal so the result carries an accurate
 * `routedTo`. An `undefined` return / absent adapter means "not configured" —
 * not a failure.
 *
 * The belief sink is the SOLE authorised belief writer (CLAUDE.md hard rule):
 * it wraps the belief-engine convince-loop. The emitter only ever hands it the
 * signal — it never strengthens a belief itself.
 */
export interface SignalSinks {
  readonly beliefStrengthen?: (s: LearningSignal) => Promise<boolean>;
  readonly reflexionRecord?: (s: LearningSignal) => Promise<boolean>;
  readonly masteryUpdate?: (s: LearningSignal) => Promise<boolean>;
  readonly patternStore?: (s: LearningSignal) => Promise<boolean>;
  readonly personaPrompt?: (s: LearningSignal) => Promise<boolean>;
  readonly preferenceLearner?: (s: LearningSignal) => Promise<boolean>;
}

/**
 * Optional audit sink for emitted signals. Fire-and-forget; the emitter never
 * awaits it on the hot path and a throw is swallowed so a logging failure can
 * never break a learning emission.
 */
export interface SignalAuditSink {
  log(entry: {
    readonly signalHash: string;
    readonly actionRef: string;
    readonly tenantScope: string;
    readonly reward: number;
    readonly routedTo: ReadonlyArray<SignalRoute>;
  }): void;
}

/** Injectable clock so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: Clock = { now: () => new Date() };
