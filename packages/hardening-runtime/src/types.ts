/**
 * @bossnyumba/hardening-runtime — public types
 *
 * M-E brain hardening runtime substrate. Three frontier principles drive
 * every type below (L3 §closing-note, verbatim):
 *
 *   1. Defense in depth, not patch — every individual safety layer broke in
 *      2025. Only STACKS survive.
 *   2. Assume the base model can scheme — Sleeper Agents (Jan 2024),
 *      Apollo (Dec 2024), Anthropic agentic-misalignment (Oct 2025) all
 *      empirically demonstrated scheming in frontier models. Verify
 *      outputs at runtime.
 *   3. Human-in-the-loop for irreversible destructive actions — no
 *      exceptions, regardless of confidence score.
 *
 * Types here are wire-agnostic. All side-effects (telemetry, ledger
 * persistence, cron registration, LLM calls) are delegated to ports passed
 * in to the orchestrator. The composer wires them together.
 */

// ============================================================================
// L3 #1 — Confidence (verbalized + logprob driven autonomy slider)
// ============================================================================

/**
 * Confidence verdict — what the brain reports about its own answer.
 *
 * `verbalized` is the raw 0..1 score the model output when asked
 * "how confident are you?" (Just-Ask-Confidence, Lin et al. 2022).
 *
 * `logprob` is `exp(sum(logprob(answer_tokens)))` from the API, when
 * exposed. Both are noisy on their own — `calibrated` is the joint estimate
 * after passing through the L3-published calibration curve.
 *
 * `calibrated` drives the K-E autonomy slider live:
 *   < 0.30 → safe-mode (K-B kicks in; sub-MD demoted)
 *   < 0.50 → plan-mode (no execute; surface draft for human review)
 *   < 0.70 → high-confidence-only execute (low-stakes only)
 *   ≥ 0.70 → normal autonomy per the K-E managed-settings
 *   ≥ 0.95 → eligible for destructive irreversible (still gated by
 *            multi-agent debate per L3 §6.1)
 */
export interface Confidence {
  readonly verbalized: number | null;
  readonly logprob: number | null;
  readonly calibrated: number;
  readonly mode: ConfidenceMode;
  readonly reason: string;
}

/**
 * The autonomy-slider routing decision driven by `calibrated`.
 */
export type ConfidenceMode =
  | 'safe-mode'
  | 'plan-mode'
  | 'high-confidence-only'
  | 'normal'
  | 'destructive-eligible';

// ============================================================================
// L3 #3 — Cost + step circuit-breakers
// ============================================================================

/**
 * Caps for a single agent loop. Defaults per L3 §8 #3 are
 *   30 steps · $5 cost · 120s wall · 100 tool calls
 * (a looping agent = $500, so caps are non-negotiable).
 *
 * Cents (not USD) are used internally to avoid float accumulation —
 * matches @bossnyumba/autonomy-governance.
 */
export interface CircuitBreakerCaps {
  readonly maxSteps: number;
  readonly maxCostUsdCents: number;
  readonly maxWallTimeMs: number;
  readonly maxToolCalls: number;
}

/**
 * Running counters consulted on every step.
 */
export interface CircuitBreakerCounters {
  readonly steps: number;
  readonly costUsdCents: number;
  readonly wallTimeMs: number;
  readonly toolCalls: number;
}

/**
 * Which cap tripped — emitted on the `circuit-breaker-tripped` event.
 */
export type CircuitBreakerCap =
  | 'max-steps'
  | 'max-cost'
  | 'max-wall-time'
  | 'max-tool-calls';

/**
 * Result of a guarded operation. Either `ok: true` with the result, or
 * `ok: false` with the tripped cap + the snapshot of counters.
 */
export type CircuitBreakerResult<T> =
  | { readonly ok: true; readonly value: T; readonly counters: CircuitBreakerCounters }
  | {
      readonly ok: false;
      readonly trippedCap: CircuitBreakerCap;
      readonly counters: CircuitBreakerCounters;
      readonly reason: string;
    };

/**
 * Emitted when a cap trips. Wire-side adapter should:
 *  - log the event to sovereign-action-ledger
 *  - flip the sub-MD into safe-mode (K-B fallback)
 *  - surface to the platform admin if `severity === 'high'`
 */
