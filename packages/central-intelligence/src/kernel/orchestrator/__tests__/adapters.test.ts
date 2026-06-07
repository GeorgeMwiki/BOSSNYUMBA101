/**
 * Phase F.3 — orchestrator adapter tests.
 *
 * Proves the two concrete ports that make the main-loop LIVE in
 * production actually work, plus the pure Decision projection they share:
 *
 *   - `decisionFromBlocks` / `decisionFromParts` — LLM turn → Decision.
 *   - `createRegistryDispatcher` — actuates a Decision through the SAME
 *     disciplined `BrainToolRegistry` the legacy pipeline uses (zod input
 *     gate + audit-sink row), and maps every Decision variant onto a
 *     DispatchResult. End-to-end: a real tool runs and returns its output.
 *   - `createAnthropicLLMRouter` — maps an Anthropic Messages turn onto a
 *     Decision (tool_use → tool_call; text → respond_to_owner) and
 *     degrades gracefully (never throws) when the SDK call fails.
 *   - LIVE main-loop tool-calling — with a POPULATED `ToolSearch` built
 *     from the SAME seeded `BrainToolRegistry` the dispatcher actuates,
 *     the orchestrator main-loop DISCOVERS a registered tool (it reaches
 *     the router's `call.tools`) and the registry-dispatcher EXECUTES it
 *     end-to-end (tool_call Decision → `registry.runTool` → tool_ok),
 *     distinct from a pure text turn. This is the capability the
 *     api-gateway `brain-kernel-wiring` enables by threading a populated
 *     `toolSearch` into `composeSovereign({ orchestrator })` instead of
 *     the kernel's EMPTY `createInMemoryToolSearch([])` default.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createBrainToolRegistry,
  createInMemoryBrainToolAuditSink,
  registerSeedBrainTools,
  type BrainToolRegistry,
  type BrainToolSpec,
} from '../../tool-spec.js';
import {
  decisionFromBlocks,
  decisionFromParts,
} from '../adapters/decision-from-blocks.js';
import { createRegistryDispatcher } from '../adapters/registry-dispatcher.js';
import {
  createAnthropicLLMRouter,
  type AnthropicRouterClient,
} from '../adapters/anthropic-llm-router.js';
import { think, type LLMRouter, type LLMRouterCall } from '../main-loop.js';
import {
  createInMemoryToolSearch,
  type ToolDescriptor,
} from '../context-budget.js';
import { createHookChain } from '../hook-chain.js';
import { createInMemoryPlanStore } from '../plan.js';
import { createInMemorySessionStore } from '../checkpoint.js';
import { createContextBudget } from '../context-budget.js';
import { createInMemoryMemoryTool } from '../memory-tool.js';
import type { Decision } from '../decision.js';
import type { HookContext } from '../hook-chain.js';
import type { ScopeContext } from '../../../types.js';

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

const SCOPE: ScopeContext = {
  kind: 'tenant',
  tenantId: 't_alpha',
  actorUserId: 'u_demo',
  roles: ['estate-manager'],
  personaId: 'estate-manager-head',
};

const CTX: HookContext = {
  threadId: 'th-1',
  scope: SCOPE,
  tier: 'property',
  userMessage: 'hello',
  tickStartedAt: 0,
};

/** Registry with one echo tool that enforces a zod input schema. */
function makeRegistry(): {
  registry: BrainToolRegistry;
  sink: ReturnType<typeof createInMemoryBrainToolAuditSink>;
} {
  const sink = createInMemoryBrainToolAuditSink();
  const registry = createBrainToolRegistry({ auditSink: sink });
  registry.register<{ value: string }, { echoed: string }>({
    name: 'echo',
    description: 'echo the value back',
    schemaIn: z.object({ value: z.string().min(1) }),
    schemaOut: z.object({ echoed: z.string() }),
    tier: 'free',
    requiresApproval: false,
    executor: async (input) => ({ echoed: input.value }),
  });
  return { registry, sink };
}

// ─────────────────────────────────────────────────────────────────────
// decisionFromBlocks / decisionFromParts
// ─────────────────────────────────────────────────────────────────────

