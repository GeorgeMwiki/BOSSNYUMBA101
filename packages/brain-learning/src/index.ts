/**
 * @bossnyumba/brain-learning
 *
 * Phase N-E — runtime learning + self-improvement substrate.
 *
 * Anthropic does not allow fine-tuning Claude in 2026, so this package
 * splits learning into:
 *   (a) a **runtime layer** that works on any model — trace logging,
 *       owner-reaction capture, active learning, skill curation, KG
 *       growth, eval-driven iteration, 90-day cycle reporting, and
 *   (b) a **data pipeline** that feeds self-hosted student models
 *       (Qwen / Llama / Mistral) — preference-pair builder + distilled
 *       student infra.
 *
 * The 9 modules:
 *   1. trace-logger             — every conversation captured + 4-layer PII
 *   2. owner-reaction-capture   — 9 reaction kinds → feedback events
 *   3. preference-pair-builder  — DPO/KTO/SimPO/PRM step-DPO JSONL
 *   4. active-learning-queue    — uncertainty sampling for human labelling
 *   5. eval-driven-iteration    — K-D Inspect drives 5pp regression alerts
 *   6. skill-curation           — auto-promote/quarantine on top of K-C
 *   7. knowledge-graph-growth   — edge decay + ceiling eviction on K-D
 *   8. distilled-student-infra  — IStudentModelClient + 3 adapters
 *   9. 90-day-cycle-tracker     — internal admin weekly digest
 *
 * All wire-side persistence is delegated to ports. The package has no
 * direct dependency on the database or kernel substrate.
 */

export * from './types.js';

// 1. trace-logger
export {
  logTrace,
  storageTierFor,
  isAlreadyLogged,
  makeRedactionPipeline,
  redactByRegex,
  applyConsentGate,
} from './trace-logger/index.js';
export type {
  TraceLoggerPorts,
  LogTraceInput,
  LogTraceOutcome,
  TraceEventStore,
  RedactionPipeline,
  RedactionInput,
  RedactionOutput,
  RedactionPipelineConfig,
  MLRedactor,
  CanaryChecker,
} from './trace-logger/index.js';
