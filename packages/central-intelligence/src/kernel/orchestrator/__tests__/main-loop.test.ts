import { describe, it, expect } from 'vitest';
import {
  think,
  type OrchestratorDeps,
  type OrchestratorRequest,
  type LLMRouter,
  type Dispatcher,
} from '../main-loop.js';
import { createHookChain, type Hook } from '../hook-chain.js';
import {
  createPlan,
  createInMemoryPlanStore,
  type PlanGoal,
} from '../plan.js';
import { createInMemorySessionStore } from '../checkpoint.js';
import {
  createContextBudget,
  createInMemoryToolSearch,
} from '../context-budget.js';
import { createInMemoryMemoryTool } from '../memory-tool.js';
import type { Decision, DispatchResult } from '../decision.js';
import { createLedgerSealHook, createInMemoryLedgerSeal } from '../hooks/stop/ledger-seal-hook.js';
import { createPermissionHook } from '../hooks/pre-tool-use/permission-hook.js';

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

function fixedRouter(decisions: Decision[]): LLMRouter {
  let i = 0;
  return {
    async call(): Promise<Decision> {
      const next = decisions[i] ?? { kind: 'final', text: 'no more decisions' };
      i += 1;
      return next;
    },
  };
}

function recordingDispatcher(): Dispatcher & { calls: Decision[] } {
  const calls: Decision[] = [];
  return {
    calls,
    async dispatch(decision: Decision): Promise<DispatchResult> {
      calls.push(decision);
      if (decision.kind === 'tool_call') {
        return {
          kind: 'tool_ok',
          callId: decision.call.callId,
          output: { ran: decision.call.toolName },
          latencyMs: 1,
          tokensIn: 10,
          tokensOut: 10,
          usdCost: 0,
        };
      }
      if (
        decision.kind === 'respond_to_owner' ||
        decision.kind === 'final'
      ) {
        return {
          kind: 'response',
          text: decision.text,
          tokensIn: 5,
          tokensOut: 5,
          usdCost: 0,
        };
      }
      if (decision.kind === 'schedule_wake') {
        return { kind: 'wake_ack', resumeToken: decision.wake.wakeAt };
      }
      if (decision.kind === 'spawn_sub_md') {
        return {
          kind: 'spawn_ack',
          subMdId: decision.spawn.subMdId,
          handoffToken: 'h_1',
        };
      }
      return { kind: 'monitor_ack', watchId: 'w_1' };
    },
  };
}

function makeReq(): OrchestratorRequest {
  return {
    threadId: 'thread_test',
    userMessage: 'Tell me about arrears.',
    scope: {
      kind: 'tenant',
      tenantId: 't_1',
      actorUserId: 'u_1',
      roles: ['owner'],
      personaId: 'p_1',
    },
    tier: 'tenant',
    persona: 'arrears-advisor',
    grantedScopes: ['arrears.read'],
    budget: { maxTurns: 5 },
  };
}

function makeDeps(
  router: LLMRouter,
  dispatcher: Dispatcher,
  hooks: Hook[] = [],
  plan?: ReadonlyArray<PlanGoal>,
): OrchestratorDeps {
  const planStore = createInMemoryPlanStore();
  if (plan) {
    // Hydrate the in-memory plan store with a seeded plan.
    planStore.load('thread_test');
    planStore.save(createPlan('thread_test', plan));
  }
  return {
    router,
    toolSearch: createInMemoryToolSearch([
      {
        name: 'arrears.lookup',
        description: 'arrears lookup',
        keywords: ['arrears'],
      },
    ]),
    hookChain: createHookChain(hooks),
    planStore,
    sessionStore: createInMemorySessionStore(),
    memoryTool: createInMemoryMemoryTool(),
    contextBudget: createContextBudget(),
    dispatcher,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('main-loop think()', () => {
  it('answers immediately when the model emits respond_to_owner', async () => {
    const dispatcher = recordingDispatcher();
    const router = fixedRouter([
      { kind: 'respond_to_owner', text: 'arrears: $0' },
    ]);
    const deps = makeDeps(router, dispatcher);
    const out = await think(makeReq(), deps);
    expect(out.kind).toBe('answer');
    if (out.kind === 'answer') expect(out.text).toBe('arrears: $0');
    expect(dispatcher.calls.length).toBe(1);
  });

  it('runs a pre-hook deny and skips dispatch', async () => {
    const dispatcher = recordingDispatcher();
    const router = fixedRouter([
      {
        kind: 'tool_call',
        call: { toolName: 'tenant.write', input: {}, callId: 'c1' },
      },
      { kind: 'respond_to_owner', text: 'cannot' },
    ]);
    const deps = makeDeps(router, dispatcher, [
      createPermissionHook({
        scopes: { requiredScopes: () => ['tenants.write'] },
      }),
    ]);
    const out = await think(makeReq(), deps);
    expect(out.kind).toBe('answer');
    // The denied tool_call must NOT have been dispatched.
    expect(dispatcher.calls.find((d) => d.kind === 'tool_call')).toBeUndefined();
  });

  it('halts with budget-exhausted when maxTurns is reached', async () => {
    const dispatcher = recordingDispatcher();
    // Always reply with the same tool_call so the loop never terminates.
    const router: LLMRouter = {
      async call(): Promise<Decision> {
        return {
          kind: 'tool_call',
          call: { toolName: 'noop', input: {}, callId: 'c' },
        };
      },
    };
    const deps = makeDeps(router, dispatcher);
    const req: OrchestratorRequest = { ...makeReq(), budget: { maxTurns: 3 } };
    const out = await think(req, deps);
    expect(out.kind).toBe('budget-exhausted');
    if (out.kind === 'budget-exhausted') expect(out.axis).toBe('turns');
  });

  it('returns ask-approval when a hook asks for owner sign-off', async () => {
    const dispatcher = recordingDispatcher();
    const router = fixedRouter([
      {
        kind: 'tool_call',
        call: { toolName: 'tenant.evict', input: {}, callId: 'c1' },
      },
    ]);
    const askHook: Hook = {
      name: 'ask',
      stage: 'pre-tool-use',
      async fn() {
        return {
          kind: 'ask-owner',
          channel: 'inbox',
          prompt: 'Confirm eviction',
        };
      },
    };
    const deps = makeDeps(router, dispatcher, [askHook]);
    const out = await think(makeReq(), deps);
    expect(out.kind).toBe('ask-approval');
    if (out.kind === 'ask-approval') {
      expect(out.channel).toBe('inbox');
      expect(out.prompt).toContain('Confirm');
    }
  });

  it('runs the stop chain when a final response is emitted', async () => {
    const dispatcher = recordingDispatcher();
    const ledger = createInMemoryLedgerSeal();
    const router = fixedRouter([
      { kind: 'respond_to_owner', text: 'bye' },
    ]);
    const deps = makeDeps(router, dispatcher, [
      createLedgerSealHook({ ledger }),
    ]);
    await think(makeReq(), deps);
    expect(ledger.seals.length).toBe(1);
    expect(ledger.seals[0]?.threadId).toBe('thread_test');
  });
});
