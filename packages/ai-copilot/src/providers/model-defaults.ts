/**
 * Default Anthropic model IDs by workload class.
 *
 * The BOSSNYUMBA AI copilot deliberately uses different Claude tiers for
 * different kinds of work so that fast, cheap tasks (vendor matching,
 * classification) get Haiku while reasoning-heavy tasks (predictions,
 * lease clause review) get Sonnet, and only the highest-stakes work
 * uses Opus.
 */

export const ANTHROPIC_MODEL_DEFAULTS = {
  /** Sonnet — balanced reasoning, default for predictions / triage / drafting */
  PREDICTIONS: 'claude-3-7-sonnet-latest',
  REVIEW: 'claude-3-7-sonnet-latest',
  DRAFTING: 'claude-3-7-sonnet-latest',
  TRIAGE: 'claude-3-7-sonnet-latest',

  /** Haiku — fast/cheap, used for matching, routing, simple classification */
  MATCHING: 'claude-3-5-haiku-latest',
  CLASSIFICATION: 'claude-3-5-haiku-latest',

  /** Opus — highest-stakes reasoning (legal clauses, escalated risk) */
  LEGAL_REVIEW: 'claude-opus-4-latest',
  EXECUTIVE_ALERTS: 'claude-opus-4-latest',
} as const;

export type AnthropicWorkload = keyof typeof ANTHROPIC_MODEL_DEFAULTS;

/** The fallback/default model when no workload is specified. */
export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_MODEL_DEFAULTS.PREDICTIONS;

/** Default max output tokens by workload. */
export const DEFAULT_MAX_TOKENS: Record<AnthropicWorkload, number> = {
  PREDICTIONS: 2048,
  REVIEW: 2048,
  DRAFTING: 2048,
  TRIAGE: 1536,
  MATCHING: 768,
  CLASSIFICATION: 512,
  LEGAL_REVIEW: 4096,
  EXECUTIVE_ALERTS: 3072,
};

/** Default temperatures by workload. Reasoning tasks run colder. */
export const DEFAULT_TEMPERATURE: Record<AnthropicWorkload, number> = {
  PREDICTIONS: 0.2,
  REVIEW: 0.2,
  DRAFTING: 0.5,
  TRIAGE: 0.3,
  MATCHING: 0.1,
  CLASSIFICATION: 0.1,
  LEGAL_REVIEW: 0.1,
  EXECUTIVE_ALERTS: 0.2,
};

/**
 * Resolve the default model for a given workload.
 * Falls back to the general predictions model if the workload is unknown.
 */
export function getDefaultModel(workload?: AnthropicWorkload): string {
  if (!workload) return DEFAULT_ANTHROPIC_MODEL;
  return ANTHROPIC_MODEL_DEFAULTS[workload] ?? DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Resolve the default max tokens for a given workload.
 */
export function getDefaultMaxTokens(workload?: AnthropicWorkload): number {
  if (!workload) return 2048;
  return DEFAULT_MAX_TOKENS[workload] ?? 2048;
}

/**
 * Resolve the default temperature for a given workload.
 */
export function getDefaultTemperature(workload?: AnthropicWorkload): number {
  if (!workload) return 0.3;
  return DEFAULT_TEMPERATURE[workload] ?? 0.3;
}