export interface CircuitBreakerTrippedEvent {
  readonly type: 'circuit-breaker-tripped';
  readonly tenantId: string | null;
  readonly subMd: string | null;
  readonly trippedCap: CircuitBreakerCap;
  readonly counters: CircuitBreakerCounters;
  readonly caps: CircuitBreakerCaps;
  readonly severity: 'low' | 'medium' | 'high';
  readonly reason: string;
  readonly timestamp: string;
}

// ============================================================================
// L3 #3 — Tier-1 input shield (Lakera/Rebuff pattern)
// ============================================================================

/**
 * Categories the input shield can flag. Mirrors OWASP LLM Top-10 (2025)
 * + Lakera/Rebuff/PyRIT taxonomy.
 */
export type ShieldCategory =
  | 'prompt-injection'
  | 'jailbreak'
  | 'indirect-injection'
  | 'pii-bait'
  | 'system-prompt-leak'
  | 'role-confusion'
  | 'goal-hijack'
  | 'tool-call-injection';

/**
 * Verdict from the input shield.
 *
 * `pass` — clean; let it through.
 * `block` — refused; do NOT pass to the LLM. Surface a generic refusal.
 */
export type ShieldVerdict =
  | { readonly outcome: 'pass'; readonly score: number; readonly signals: ReadonlyArray<string> }
  | {
      readonly outcome: 'block';
      readonly category: ShieldCategory;
      readonly reason: string;
      readonly score: number;
      readonly signals: ReadonlyArray<string>;
    };

// ============================================================================
// L3 #5 — Spotlighting + instruction-detection on RAG
// ============================================================================

/**
 * Result of wrapping a retrieved chunk in spotlight delimiters. Suspicious
 * imperatives detected inside the chunk are exposed on `suspiciousMarkers`
 * for downstream telemetry, but content is NEVER altered (Microsoft
 * spotlighting prescription) — only marked.
 */
export interface SpotlightedChunk {
  readonly wrapped: string;
  readonly sourceUri: string;
  readonly originalLength: number;
  readonly suspiciousMarkers: ReadonlyArray<string>;
  readonly suspicionScore: number;
}

// ============================================================================
// L3 #11 — PII tokenization at prompt layer
// ============================================================================

/**
 * One PII detection class. Tanzania-aware: KRA PIN (TIN), NIDA, M-Pesa
 * are first-class. Generic classes (phone, email, full-name, address)
 * round out the set.
 */
export type PiiClass =
  | 'phone'
  | 'email'
  | 'kra-pin'
  | 'nida'
  | 'mpesa-acct'
  | 'nin'
  | 'full-name'
  | 'address';

/**
 * A single detected PII span + its replacement token.
 *
 * `token` is a deterministic string of the form `<CLASS_xXXXX>` where
 * `xXXXX` is a 4-char alphanumeric short hash of the original value
 * (case-insensitive, salted with a per-session secret in the SessionStore).
 */
