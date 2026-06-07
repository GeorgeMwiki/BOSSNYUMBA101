/**
 * Decision-from-blocks — pure, provider-agnostic projection of an LLM
 * turn's content blocks onto the orchestrator's `Decision` ADT.
 *
 * Every concrete `LLMRouter` adapter (Anthropic SDK, MultiLLMRouter,
 * OpenAI, …) produces the same two-shape surface per turn:
 *
 *   - zero-or-more `text` blocks → the natural-language reply
 *   - zero-or-more `tool_use` blocks → tools the model wants run
 *
 * The orchestrator main loop consumes ONE `Decision` per tick. This
 * helper applies the Claude-Code resolution rule:
 *
 *   1. If the turn carries at least one tool_use block, return the FIRST
 *      as a `tool_call` Decision (the main loop dispatches it, folds the
 *      result back, and re-calls the router for the next block — exactly
 *      how Claude Code serialises a multi-tool turn).
 *   2. Otherwise return a `respond_to_owner` Decision carrying the
 *      concatenated text (empty string when the model emitted nothing —
 *      the loop treats an empty answer as a terminal turn rather than
 *      spinning).
 *
 * Pure: no I/O, no clock, no mutation. Same blocks in → same Decision
 * out. This keeps every router adapter's mapping logic in one tested
 * place instead of duplicated per provider.
 */

import type { Decision, DecisionToolCall } from '../decision.js';

/**
 * Minimal block shape both the Anthropic SDK and the MultiLLMRouter
 * `rawContent` surface satisfy. We read only the fields the Decision
 * projection needs; provider-specific extras are ignored.
 */
export interface LLMContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
}

/**
 * Already-extracted tool call, for adapters whose provider surfaces a
 * dedicated `toolCalls` array (e.g. `AICompletionResponse.toolCalls`)
 * rather than raw blocks.
 */
export interface ExtractedToolCall {
  readonly id?: string;
  readonly name: string;
  readonly input?: unknown;
}

/**
 * Coerce an arbitrary tool-input value into the `Record<string, unknown>`
 * the `DecisionToolCall.input` contract requires. Non-object inputs
 * (string, number, null) are wrapped under a `value` key so the
 * dispatcher's zod gate still receives an object to validate.
 */
function coerceToolInput(input: unknown): Readonly<Record<string, unknown>> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (input === undefined) return {};
  return { value: input };
}

/**
 * Build a `tool_call` Decision from an extracted tool call. `callId`
 * falls back to a positional id when the provider omitted one.
 */
function toToolCallDecision(
  call: ExtractedToolCall,
  index: number,
): Decision {
  const toolCall: DecisionToolCall = {
    toolName: call.name,
    input: coerceToolInput(call.input),
    callId: call.id && call.id.length > 0 ? call.id : `tu_${index}`,
  };
  return { kind: 'tool_call', call: toolCall };
}

/**
 * Project a turn's text + extracted tool calls onto a single Decision.
 * The first tool call wins; otherwise the concatenated text becomes a
 * `respond_to_owner`.
 */
export function decisionFromParts(args: {
  readonly text: string;
  readonly toolCalls: ReadonlyArray<ExtractedToolCall>;
}): Decision {
  const firstTool = args.toolCalls[0];
  if (firstTool) {
    return toToolCallDecision(firstTool, 0);
  }
  return { kind: 'respond_to_owner', text: args.text };
}

/**
 * Project raw provider content blocks onto a single Decision. Splits
 * the blocks into text + tool_use, then delegates to `decisionFromParts`.
 */
export function decisionFromBlocks(
  blocks: ReadonlyArray<LLMContentBlock>,
): Decision {
  let text = '';
  const toolCalls: ExtractedToolCall[] = [];
  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      text += block.text;
    } else if (block.type === 'tool_use' && typeof block.name === 'string') {
      toolCalls.push({
        name: block.name,
        ...(block.id !== undefined ? { id: block.id } : {}),
        input: block.input,
      });
    }
  }
  return decisionFromParts({ text, toolCalls });
}
