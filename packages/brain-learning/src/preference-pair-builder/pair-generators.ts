/**
 * Pair generators — one per (reaction-kind → algorithm) rule.
 *
 * The 5 rules (mirror §2 R-LEARNING + N-E spec):
 *
 *   R1. thumbs_up                       → KTO scalar (positive)
 *   R2. thumbs_down                     → KTO scalar (negative)
 *   R3. regenerated_then_accepted       → DPO chosen=v2, rejected=v1
 *   R4. owner_pasted_own_version (edit) → DPO chosen=owner_version, rejected=brain_version
 *   R5. tool_fail → succeed             → PRM step-DPO
 *
 * Each generator is a pure function: feedback events + the source turn
 * content go in, zero-or-more PreferencePair come out. Quality scoring
 * (chosenQuality, rejectedPercentile) is a separate concern handled by
 * the quality-filter — these generators stamp placeholder values that
 * callers can refine.
 */

import type {
  FeedbackEvent,
  PreferencePair,
  TurnId,
} from '../types.js';
import { isPositiveReaction, isNegativeReaction } from '../owner-reaction-capture/reaction-kinds.js';

/**
 * Turn-content reader port — supplied by the wire-side adapter; usually
 * resolves redacted trace content.
 */
export interface TurnContentResolver {
  resolvePrompt(args: { tenantId: string; turnId: TurnId }): Promise<string>;
  resolveResponse(args: { tenantId: string; turnId: TurnId }): Promise<string>;
}

/**
 * Quality scorer port — usually plugged into M-G PRM substrate.
 */
export interface QualityScorer {
  scoreResponse(args: {
    tenantId: string;
    turnId: TurnId;
    response: string;
  }): Promise<number>;
}

export interface GeneratorDeps {
  readonly content: TurnContentResolver;
  readonly scorer: QualityScorer;
  readonly clock: () => Date;
}

/**
 * Rule 1+2 — thumbs_up / thumbs_down → KTO scalar.
 */
