/**
 * Brain chat adapter (Tier 3 translation fallback).
 *
 * Repoints the ported LitFin `@/core/brain` import that the NLLB service
 * dynamically loads for its highest-cost translation tier
 * (`const { brainChat } = await import("@/core/brain")`).
 *
 * BossNyumba has no `brainChat` entry point. It exposes lower-level
 * Anthropic surfaces — `createAnthropicSensor` in
 * `@bossnyumba/central-intelligence` and the `AnthropicClient` wrapper in
 * `@bossnyumba/ai-copilot` — but neither matches this
 * `(messages, systemPrompt, opts) -> Promise<string>` contract (task
 * naming, system-prompt caching, language routing). Adapting one would mean
 * inventing that mapping, so this stays a typed not-wired stub.
 *
 * The sole caller wraps `brainChat` in `try/catch` and returns `null` on
 * failure, so throwing here makes Tier 3 degrade gracefully: the cascade
 * falls back to its dictionary / rule-based / NLLB tiers.
 *
 * TODO(port): no BN equivalent — adapt `createAnthropicSensor`
 * (`@bossnyumba/central-intelligence`) or `AnthropicClient`
 * (`@bossnyumba/ai-copilot`) into a `brainChat`-shaped function.
 *
 * @module internal/brain
 */

/** A single chat message in a {@link brainChat} request. */
export interface BrainChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** Options accepted by {@link brainChat}. */
export interface BrainChatOptions {
  /** Logical task name for routing / telemetry. */
  readonly taskName?: string
  /** Whether the provider should cache the system prompt. */
  readonly cacheSystemPrompt?: boolean
  /** Target language hint for the completion. */
  readonly language?: 'en' | 'sw'
}

/**
 * Run a chat completion against the brain layer.
 *
 * Not yet wired to a BossNyumba provider — throws so the NLLB Tier 3 caller
 * falls back to lower tiers. See the module-level TODO(port).
 */
export async function brainChat(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contract preserved; implementation pending a BN brain adapter
  messages: readonly BrainChatMessage[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contract preserved; implementation pending a BN brain adapter
  systemPrompt?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contract preserved; implementation pending a BN brain adapter
  options?: BrainChatOptions,
): Promise<string> {
  throw new Error(
    'brainChat is not wired to a BossNyumba provider (TODO(port)): Tier 3 translation fallback is unavailable.',
  )
}
