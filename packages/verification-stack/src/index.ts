/**
 * @bossnyumba/verification-stack
 *
 * Phase M-B Pre-Action Verification Stack.
 *
 * Six modules + a pipeline composer that close L1 #4/#5/#7/#9/#11 and
 * L3 #4/#7/#8/#12 from the deep-reasoning + brain-hardening frontier
 * audits.
 *
 *   - cove                  — Chain-of-Verification (factual hallucination cut)
 *   - self-refine           — Generator/Critic/Refiner on tenant-facing messages
 *   - constitutional-gate   — REQUIRED gate (no opt-out) over K-E constitution
 *   - self-consistency      — N-sample majority vote on numeric outputs
 *   - debate                — 4-persona 2-round multi-agent debate for destructive actions
 *   - pipeline              — composer + sovereign-ledger emitter
 *
 * Every module is wire-agnostic: ports for LLM calls, sovereign ledger,
 * and clock. Tests inject deterministic mocks.
 */

export * from './types.js';

// Ports
export {
  extractText,
  type LlmClient,
  type LlmMessage,
  type LlmCompletionRequest,
  type LlmCompletionResponse,
  type LlmContentBlock,
} from './ports/llm-client.js';
export {
  InMemorySovereignLedger,
  type SovereignLedgerEntry,
  type SovereignLedgerPort,
} from './ports/sovereign-ledger.js';
export {
  systemClock,
  fixedClock,
  tickingClock,
  type Clock,
} from './ports/clock.js';

// CoVe
export {
  chainOfVerification,
  extractClaims,
  generateVerificationQuestions,
  llmAnswerer,
  evidenceAnswerer,
  chainAnswerers,
  type CoveDeps,
  type AnswererPort,
  type IndependentAnswer,
  type LlmAnswererArgs,
  type EvidenceAnswererArgs,
} from './cove/index.js';

// Self-Refine
export {
  selfRefine,
  llmCritic,
  heuristicCritic,
  llmRefiner,
  heuristicRefiner,
  type SelfRefineDeps,
  type SelfRefineInput,
  type CriticPort,
  type CriticInput,
  type LlmCriticArgs,
  type RefinerPort,
  type RefinerInput,
  type LlmRefinerArgs,
} from './self-refine/index.js';

// Constitutional gate
export {
  createConstitutionalGate,
  heuristicConstitutionalCritic,
  type ConstitutionalGate,
  type ConstitutionalGateDeps,
  type HeuristicCriticOptions,
  type ConstitutionalCheckInput,
  type ConstitutionalCriticPort,
  type CriticVerdictLike,
  type RuleSeverityMap,
} from './constitutional-gate/index.js';

// Self-Consistency
export {
  consistentCompute,
  llmSampler,
  functionSampler,
  type ConsistentComputeDeps,
  type SamplerPort,
  type LlmSamplerArgs,
  type NumericPromptInput,
} from './self-consistency/index.js';

// Debate
export {
  runDebate,
  debateRequired,
  DEBATE_REQUIRED_ACTIONS,
  llmPersona,
  heuristicPersona,
  PERSONA_CONFIGS,
  configFor,
  type DebateDeps,
  type DebateInput,
  type PersonaPort,
  type PersonaInput,
  type LlmPersonaArgs,
  type PersonaConfig,
} from './debate/index.js';

// Pipeline
export { verifyBeforeAction, type PipelineDeps } from './pipeline/index.js';
