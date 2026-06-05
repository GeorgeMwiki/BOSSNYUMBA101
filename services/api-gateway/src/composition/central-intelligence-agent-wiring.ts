/**
 * Central Intelligence agent wiring.
 *
 * Builds a REAL `CentralIntelligenceAgent` for the `/api/v1/intelligence`
 * streaming router (`routes/intelligence.hono.ts`). Previously the agent
 * slot was hard-null in both the degraded and live composition paths
 * ("adapter not shipped in-tree"), so every agent-turn returned
 * `503 INTELLIGENCE_SERVICE_UNAVAILABLE`. The in-tree agent loop
 * (`createCentralIntelligenceAgent` in `@bossnyumba/central-intelligence`)
 * was already complete — the only missing piece was an `LlmAdapter`.
 *
 * This module supplies that adapter, backed by the SAME per-tenant
 * budget-guarded Anthropic client the brain-kernel + brain routes use, so
 * every Ask turn routes through `CostLedger.assertWithinBudget` before any
 * provider call (cost control preserved) and records usage afterwards.
 *
 * Per-tenant billing: the route fetches a composition-time SINGLETON agent
 * but calls `agent.run({ ctx })` with the per-request `ScopeContext`. We
 * therefore expose a thin scope-routing agent whose `run(req)` derives the
 * billing tenant id from `req.ctx` (the real `tenantId` for tenant scope, a
 * stable `_platform` id for platform scope) and delegates to a per-scope real
 * agent. This keeps cost attribution correct without per-request wiring at
 * the composition root.
 *
 * The LLM adapter is intentionally thin: the budget-guarded `sdk` exposes only
 * `messages.create` (single-shot), so we issue one completion per agent-loop
 * iteration and map the response blocks onto the agent loop's
 * provider-agnostic `LlmStreamChunk` stream (text → `text_delta`, then a
 * terminal `stop`). The agent loop owns the outer tool-use iteration; with no
 * tools registered it resolves in a single iteration and emits a real answer.
 *
 * Auth, kill-switch, scope-gating, thread/memory, and the hash-chained audit
 * recorder all remain owned by the route + the existing live-mode wiring —
 * this module only fills the agent slot so the turn stops 503ing.
 */

import {
  createCentralIntelligenceAgent,
  createToolRegistry,
  createDefaultVoiceResolver,
  type AgentEventStream,
  type AgentRunRequest,
  type CentralIntelligenceAgent,
  type ConversationMemory,
  type ConversationAuditRecorder,
  type LlmAdapter,
  type LlmMessage,
  type LlmStreamChunk,
  type ScopeContext,
} from '@bossnyumba/central-intelligence';
import { getModelLatest } from '@bossnyumba/brain-llm-router/dynamic-registry';
import type { BudgetGuardedAnthropicClient } from '@bossnyumba/ai-copilot/providers';

/**
 * Per-tenant budget-guarded Anthropic client factory, as exposed by the
 * service registry (`buildBudgetGuardedAnthropicClient(tenantId, operation?)`).
 */
export type BudgetGuardedAnthropicFactory = (
  tenantId: string,
  operation?: string,
) => BudgetGuardedAnthropicClient;

const CI_OPERATION_TAG = 'central-intelligence.ask';

/** Hard cap on output tokens per completion — generous for a chat answer. */
const CI_MAX_TOKENS = 4096;

/**
 * Stable billing id for platform-scope turns. Platform `ScopeContext` carries
 * no `tenantId`, so usage is attributed to this synthetic tenant — the same
 * convention the brain-kernel bootstrap uses for the `_platform` ledger row.
 */
const PLATFORM_BILLING_TENANT_ID = '_platform';

/**
 * Derive the budget-ledger tenant id for a scope. Tenant scope bills the real
 * tenant; platform scope bills the synthetic `_platform` tenant.
 */
function billingTenantId(ctx: ScopeContext): string {
  return ctx.kind === 'tenant' ? ctx.tenantId : PLATFORM_BILLING_TENANT_ID;
}

/**
 * Map the agent loop's `LlmMessage[]` onto the Anthropic Messages request
 * shape (which only accepts `user` / `assistant`). `system` messages are
 * lifted out separately by the adapter; `tool_result` messages are folded
 * into a `user` turn so a tool-using loop still degrades gracefully (the
 * default tool registry is empty, so this path is rarely exercised).
 */
