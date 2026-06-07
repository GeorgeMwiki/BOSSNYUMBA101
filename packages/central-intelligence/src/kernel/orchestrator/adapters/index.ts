/**
 * Orchestrator adapters — concrete bindings for the main-loop's two
 * required ports (`LLMRouter`, `Dispatcher`).
 *
 * These are the pieces the composition root needs to flip the kernel's
 * `think()` onto the Claude-Code-style main loop:
 *
 *   - `createAnthropicLLMRouter`  — `LLMRouter` over an Anthropic
 *                                   Messages client (preserves tool_use
 *                                   blocks → `Decision`).
 *   - `createRegistryDispatcher`  — `Dispatcher` over a seeded
 *                                   `BrainToolRegistry` (zod-gated,
 *                                   audited tool execution).
 *   - `decisionFromBlocks` /
 *     `decisionFromParts`         — pure, tested projection of an LLM
 *                                   turn onto a single `Decision`. Reused
 *                                   by any provider-specific adapter
 *                                   (e.g. the api-gateway's MultiLLMRouter
 *                                   adapter).
 *
 * Provider-agnostic by construction: central-intelligence depends on no
 * concrete LLM provider package. The Anthropic router takes the same
 * duck-typed client the kernel sensors already accept.
 */

export {
  createAnthropicLLMRouter,
  type AnthropicRouterClient,
  type AnthropicRouterMessage,
  type AnthropicRouterToolDef,
  type AnthropicRouterResponse,
  type AnthropicLLMRouterConfig,
} from './anthropic-llm-router.js';

export {
  createRegistryDispatcher,
  type RegistryDispatcherConfig,
} from './registry-dispatcher.js';

export {
  decisionFromBlocks,
  decisionFromParts,
  type LLMContentBlock,
  type ExtractedToolCall,
} from './decision-from-blocks.js';