export interface PiiSpan {
  readonly piiClass: PiiClass;
  readonly original: string;
  readonly token: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Result of running `tokenizePII`. `tokenized` is what is safe to pass to
 * the LLM. `tokenMap` is what the action layer needs at de-tokenize time —
 * it MUST be persisted encrypted in SessionStore per L3 §7.2.
 */
export interface PiiTokenizationResult {
  readonly tokenized: string;
  readonly tokenMap: ReadonlyMap<string, string>;
  readonly spans: ReadonlyArray<PiiSpan>;
}

// ============================================================================
// L3 #13 — Nightly alignment auditor
// ============================================================================

/**
 * One red-team fixture the nightly auditor will run.
 */
export interface AuditFixture {
  readonly id: string;
  readonly category:
    | 'prompt-injection'
    | 'jailbreak'
    | 'indirect-injection'
    | 'goal-conflict'
    | 'fair-housing'
    | 'jurisdictional'
    | 'pii-exfil'
    | 'scheming';
  readonly prompt: string;
  /** Expected verdict from the *brain* under audit — i.e. what the
   *  brain SHOULD answer (or "refuse" / "escalate"). */
  readonly expected: 'refuse' | 'escalate' | 'comply-safely';
  readonly notes?: string;
}

/**
 * One row in the per-fixture audit result.
 */
export interface AuditFixtureResult {
  readonly fixtureId: string;
  readonly category: AuditFixture['category'];
  readonly passed: boolean;
  readonly actual: 'refuse' | 'escalate' | 'comply-safely' | 'comply-unsafely';
  readonly response: string;
  readonly latencyMs: number;
}

/**
 * The full audit report. Persisted by the cron wrapper to
 * `.audit/alignment-auditor-<date>.md`.
 */
export interface AlignmentAuditReport {
  readonly runAt: string;
  readonly totalFixtures: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly regressedFromLast: ReadonlyArray<string>;
  readonly results: ReadonlyArray<AuditFixtureResult>;
}

// ============================================================================
// L3 #14 — Sleeper-defection runtime probe
// ============================================================================

/**
 * Verdict from the anomaly probe — observes, does NOT block.
 *
 * `tag` is one of:
 *   - 'normal'      — no anomalies detected
 *   - 'suspicious'  — anomalies present; flag for review
 *   - 'defection'   — multiple high-severity anomalies; alert platform admin
 *
 * `signals` lists the specific anomaly markers fired (e.g. 'language-switch',
 * 'tone-shift', 'unusual-entity', 'instruction-suffix').
 */
export interface AnomalyVerdict {
  readonly tag: 'normal' | 'suspicious' | 'defection';
  readonly score: number;
  readonly signals: ReadonlyArray<string>;
  readonly reason: string;
}

// ============================================================================
// Stack — composer
// ============================================================================

/**
 * The orchestrated turn input. Composer reads `userMessage`, runs through
 * shield → tokenize → spotlight → LLM → confidence → anomaly → de-tokenize,
 * then emits a HardenedResult.
 */
export interface HardenedTurnInput {
  readonly systemPrompt: string;
  readonly userMessage: string;
  /** Already-retrieved RAG chunks. Composer spotlights each. */
  readonly retrieved: ReadonlyArray<{ readonly text: string; readonly sourceUri: string }>;
  /** Optional tool catalog (names only — composer does not invoke). */
  readonly tools: ReadonlyArray<string>;
  readonly tenantId: string | null;
  readonly subMd: string | null;
  readonly options?: HardenedTurnOptions;
}

export interface HardenedTurnOptions {
  readonly caps?: Partial<CircuitBreakerCaps>;
  /** If true, allow `destructive-eligible` confidence routing. Defaults to
   *  false — destructive actions require explicit human approval per L3
   *  principle #3. */
  readonly allowDestructive?: boolean;
  /** Override the LLM port (test harness wiring). */
  readonly llm?: LlmPort;
}

/**
 * Wire-side port the composer calls to invoke the LLM. Wire-agnostic —
 * adapters live in services/ai-orchestrator / ai-copilot.
 */
export interface LlmPort {
  invoke(args: {
    readonly systemPrompt: string;
    readonly userMessage: string;
    readonly retrieved: ReadonlyArray<SpotlightedChunk>;
  }): Promise<LlmResponse>;
}

export interface LlmResponse {
  readonly text: string;
  readonly logprob: number | null;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsdCents: number;
  readonly latencyMs: number;
}

/**
 * Result of running the full stack. The composer surfaces *every* layer's
 * verdict so the wire-side adapter can decide what to log / surface / gate.
 */
export interface HardenedResult {
  readonly ok: boolean;
  readonly output: string | null;
  readonly shield: ShieldVerdict;
  readonly piiTokenization: PiiTokenizationResult | null;
  readonly spotlighted: ReadonlyArray<SpotlightedChunk>;
  readonly llmResponse: LlmResponse | null;
  readonly confidence: Confidence | null;
  readonly anomaly: AnomalyVerdict | null;
  readonly trippedCap: CircuitBreakerCap | null;
  readonly stoppedAt:
    | 'shield-blocked'
    | 'circuit-breaker-tripped'
    | 'safe-mode-fallback'
    | 'completed'
    | 'errored';
  readonly stoppedReason: string;
  readonly counters: CircuitBreakerCounters;
}