function toAnthropicMessages(
  messages: ReadonlyArray<LlmMessage>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') continue; // carried via the request `system` field
    const role: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';
    out.push({ role, content: m.content });
  }
  return out;
}

/**
 * Build an `LlmAdapter` over a per-tenant budget-guarded Anthropic client.
 *
 * The client is resolved lazily for the supplied tenant so every call passes
 * through `CostLedger.assertWithinBudget(tenantId)`. Streaming is emulated:
 * we issue a single-shot `messages.create` and yield its accumulated text as
 * one `text_delta` followed by a terminal `stop`. This satisfies the agent
 * loop's contract without requiring the SDK's streaming surface (which the
 * budget guard does not wrap).
 */
export function createCentralIntelligenceLlmAdapter(args: {
  readonly buildClient: BudgetGuardedAnthropicFactory;
  readonly billingTenantId: string;
  readonly modelId?: string;
}): LlmAdapter {
  const modelId = args.modelId ?? getModelLatest('sonnet');

  return {
    modelId,
    async *stream(streamArgs: {
      readonly system: string;
      readonly messages: ReadonlyArray<LlmMessage>;
      readonly tools: ReadonlyArray<unknown>;
      readonly extendedThinking: boolean;
    }): AsyncIterable<LlmStreamChunk> {
      // Resolve the budget-guarded client for THIS billing tenant on every
      // turn so the guard's `context()` closes over the right tenant id.
      const client = args.buildClient(args.billingTenantId, CI_OPERATION_TAG);
      const response = await client.sdk.messages.create({
        model: modelId,
        max_tokens: CI_MAX_TOKENS,
        system: streamArgs.system,
        messages: toAnthropicMessages(streamArgs.messages),
      });

      const text = Array.isArray(response.content)
        ? response.content
            .filter((b) => b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text as string)
            .join('')
        : '';

      if (text.length > 0) {
        yield { kind: 'text_delta', text };
      }
      yield { kind: 'stop', stopReason: 'end_turn' };
    },
  };
}

/**
 * Build a real per-scope `CentralIntelligenceAgent`, reusing the live-mode
 * `memory` + hash-chained `audit` recorder the service registry already
 * constructs. The LLM adapter bills the supplied scope's tenant.
 */
function buildScopedAgent(args: {
  readonly buildClient: BudgetGuardedAnthropicFactory;
  readonly memory: ConversationMemory;
  readonly audit?: ConversationAuditRecorder;
  readonly ctx: ScopeContext;
}): CentralIntelligenceAgent {
  const llm = createCentralIntelligenceLlmAdapter({
    buildClient: args.buildClient,
    billingTenantId: billingTenantId(args.ctx),
  });

  return createCentralIntelligenceAgent({
    llm,
    tools: createToolRegistry(),
    memory: args.memory,
    voice: createDefaultVoiceResolver(),
    audit: args.audit,
  });
}

/**
 * Assemble the composition-time SINGLETON `CentralIntelligenceAgent` for the
 * `/intelligence` route.
 *
 * Returns `null` when no budget-guarded Anthropic factory is available
 * (no `ANTHROPIC_API_KEY`), so the route keeps returning a clean
 * `503 INTELLIGENCE_SERVICE_UNAVAILABLE` rather than a hard failure.
 *
 * When available, returns a scope-routing agent: each `run(req)` rebuilds the
 * underlying real agent bound to `req.ctx`'s billing tenant, then delegates.
 * Construction is cheap (pure factory composition; the Anthropic client is
 * only built when the LLM adapter actually streams), so per-turn rebuilds add
 * negligible overhead while keeping cost attribution correct.
 */
export function wireCentralIntelligenceAgent(args: {
  readonly buildClient: BudgetGuardedAnthropicFactory | null;
  readonly memory: ConversationMemory;
  readonly audit?: ConversationAuditRecorder;
}): CentralIntelligenceAgent | null {
  const buildClient = args.buildClient;
  if (!buildClient) return null;

  return {
    run(req: AgentRunRequest): AgentEventStream {
      const scoped = buildScopedAgent({
        buildClient,
        memory: args.memory,
        audit: args.audit,
        ctx: req.ctx,
      });
      return scoped.run(req);
    },
  };
}
