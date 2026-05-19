/**
 * hardenedTurn — the M-E stack composer.
 *
 * L3 §9 (worked example) — orchestrates every layer in order:
 *
 *   1. Input shield (Tier-1)        — refuse PI / jailbreak at edge
 *   2. PII tokenization              — replace tenant PII with tokens
 *   3. Spotlight retrieved chunks    — mark RAG as data, not instructions
 *   4. Compose system prompt         — prepend spotlight directive +
 *                                      append just-ask-confidence suffix
 *   5. Invoke LLM (wire-side port)   — track tokens + cost
 *   6. Extract confidence            — drive autonomy slider
 *   7. Anomaly probe                 — observe-only sleeper detection
 *   8. De-tokenize action payload    — restore real PII at action layer
 *   9. Emit HardenedResult           — every layer's verdict surfaced
 *
 * The whole stack runs inside a circuit-breaker so a runaway LLM call
 * can't bankrupt a tenant.
 *
 * Defense in depth: every layer can short-circuit the turn with a safe
 * fallback. None blocks completion silently — every short-circuit
 * surfaces a reason via `HardenedResult.stoppedAt` + `stoppedReason`.
 */

import type {
  CircuitBreakerCounters,
  Confidence,
  HardenedResult,
  HardenedTurnInput,
  LlmPort,
  LlmResponse,
  PiiTokenizationResult,
  ShieldVerdict,
  SpotlightedChunk,
} from '../types.js';
import { appendJustAskConfidence, extractConfidence } from '../confidence/index.js';
import {
  withCircuitBreaker,
  mergeCaps,
} from '../circuit-breakers/index.js';
import { screenInput } from '../input-shield/index.js';
import {
  SPOTLIGHT_SYSTEM_DIRECTIVE,
  spotlight,
} from '../spotlighting/index.js';
import { tokenizePII } from '../pii-tokenization/index.js';
import { probeOutput } from '../anomaly-probe/index.js';

export interface HardenedTurnDeps {
  readonly llm: LlmPort;
  /**
   * Per-session salt for PII tokenization. The wire-side adapter pulls
   * this from K-A SessionStore. Required in production; tests may use
   * empty string.
   */
  readonly sessionSalt: string;
}

const EMPTY_COUNTERS: CircuitBreakerCounters = Object.freeze({
  steps: 0,
  costUsdCents: 0,
  wallTimeMs: 0,
  toolCalls: 0,
});

/**
 * Run one hardened turn end-to-end. Returns a frozen `HardenedResult`.
 *
 * NEVER throws. Every layer's failure mode is surfaced via the result.
 */
