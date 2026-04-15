/**
 * LLM call metric emitter.
 */
import { emitMetric } from './log-sink.js';

export interface LlmCallMetric {
  provider: string;
  model: string;
  /** Total tokens consumed (prompt + completion). */
  tokens: number;
  latencyMs: number;
  tenantId?: string;
  /** Optional prompt/completion split for richer dashboards. */
  promptTokens?: number;
  completionTokens?: number;
  /** "ok" | "error" | provider-specific finish reason. */
  outcome?: string;
}

export function emitLlmCall(metric: LlmCallMetric): void {
  emitMetric('llm.call', metric.latencyMs, {
    provider: metric.provider,
    model: metric.model,
    tokens: metric.tokens,
    promptTokens: metric.promptTokens,
    completionTokens: metric.completionTokens,
    tenantId: metric.tenantId,
    outcome: metric.outcome,
  });
}
