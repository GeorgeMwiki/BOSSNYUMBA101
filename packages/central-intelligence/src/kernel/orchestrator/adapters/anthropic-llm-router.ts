/**
 * Anthropic-SDK `LLMRouter` adapter — binds the orchestrator's
 * provider-agnostic `LLMRouter` port to the same `AnthropicMessagesClient`
 * duck-type the kernel sensors already consume.
 *
 * The orchestrator main loop calls `router.call({ system, tools, messages })`
 * once per tick and expects a `Decision` back. This adapter:
 *
 *   1. Maps the orchestrator's `ToolDescriptor[]` onto Anthropic tool
 *      definitions (name + description + a permissive object schema, since
 *      `ToolDescriptor` carries no JSON schema — the dispatcher's per-tool
 *      zod gate is the real input contract).
 *   2. Collapses the orchestrator's four-role message stream
 *      (`user | assistant | tool | system`) onto Anthropic's two-role
 *      surface: `assistant` stays, everything else folds to `user` with a
 *      role-prefix so the model still sees who said what. (`system` lines
 *      are also concatenated into the system prompt.)
 *   3. Sends a single-shot `messages.create` and projects the returned
 *      content blocks onto a `Decision` via the shared, tested
 *      `decisionFromBlocks` helper.
 *
 * Degradation: any SDK error is caught and surfaced as a terminal
 * `respond_to_owner` Decision describing the failure, so the main loop
 * closes the turn gracefully instead of throwing. The kernel's own
 * `runViaOrchestrator` wrapper ALSO catches — this is defence in depth.
 */

import type { Decision } from '../decision.js';
import type { LLMRouter, LLMRouterCall } from '../main-loop.js';
import { decisionFromBlocks, type LLMContentBlock } from './decision-from-blocks.js';

// ─────────────────────────────────────────────────────────────────────
// Minimal duck-typed Anthropic Messages client — mirrors
// `sensors/anthropic-sensor.ts:AnthropicMessagesClient` but kept local so
// this adapter does not import the sensor module's heavier surface. Only
// the fields the router needs are declared.
// ─────────────────────────────────────────────────────────────────────

export interface AnthropicRouterMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AnthropicRouterToolDef {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface AnthropicRouterResponse {
  readonly content?: ReadonlyArray<LLMContentBlock>;
}

export interface AnthropicRouterClient {
  readonly messages: {
    create(args: {
      readonly model: string;
      readonly max_tokens: number;
      readonly system?: string;
      readonly messages: ReadonlyArray<AnthropicRouterMessage>;
      readonly tools?: ReadonlyArray<AnthropicRouterToolDef>;
    }): Promise<AnthropicRouterResponse>;
  };
}

export interface AnthropicLLMRouterConfig {
  /** Model id the orchestrator calls each tick (e.g. Sonnet). */
  readonly modelId: string;
  /** Max output tokens per turn. Default 2048. */
  readonly maxTokens?: number;
  /** Optional structured logger for SDK failures. */
  readonly logger?: {
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
}

const DEFAULT_MAX_TOKENS = 2048;

/**
 * Permissive tool schema. `ToolDescriptor` does not carry a JSON schema,
 * so we advertise a free-form object and rely on the dispatcher's
 * per-tool zod gate to reject malformed input. `additionalProperties`
 * is left open so the model can pass whatever the tool's real schema
 * expects.
 */
const PERMISSIVE_TOOL_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: 'object',
  additionalProperties: true,
});

/**
 * Fold the orchestrator's four-role message stream onto Anthropic's
 * two-role surface. `assistant` is preserved; `user`, `tool`, and
 * `system` all map to `user`, with a `[role]` prefix for the non-user
 * cases so the model retains the provenance of each line.
 */
function toAnthropicMessages(
  messages: LLMRouterCall['messages'],
): ReadonlyArray<AnthropicRouterMessage> {
  const out: AnthropicRouterMessage[] = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      out.push({ role: 'assistant', content: m.content });
      continue;
    }
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
      continue;
    }
    // `tool` / `system` lines fold to user with a provenance prefix.
    out.push({ role: 'user', content: `[${m.role}] ${m.content}` });
  }
  // Anthropic requires a non-empty messages array; seed a placeholder
  // user turn when the loop produced none (first tick on an empty
  // transcript).
  if (out.length === 0) {
    out.push({ role: 'user', content: 'Continue.' });
  }
  return out;
}

/**
 * Concatenate any `system`-role lines into the system prompt so the
 * model still sees them as instructions rather than buried user turns.
 */
function assembleSystemPrompt(call: LLMRouterCall): string {
  const systemLines = call.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content);
  if (systemLines.length === 0) return call.system;
  return [call.system, ...systemLines].join('\n');
}

function toAnthropicTools(
  tools: LLMRouterCall['tools'],
): ReadonlyArray<AnthropicRouterToolDef> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: PERMISSIVE_TOOL_SCHEMA as Record<string, unknown>,
  }));
}

/**
 * Build an `LLMRouter` backed by an Anthropic Messages client. The same
 * client the kernel sensors use can be passed straight in.
 */
export function createAnthropicLLMRouter(
  client: AnthropicRouterClient,
  config: AnthropicLLMRouterConfig,
): LLMRouter {
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  return {
    async call(call: LLMRouterCall): Promise<Decision> {
      try {
        const tools = toAnthropicTools(call.tools);
        const response = await client.messages.create({
          model: config.modelId,
          max_tokens: maxTokens,
          system: assembleSystemPrompt(call),
          messages: toAnthropicMessages(call.messages),
          ...(tools.length > 0 ? { tools } : {}),
        });
        return decisionFromBlocks(response.content ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        config.logger?.warn('anthropic-llm-router: messages.create failed', {
          model: config.modelId,
          reason: message,
        });
        // Terminal, graceful close — never throw out of the router.
        return {
          kind: 'respond_to_owner',
          text: 'I could not complete that request because the language model call failed.',
        };
      }
    },
  };
}