describe('decisionFromParts / decisionFromBlocks', () => {
  it('projects a text-only turn onto respond_to_owner', () => {
    const d = decisionFromParts({ text: 'all balanced', toolCalls: [] });
    expect(d.kind).toBe('respond_to_owner');
    if (d.kind === 'respond_to_owner') expect(d.text).toBe('all balanced');
  });

  it('projects the FIRST tool_use block onto a tool_call', () => {
    const d = decisionFromBlocks([
      { type: 'text', text: 'let me check' },
      { type: 'tool_use', id: 'tu_x', name: 'echo', input: { value: 'hi' } },
      { type: 'tool_use', id: 'tu_y', name: 'other', input: {} },
    ]);
    expect(d.kind).toBe('tool_call');
    if (d.kind === 'tool_call') {
      expect(d.call.toolName).toBe('echo');
      expect(d.call.callId).toBe('tu_x');
      expect(d.call.input).toEqual({ value: 'hi' });
    }
  });

  it('wraps a non-object tool input under a `value` key', () => {
    const d = decisionFromParts({
      text: '',
      toolCalls: [{ name: 'echo', input: 'raw-string' }],
    });
    expect(d.kind).toBe('tool_call');
    if (d.kind === 'tool_call') {
      expect(d.call.input).toEqual({ value: 'raw-string' });
      // Positional fallback callId when the provider omits one.
      expect(d.call.callId).toBe('tu_0');
    }
  });

  it('returns an empty respond_to_owner when the turn is empty', () => {
    const d = decisionFromBlocks([]);
    expect(d.kind).toBe('respond_to_owner');
    if (d.kind === 'respond_to_owner') expect(d.text).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────
// createRegistryDispatcher
// ─────────────────────────────────────────────────────────────────────

describe('createRegistryDispatcher', () => {
  it('executes a BrainTool end-to-end and returns tool_ok with the output', async () => {
    const { registry, sink } = makeRegistry();
    const dispatcher = createRegistryDispatcher(registry);
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: { toolName: 'echo', input: { value: 'hi' }, callId: 'c1' },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      expect(result.callId).toBe('c1');
      expect(result.output).toEqual({ echoed: 'hi' });
    }
    // Disciplined gate proof: the registry laid down an audit row for the
    // successful deterministic call (the same audit trail the legacy
    // pipeline relies on).
    const rows = sink.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('echo');
    expect(rows[0]?.outcome).toBe('ok');
  });

  it('surfaces a zod input-gate failure as tool_error (gate NOT bypassed)', async () => {
    const { registry, sink } = makeRegistry();
    const dispatcher = createRegistryDispatcher(registry);
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        // `value` must be a non-empty string — empty string trips the gate.
        call: { toolName: 'echo', input: { value: '' }, callId: 'c2' },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_error');
    if (result.kind === 'tool_error') {
      expect(result.callId).toBe('c2');
      expect(result.message).toContain('input-invalid');
    }
    // The audit sink recorded the rejection (input-invalid), proving the
    // zod gate ran rather than the executor.
    expect(sink.rows()[0]?.outcome).toBe('input-invalid');
  });

  it('returns tool_error for an unknown tool', async () => {
    const { registry } = makeRegistry();
    const dispatcher = createRegistryDispatcher(registry);
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: { toolName: 'nope', input: {}, callId: 'c3' },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_error');
    if (result.kind === 'tool_error') {
      expect(result.message).toContain('tool not found');
    }
  });

  it('maps respond_to_owner / final onto a terminal response result', async () => {
    const { registry } = makeRegistry();
    const dispatcher = createRegistryDispatcher(registry);
    const respond = await dispatcher.dispatch(
      { kind: 'respond_to_owner', text: 'done' },
      CTX,
    );
    expect(respond.kind).toBe('response');
    if (respond.kind === 'response') expect(respond.text).toBe('done');
    const final = await dispatcher.dispatch(
      { kind: 'final', text: 'closed' },
      CTX,
    );
    expect(final.kind).toBe('response');
    if (final.kind === 'response') expect(final.text).toBe('closed');
  });

  it('acks schedule_wake, monitor, and spawn_sub_md decisions', async () => {
    const { registry } = makeRegistry();
    const dispatcher = createRegistryDispatcher(registry);

    const wake = await dispatcher.dispatch(
      {
        kind: 'schedule_wake',
        wake: { wakeAt: '2026-06-08T00:00:00Z', reason: 'follow-up' },
      },
      CTX,
    );
    expect(wake.kind).toBe('wake_ack');

    const monitor = await dispatcher.dispatch(
      {
        kind: 'monitor',
        watch: { watchId: 'w1', predicate: 'rent.paid', timeoutMs: 1000 },
      },
      CTX,
    );
    expect(monitor.kind).toBe('monitor_ack');
    if (monitor.kind === 'monitor_ack') expect(monitor.watchId).toBe('w1');

    const spawn = await dispatcher.dispatch(
      {
        kind: 'spawn_sub_md',
        spawn: {
          subMdId: 'sub-1',
          scope: SCOPE,
          initialInput: {},
          fireAndForget: true,
        },
      },
      CTX,
    );
    expect(spawn.kind).toBe('spawn_ack');
    if (spawn.kind === 'spawn_ack') {
      expect(spawn.subMdId).toBe('sub-1');
      expect(spawn.background).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// createAnthropicLLMRouter
// ─────────────────────────────────────────────────────────────────────

describe('createAnthropicLLMRouter', () => {
  it('maps a tool_use turn onto a tool_call Decision and forwards tools', async () => {
    let seenTools: ReadonlyArray<{ name: string }> | undefined;
    let seenSystem: string | undefined;
    const client: AnthropicRouterClient = {
      messages: {
        async create(args) {
          seenTools = args.tools;
          seenSystem = args.system;
          return {
            content: [
              { type: 'text', text: 'looking it up' },
              {
                type: 'tool_use',
                id: 'tu_1',
                name: 'echo',
                input: { value: 'x' },
              },
            ],
          };
        },
      },
    };
    const router = createAnthropicLLMRouter(client, { modelId: 'test-model' });
    const decision = await router.call({
      system: 'be helpful',
      tools: [{ name: 'echo', description: 'echo', keywords: ['echo'] }],
      messages: [{ role: 'user', content: 'echo x' }],
    });
    expect(decision.kind).toBe('tool_call');
    if (decision.kind === 'tool_call') {
      expect(decision.call.toolName).toBe('echo');
    }
    expect(seenTools?.[0]?.name).toBe('echo');
    expect(seenSystem).toContain('be helpful');
  });

  it('maps a text-only turn onto respond_to_owner', async () => {
    const client: AnthropicRouterClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: 'balanced' }] };
        },
      },
    };
    const router = createAnthropicLLMRouter(client, { modelId: 'm' });
    const decision = await router.call({
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: 'status?' }],
    });
    expect(decision.kind).toBe('respond_to_owner');
    if (decision.kind === 'respond_to_owner') {
      expect(decision.text).toBe('balanced');
    }
  });

  it('degrades gracefully (terminal respond_to_owner, no throw) on SDK failure', async () => {
    const client: AnthropicRouterClient = {
      messages: {
        async create() {
          throw new Error('upstream 529 overloaded');
        },
      },
    };
    const router = createAnthropicLLMRouter(client, { modelId: 'm' });
    const decision = await router.call({
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: 'hi' }],
    });
    // Never throws — surfaces a terminal Decision the main loop can close.
    expect(decision.kind).toBe('respond_to_owner');
  });

  it('seeds a placeholder user turn when the message stream is empty', async () => {
    let seenMessages: ReadonlyArray<{ role: string; content: string }> = [];
    const client: AnthropicRouterClient = {
      messages: {
        async create(args) {
          seenMessages = args.messages;
          return { content: [{ type: 'text', text: 'ok' }] };
        },
      },
    };
    const router = createAnthropicLLMRouter(client, { modelId: 'm' });
    await router.call({ system: 's', tools: [], messages: [] });
    // Anthropic requires a non-empty messages array.
    expect(seenMessages.length).toBeGreaterThan(0);
    expect(seenMessages[0]?.role).toBe('user');
  });
});

