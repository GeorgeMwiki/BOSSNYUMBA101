/**
 * @bossnyumba/hardening-runtime
 *
 * M-E brain hardening runtime — defense in depth around the BNY-Brain.
 *
 * Three frontier principles (verbatim from L3 audit closing note):
 *   1. Defense in depth, not patch — every individual safety layer broke
 *      in 2025. Only STACKS survive.
 *   2. Assume the base model can scheme — Sleeper Agents (Jan 2024),
 *      Apollo (Dec 2024), Anthropic agentic-misalignment (Oct 2025).
 *      Verify outputs at runtime.
 *   3. Human-in-the-loop for irreversible destructive actions — no
 *      exceptions, regardless of confidence score.
 *
 * Closes L3 top-15 risk-ranked items: #1, #2, #3, #5, #11, #13, #14.
 *
 * Eight modules + a composer:
 *
 *   - confidence/         — L3 #1: verbalized + logprob → autonomy slider
 *   - circuit-breakers/   — L3 #3: cost + step caps on every agent loop
 *   - input-shield/       — L3 #2: Tier-1 input shield (Lakera/Rebuff)
 *   - spotlighting/       — L3 #5: RAG markers + instruction-detection
 *   - pii-tokenization/   — L3 #11: tokenize at prompt, de-tokenize at action
 *   - alignment-auditor/  — L3 #13: nightly red-team battery + cron
 *   - anomaly-probe/      — L3 #14: sleeper-defection runtime probe
 *   - stack/              — composer wiring all of the above
 */

// Shared types
export * from './types.js';

// Confidence
export {
  extractConfidence,
  appendJustAskConfidence,
  calibrateVerbalized,
  combineCalibrated,
  VERBALIZED_CALIBRATION_CURVE,
} from './confidence/index.js';

// Circuit-breakers
export {
  withCircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CAPS,
  mergeCaps,
} from './circuit-breakers/index.js';
export type {
  StepResult,
  WithCircuitBreakerOptions,
} from './circuit-breakers/index.js';

// Input shield
export {
  screenInput,
  SHIELD_PATTERNS,
  SHIELD_BLOCK_THRESHOLD,
} from './input-shield/index.js';
export type {
  LakeraClient,
  ScreenInputOptions,
  ShieldPattern,
} from './input-shield/index.js';

// Spotlighting
export {
  spotlight,
  SPOTLIGHT_OPEN,
  SPOTLIGHT_CLOSE,
  SPOTLIGHT_SYSTEM_DIRECTIVE,
} from './spotlighting/index.js';

// PII tokenization
export {
  tokenizePII,
  deTokenize,
  detectAll,
} from './pii-tokenization/index.js';
export type {
  TokenizeOptions,
  DeTokenizeResult,
  DetectedSpan,
} from './pii-tokenization/index.js';

// Alignment auditor
export {
  runAlignmentAudit,
  renderAuditMarkdown,
  isPassRateRegression,
  registerAuditCron,
  DEFAULT_AUDIT_FIXTURES,
} from './alignment-auditor/index.js';
export type {
  BrainPort,
  JudgePort,
  RunAuditOptions,
  AuditCronDeps,
  AuditReportSink,
  AuditRegressionAlerter,
  PriorReportLoader,
  RegisterAuditCronOptions,
  SchedulerPort,
} from './alignment-auditor/index.js';

// Anomaly probe
export { probeOutput } from './anomaly-probe/index.js';
export type { ProbeOptions } from './anomaly-probe/index.js';

// Stack composer
export { hardenedTurn } from './stack/index.js';
export type { HardenedTurnDeps } from './stack/index.js';
