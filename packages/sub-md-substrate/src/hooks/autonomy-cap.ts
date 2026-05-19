/**
 * Autonomy-cap hook — enforces a hard ceiling on the side-effect /
 * LLM-call / external-call budget a primitive may consume in a single
 * invocation.
 *
 * Returns a `CapTracker` that primitives bump as they consume budget.
 * The tracker throws / returns refused = true on overrun; primitives are
 * expected to short-circuit and emit a `rejected` ledger entry rather
 * than partially exceed cap.
 */

import type { AutonomyCap } from '../types.js';

export type CapMetric = 'side-effect' | 'llm-call' | 'external-call';

export interface CapTracker {
  consume(metric: CapMetric, amount?: number): CapConsumeResult;
  used(): Readonly<Record<CapMetric, number>>;
  remaining(): Readonly<Record<CapMetric, number>>;
}

export type CapConsumeResult =
  | { readonly ok: true; readonly remaining: number }
  | { readonly ok: false; readonly reason: string; readonly remaining: number };

export function createCapTracker(cap: AutonomyCap): CapTracker {
  let sideEffectUsed = 0;
  let llmUsed = 0;
  let externalUsed = 0;

  function limitFor(metric: CapMetric): number {
    switch (metric) {
      case 'side-effect':
        return cap.maxSideEffects;
      case 'llm-call':
        return cap.maxLlmCalls;
      case 'external-call':
        return cap.maxExternalCalls;
    }
  }

  function usedFor(metric: CapMetric): number {
    switch (metric) {
      case 'side-effect':
        return sideEffectUsed;
      case 'llm-call':
        return llmUsed;
      case 'external-call':
        return externalUsed;
    }
  }

  return {
    consume(metric: CapMetric, amount = 1): CapConsumeResult {
      const limit = limitFor(metric);
      const current = usedFor(metric);
      if (current + amount > limit) {
        return {
          ok: false,
          reason: `${metric} cap exceeded (${current}+${amount} > ${limit})`,
          remaining: Math.max(0, limit - current),
        };
      }
      if (metric === 'side-effect') sideEffectUsed += amount;
      else if (metric === 'llm-call') llmUsed += amount;
      else externalUsed += amount;
      return { ok: true, remaining: limit - usedFor(metric) };
    },
    used(): Readonly<Record<CapMetric, number>> {
      return Object.freeze({
        'side-effect': sideEffectUsed,
        'llm-call': llmUsed,
        'external-call': externalUsed,
      });
    },
    remaining(): Readonly<Record<CapMetric, number>> {
      return Object.freeze({
        'side-effect': Math.max(0, cap.maxSideEffects - sideEffectUsed),
        'llm-call': Math.max(0, cap.maxLlmCalls - llmUsed),
        'external-call': Math.max(0, cap.maxExternalCalls - externalUsed),
      });
    },
  };
}