// ─────────────────────────────────────────────────────────────────────
// LIVE main-loop tool-calling — populated ToolSearch + registry dispatcher.
//
// This is the residual the api-gateway `brain-kernel-wiring` closes: the
// kernel's default `createInMemoryToolSearch([])` is EMPTY, so the live
// orchestrator could only emit text. With a ToolSearch populated from the
// SAME seeded `BrainToolRegistry` the dispatcher actuates, the main-loop's
// per-tick `searchRelevant(...)` surfaces the tool to the model and the
// dispatcher executes it end-to-end. The descriptor mapping below mirrors
// `buildToolDescriptorsFromRegistry` in the wiring file (name + description
// + name/arg-derived keywords).
// ─────────────────────────────────────────────────────────────────────

/**
 * Replica of the wiring's name tokeniser — splits camelCase / dotted tool
 * names into >2-char lowercase tokens so the overlap ranker can match a
 * natural-language goal against the tool's own vocabulary.
 */
function tokeniseToolName(name: string): ReadonlyArray<string> {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2);
}

/** Replica of the wiring's zod top-level field-name extractor. */
function extractSchemaFieldNames(schema: unknown): ReadonlyArray<string> {
  try {
    const def = (schema as { _def?: { shape?: unknown } })?._def;
    const shape =
      typeof def?.shape === 'function'
        ? (def.shape as () => Record<string, unknown>)()
        : (def?.shape as Record<string, unknown> | undefined);
    if (!shape || typeof shape !== 'object') return [];
    return Object.keys(shape).filter((k) => k.length > 0);
  } catch {
    return [];
  }
}