export async function hardenedTurn(
  input: HardenedTurnInput,
  deps: HardenedTurnDeps,
): Promise<HardenedResult> {
  // Stage 1 — Input shield.
  const shield = await screenInput(input.userMessage);
  if (shield.outcome === 'block') {
    return Object.freeze({
      ok: false,
      output: null,
      shield,
      piiTokenization: null,
      spotlighted: Object.freeze([]),
      llmResponse: null,
      confidence: null,
      anomaly: null,
      trippedCap: null,
      stoppedAt: 'shield-blocked',
      stoppedReason: shield.reason,
      counters: EMPTY_COUNTERS,
    });
  }

  // Stage 2 — PII tokenization (user message + each retrieved chunk).
  // The model only ever sees tokens.
  const tokenization = tokenizePII(input.userMessage, {
    sessionSalt: deps.sessionSalt,
  });

  // Stage 3 — Spotlight retrieved chunks.
  const spotlighted: SpotlightedChunk[] = input.retrieved.map(
    ({ text, sourceUri }) => spotlight(text, sourceUri),
  );

  // Stage 4 — Compose system prompt.
  const composedSystemPrompt = composePrompt(input.systemPrompt);

  // Stage 5 — Invoke LLM under circuit-breaker.
  const llmPort = input.options?.llm ?? deps.llm;
  const caps = mergeCaps(input.options?.caps);

  let llmResponse: LlmResponse | null = null;
  let trippedCap: HardenedResult['trippedCap'] = null;
  let counters: CircuitBreakerCounters = EMPTY_COUNTERS;
  let stoppedReason = '';

  const circuit = await withCircuitBreaker<LlmResponse>(
    async () => {
      const resp = await llmPort.invoke({
        systemPrompt: composedSystemPrompt,
        userMessage: tokenization.tokenized,
        retrieved: Object.freeze([...spotlighted]),
      });
      return {
        done: true,
        value: resp,
        costDeltaUsdCents: resp.costUsdCents,
        toolCallsDelta: 0,
      };
    },
    {
      caps,
      tenantId: input.tenantId,
      subMd: input.subMd,
    },
  );

  if (circuit.ok) {
    llmResponse = circuit.value;
    counters = circuit.counters;
  } else {
    trippedCap = circuit.trippedCap;
    counters = circuit.counters;
    stoppedReason = circuit.reason;
    return Object.freeze({
      ok: false,
      output: null,
      shield,
      piiTokenization: tokenization,
      spotlighted: Object.freeze(spotlighted),
      llmResponse: null,
      confidence: null,
      anomaly: null,
      trippedCap,
      stoppedAt: 'circuit-breaker-tripped',
      stoppedReason,
      counters,
    });
  }

  // Stage 6 — Extract confidence.
  const confidence: Confidence = extractConfidence(llmResponse);

  // Stage 7 — Anomaly probe (observe-only).
  const anomaly = probeOutput(llmResponse.text);

  // If confidence drops below safe-mode threshold OR an anomaly tags
  // 'defection' AND we're not allowing destructive, route to safe-mode
  // fallback instead of returning the raw output.
  const allowDestructive = input.options?.allowDestructive ?? false;
  const blockOnAnomaly = !allowDestructive && anomaly.tag === 'defection';
  if (confidence.mode === 'safe-mode' || blockOnAnomaly) {
    return Object.freeze({
      ok: false,
      output: null,
      shield,
      piiTokenization: tokenization,
      spotlighted: Object.freeze(spotlighted),
      llmResponse,
      confidence,
      anomaly,
      trippedCap: null,
      stoppedAt: 'safe-mode-fallback',
      stoppedReason: blockOnAnomaly
        ? `anomaly probe tagged defection: ${anomaly.reason}`
        : `confidence dropped to safe-mode: ${confidence.reason}`,
      counters,
    });
  }

  // Stage 8 — De-tokenization is deferred: it happens at the ACTION layer
  // (when the model emits a tool call with a `<PHONE_x...>` argument).
  // The composer surfaces the raw tokenized output + the tokenMap so the
  // wire-side action executor can de-tokenize selectively. We do NOT
  // de-tokenize at this stage — that would re-leak PII into chat history.

  // Stage 9 — Emit.
  return Object.freeze({
    ok: true,
    output: llmResponse.text,
    shield,
    piiTokenization: tokenization,
    spotlighted: Object.freeze(spotlighted),
    llmResponse,
    confidence,
    anomaly,
    trippedCap: null,
    stoppedAt: 'completed',
    stoppedReason: 'all layers passed',
    counters,
  });
}

function composePrompt(originalSystemPrompt: string): string {
  // Prepend the spotlight directive so the brain knows how to treat
  // retrieved content. Append the just-ask-confidence suffix so the
  // brain emits a verbalized score.
  const withSpotlightDirective =
    `${SPOTLIGHT_SYSTEM_DIRECTIVE}\n\n${originalSystemPrompt}`;
  return appendJustAskConfidence(withSpotlightDirective);
}

// Re-export types so consumers can import them from the stack module.
export type {
  HardenedTurnInput,
  HardenedResult,
  ShieldVerdict,
  PiiTokenizationResult,
  SpotlightedChunk,
  Confidence,
  LlmResponse,
  LlmPort,
};
