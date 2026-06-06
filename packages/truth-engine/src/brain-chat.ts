/**
 * Brain-chat adapter (BossNyumba wiring)
 *
 * The truth-engine was ported from a sibling codebase whose `@/core/brain`
 * host module exposed a `brainChat(messages, systemPrompt, opts) => string`
 * helper plus separate OpenAI / DeepSeek services. BossNyumba standardizes on
 * Anthropic (Mr. Mwikila brain layer), so all three "voices" route through the
 * canonical `@bossnyumba/ai-copilot` Anthropic client.
 *
 * This module exposes the same `brainChat` surface the ported call sites
 * expect, implemented over `createAnthropicClient(...).sdk.messages.create`.
 * Text is extracted from the response the same way `generateStructured` does.
 *
 * The client is created lazily and memoised: the API key is read once on first
 * use. If `ANTHROPIC_API_KEY` is missing the call rejects, which every call
 * site already treats as a graceful "no signal" (try/catch -> null).
 */

import {
  createAnthropicClient,
  ModelTier,
  type AnthropicClient,
} from "@bossnyumba/ai-copilot";

export interface BrainChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface BrainChatOptions {
  /** Diagnostic task label (kept for parity; not forwarded to the SDK). */
  readonly taskName?: string;
  /** Reserved for prompt-cache parity; the client wraps caching internally. */
  readonly cacheSystemPrompt?: boolean;
  /** Optional model override (defaults to the client's default model). */
  readonly model?: string;
  /** Max completion tokens. Default 1024. */
  readonly maxTokens?: number;
  /** Sampling temperature. Default 0 (favour determinism for fact checks). */
  readonly temperature?: number;
}

let cachedClient: AnthropicClient | null = null;

function getAnthropicClient(): AnthropicClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("brainChat: ANTHROPIC_API_KEY not configured");
  }
  cachedClient = createAnthropicClient({
    apiKey,
    defaultModel: process.env.CLAUDE_MODEL_FAST ?? ModelTier.SONNET,
  });
  return cachedClient;
}

/**
 * Ask the BossNyumba brain (Anthropic) a single-turn or multi-turn question
 * and return the concatenated text response. Mirrors the ported
 * `@/core/brain` `brainChat` contract so call sites stay unchanged.
 */
export async function brainChat(
  messages: readonly BrainChatMessage[],
  systemPrompt?: string,
  options: BrainChatOptions = {},
): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.sdk.messages.create({
    model: options.model ?? client.defaultModel,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  if (!Array.isArray(response.content)) return "";
  return response.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("")
    .trim();
}