/** Replica of the wiring's BrainToolSpec[] → ToolDescriptor[] mapping. */
function descriptorsFromRegistry(
  registry: BrainToolRegistry,
): ReadonlyArray<ToolDescriptor> {
  return registry.list().map((spec: BrainToolSpec) => {
    const fieldNames = extractSchemaFieldNames(spec.schemaIn);
    const keywords = Array.from(
      new Set([...tokeniseToolName(spec.name), ...fieldNames]),
    );
    return {
      name: spec.name,
      description: spec.description,
      keywords,
      ...(fieldNames.length > 0 ? { sampleArgs: fieldNames } : {}),
    };
  });
}

/** Seed registry deps — deterministic stubs for the two DB-backed tools. */
function makeSeededRegistry(): {
  registry: BrainToolRegistry;
  sink: ReturnType<typeof createInMemoryBrainToolAuditSink>;
} {
  const sink = createInMemoryBrainToolAuditSink();
  const registry = createBrainToolRegistry({ auditSink: sink });
  registerSeedBrainTools(registry, {
    lookupTenantArrears: async (input) => ({
      tenantProfileId: input.tenantProfileId,
      arrearsAmount: 1250,
      currency: 'TZS',
      monthsOverdue: 2,
      asOfDate: input.asOfDate ?? '2026-06-07',
    }),
    checkComplianceCertificate: async (input) => ({
      certificateId: input.certificateId,
      jurisdiction: input.jurisdiction,
      status: 'valid' as const,
      issuedAt: '2026-01-01',
      expiresAt: '2027-01-01',
      daysUntilExpiry: 208,
    }),
    getMarketRateBand: async (input) => ({
      bedrooms: input.bedrooms,
      unitType: input.unitType,
      currency: 'TZS',
      p25: 400,
      median: 500,
      p75: 600,
      sampleSize: 42,
    }),
  });
  return { registry, sink };
}