export async function generateKtoFromThumbs(
  deps: GeneratorDeps,
  feedback: FeedbackEvent,
): Promise<PreferencePair | null> {
  if (
    feedback.kind !== 'thumbs_up' &&
    feedback.kind !== 'thumbs_down'
  ) {
    return null;
  }
  const prompt = await deps.content.resolvePrompt({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const response = await deps.content.resolveResponse({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const quality = await deps.scorer.scoreResponse({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
    response,
  });
  const isPositive = isPositiveReaction(feedback.kind);
  return Object.freeze({
    tenantId: feedback.tenantId,
    sourceTurnId: feedback.turnId,
    algo: 'kto',
    prompt,
    chosen: isPositive ? response : '',
    rejected: isPositive ? '' : response,
    ktoLabel: isPositive ? 'good' : 'bad',
    chosenQuality: isPositive ? quality : 1 - quality,
    rejectedPercentile: isPositive ? 1 : 0.025,
    generatedAt: deps.clock().toISOString(),
  });
}

/**
 * Rule 3 — regenerated_then_accepted → DPO chosen=v2, rejected=v1.
 *
 * Requires TWO feedback events on the same turn: a `regenerated` event
 * (carries the new content) AND a subsequent `accepted_as_is` (or
 * thumbs_up on the regenerated turn). The wire-side caller is
 * responsible for pairing — this function takes the pair already
 * grouped.
 */
export async function generateDpoFromRegenerateThenAccept(
  deps: GeneratorDeps,
  args: {
    regenerated: FeedbackEvent;
    accepted: FeedbackEvent;
  },
): Promise<PreferencePair | null> {
  if (args.regenerated.kind !== 'regenerated') return null;
  if (
    args.accepted.kind !== 'accepted_as_is' &&
    args.accepted.kind !== 'thumbs_up'
  ) {
    return null;
  }
  if (args.regenerated.tenantId !== args.accepted.tenantId) return null;

  const payload = args.regenerated.payload;
  if (payload.kind !== 'regenerated') return null;

  const prompt = await deps.content.resolvePrompt({
    tenantId: args.regenerated.tenantId,
    turnId: args.regenerated.turnId,
  });
  const originalResponse = await deps.content.resolveResponse({
    tenantId: args.regenerated.tenantId,
    turnId: args.regenerated.turnId,
  });
  const chosenQuality = await deps.scorer.scoreResponse({
    tenantId: args.regenerated.tenantId,
    turnId: args.regenerated.turnId,
    response: payload.newContent,
  });
  return Object.freeze({
    tenantId: args.regenerated.tenantId,
    sourceTurnId: args.regenerated.turnId,
    algo: 'dpo',
    prompt,
    chosen: payload.newContent,
    rejected: originalResponse,
    chosenQuality,
    rejectedPercentile: 0.05, // by definition rejected is the worse one
    generatedAt: deps.clock().toISOString(),
  });
}

/**
 * Rule 4 — owner_pasted_own_version (edited_by_owner) → DPO highest-signal pair.
 */
export async function generateDpoFromOwnerEdit(
  deps: GeneratorDeps,
  feedback: FeedbackEvent,
): Promise<PreferencePair | null> {
  if (feedback.kind !== 'edited_by_owner') return null;
  const payload = feedback.payload;
  if (payload.kind !== 'edited_by_owner') return null;

  const prompt = await deps.content.resolvePrompt({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const brainVersion = await deps.content.resolveResponse({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const chosenQuality = await deps.scorer.scoreResponse({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
    response: payload.editedContent,
  });
  return Object.freeze({
    tenantId: feedback.tenantId,
    sourceTurnId: feedback.turnId,
    algo: 'dpo',
    prompt,
    chosen: payload.editedContent,
    rejected: brainVersion,
    chosenQuality,
    rejectedPercentile: 0.025,
    generatedAt: deps.clock().toISOString(),
  });
}

/**
 * Rule 5 — tool_fail → succeed → PRM step-DPO.
 *
 * The wire-side caller resolves which `tool_call` originally failed and
 * which retry succeeded; this function packages them as a step-level
 * pair. `prompt` is the parent turn's prompt; chosen/rejected are the
 * tool-call argument JSONs.
 */
export interface ToolFailThenSucceedInput {
  readonly tenantId: string;
  readonly sourceTurnId: TurnId;
  readonly prompt: string;
  readonly failedToolCallJson: string;
  readonly succeededToolCallJson: string;
}

export function generatePrmStepDpoFromToolRecovery(
  deps: GeneratorDeps,
  input: ToolFailThenSucceedInput,
): PreferencePair {
  return Object.freeze({
    tenantId: input.tenantId,
    sourceTurnId: input.sourceTurnId,
    algo: 'prm-step-dpo',
    prompt: input.prompt,
    chosen: input.succeededToolCallJson,
    rejected: input.failedToolCallJson,
    chosenQuality: 0.9, // tool success is high signal
    rejectedPercentile: 0.02,
    generatedAt: deps.clock().toISOString(),
  });
}

/**
 * Convenience: derive scalar KTO from a star_rating event.
 * Stars 1-2 → bad, 4-5 → good, 3 → drop.
 */
export async function generateKtoFromStarRating(
  deps: GeneratorDeps,
  feedback: FeedbackEvent,
): Promise<PreferencePair | null> {
  if (feedback.kind !== 'star_rating') return null;
  const payload = feedback.payload;
  if (payload.kind !== 'star_rating') return null;
  if (payload.stars === 3) return null;

  const prompt = await deps.content.resolvePrompt({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const response = await deps.content.resolveResponse({
    tenantId: feedback.tenantId,
    turnId: feedback.turnId,
  });
  const isPositive = payload.stars >= 4;
  const quality = payload.stars / 5;
  return Object.freeze({
    tenantId: feedback.tenantId,
    sourceTurnId: feedback.turnId,
    algo: 'kto',
    prompt,
    chosen: isPositive ? response : '',
    rejected: isPositive ? '' : response,
    ktoLabel: isPositive ? 'good' : 'bad',
    chosenQuality: isPositive ? quality : 1 - quality,
    rejectedPercentile: isPositive ? 1 : 0.025,
    generatedAt: deps.clock().toISOString(),
  });
}

// Re-export for clarity (used to gate rules 1+2 in the build orchestrator).
export { isPositiveReaction, isNegativeReaction };