describe('LIVE main-loop tool-calling (populated ToolSearch + dispatcher)', () => {
  it('discovers a seeded BrainTool and executes it end-to-end via the registry', async () => {
    const { registry, sink } = makeSeededRegistry();

    // The populated ToolSearch + the REAL registry dispatcher — exactly
    // what the wiring threads into composeSovereign({ orchestrator }).
    const toolSearch = createInMemoryToolSearch(descriptorsFromRegistry(registry));
    const dispatcher = createRegistryDispatcher(registry);

    // Capture every `tools` payload the loop hands the router so we can
    // assert the tool was actually DISCOVERED (not just executable).
    const toolsSeenPerTick: Array<ReadonlyArray<string>> = [];
    let tick = 0;
    const router: LLMRouter = {
      async call(call: LLMRouterCall): Promise<Decision> {
        toolsSeenPerTick.push(call.tools.map((t) => t.name));
        tick += 1;
        // Tick 1: call the discovered seed tool. Tick 2: close the turn.
        if (tick === 1) {
          return {
            kind: 'tool_call',
            call: {
              toolName: 'lookupTenantArrears',
              input: { tenantProfileId: 'tp_1' },
              callId: 'c_arrears',
            },
          };
        }
        return { kind: 'respond_to_owner', text: 'Arrears are TZS 1,250.' };
      },
    };

    const deps = {
      router,
      toolSearch,
      hookChain: createHookChain([]),
      planStore: createInMemoryPlanStore(),
      sessionStore: createInMemorySessionStore(),
      memoryTool: createInMemoryMemoryTool(),
      contextBudget: createContextBudget(),
      dispatcher,
    };

    const out = await think(
      {
        threadId: 'th_arrears',
        // Goal vocabulary overlaps the tool name tokens (lookup/tenant/
        // arrears) so the keyword ranker surfaces it.
        userMessage: 'Look up the tenant arrears for this profile.',
        scope: {
          kind: 'tenant',
          tenantId: 't_1',
          actorUserId: 'u_1',
          roles: ['owner'],
          personaId: 'p_1',
        },
        tier: 'tenant',
        persona: 'arrears-advisor',
        budget: { maxTurns: 5 },
      },
      deps,
    );

    // 1) DISCOVERY — the first router tick was offered the seed tool. With
    //    the kernel's EMPTY default ToolSearch this array would be empty.
    expect(toolsSeenPerTick[0]).toContain('lookupTenantArrears');

    // 2) EXECUTION — the registry actually ran the tool (audit-sink row
    //    with outcome 'ok'), proving the zod-gated dispatch path fired and
    //    this was NOT a pure text turn.
    const okRows = sink.rows().filter((r) => r.outcome === 'ok');
    expect(okRows).toHaveLength(1);
    expect(okRows[0]?.name).toBe('lookupTenantArrears');

    // 3) The loop closed with the model's terminal text after the tool ran.
    expect(out.kind).toBe('answer');
    if (out.kind === 'answer') {
      expect(out.text).toBe('Arrears are TZS 1,250.');
    }
  });

  it('an EMPTY ToolSearch offers NO tools — the regression this fix removes', async () => {
    const { registry, sink } = makeSeededRegistry();
    // The kernel's pre-fix default: an empty store. The dispatcher could
    // still run a tool, but the model is never TOLD a tool exists, so a
    // real model would only ever emit text.
    const emptyToolSearch = createInMemoryToolSearch([]);
    const dispatcher = createRegistryDispatcher(registry);

    let toolsOffered: ReadonlyArray<string> = ['<unset>'];
    const router: LLMRouter = {
      async call(call: LLMRouterCall): Promise<Decision> {
        toolsOffered = call.tools.map((t) => t.name);
        return { kind: 'respond_to_owner', text: 'I can only answer in text.' };
      },
    };

    const out = await think(
      {
        threadId: 'th_empty',
        userMessage: 'Look up the tenant arrears for this profile.',
        scope: {
          kind: 'tenant',
          tenantId: 't_1',
          actorUserId: 'u_1',
          roles: ['owner'],
          personaId: 'p_1',
        },
        tier: 'tenant',
        persona: 'arrears-advisor',
        budget: { maxTurns: 5 },
      },
      {
        router,
        toolSearch: emptyToolSearch,
        hookChain: createHookChain([]),
        planStore: createInMemoryPlanStore(),
        sessionStore: createInMemorySessionStore(),
        memoryTool: createInMemoryMemoryTool(),
        contextBudget: createContextBudget(),
        dispatcher,
      },
    );

    // No tool was ever offered to the model, and none ran.
    expect(toolsOffered).toEqual([]);
    expect(sink.rows()).toHaveLength(0);
    expect(out.kind).toBe('answer');
  });
});
