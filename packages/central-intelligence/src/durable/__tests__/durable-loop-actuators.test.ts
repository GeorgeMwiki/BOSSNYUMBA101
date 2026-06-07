/**
 * PART A — durable loop-actuator tests.
 *
 * Proves the Inngest-backed production impls of the orchestrator's three
 * loop ports:
 *
 *   - DURABLE path: each port enqueues its event onto the bus (the
 *     producer is fire-and-forget) and the registered durable function,
 *     when driven by an in-memory step runner, invokes the injected
 *     child / resume / monitor runner (the composition root binds these
 *     to `kernel.think()`).
 *   - DEGRADE path: when the composition is disabled, spawn runs the
 *     in-process fallback (the child turn still fires, just without
 *     crash-resilience); wake / monitor record the intent + log.
 *
 * No Inngest SDK required — we pass a hand-rolled capturing client that
 * mirrors `InngestClientLike` and the same memoizing step runner the
 * executor tests use.
 */

import { describe, it, expect } from 'vitest';
import {
  createDurableLoopActuators,
  SUB_MD_SPAWN_EVENT,
  ORCHESTRATOR_WAKE_EVENT,
  ORCHESTRATOR_MONITOR_EVENT,
  type SubMdSpawnRequestedEvent,
  type OrchestratorWakeRequestedEvent,
  type OrchestratorMonitorArmedEvent,
} from '../durable-loop-actuators.js';
import {
  type DurableFunctionDefinition,
  type DurableStepLike,
  type InngestComposition,
  type InngestClientLike,
} from '../inngest-client.js';
import type { SubMdSpawn } from '../../kernel/orchestrator/decision.js';
import type {
  SubAgentSpawnContext,
  WakeRequest,
  MonitorRegistration,
} from '../../kernel/orchestrator/adapters/loop-actuators.js';
import type { ScopeContext } from '../../types.js';

// ---------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------

const SCOPE: ScopeContext = {
  kind: 'tenant',
  tenantId: 't_alpha',
  actorUserId: 'u_demo',
  roles: ['estate-manager'],
  personaId: 'estate-manager-head',
};

/** Capturing client — records every send + every registered function. */
function createCapturingClient(): InngestClientLike & {
  readonly sent: Array<{ name: string; data: Record<string, unknown> }>;
  readonly fns: DurableFunctionDefinition[];
} {
  const sent: Array<{ name: string; data: Record<string, unknown> }> = [];
  const fns: DurableFunctionDefinition[] = [];
  return {
    async send(args) {
      sent.push({ name: args.name, data: { ...args.data } });
      return undefined;
    },
    createFunction(def) {
      fns.push(def);
      return def;
    },
    sent,
    fns,
  };
}

function enabledComposition(client: InngestClientLike): InngestComposition {
  return { client, config: { appId: 'test-app', enabled: true }, enabled: true };
}

function disabledComposition(client: InngestClientLike): InngestComposition {
  return { client, config: { appId: 'test-app', enabled: false }, enabled: false };
}

/** Memoizing step runner (mirrors Inngest's replay contract). */
function createMemoStep(): DurableStepLike & {
  readonly sleeps: string[];
} {
  const cache = new Map<string, unknown>();
  const sleeps: string[] = [];
  return {
    async run<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
      if (cache.has(id)) return cache.get(id) as T;
      const value = await fn();
      cache.set(id, value);
      return value;
    },
    async sleepUntil(id: string, _ts: string): Promise<void> {
      sleeps.push(id);
    },
    sleeps,
  };
}

const SPAWN: SubMdSpawn = {
  subMdId: 'sub-1',
  scope: SCOPE,
  initialInput: { ticketId: 'tk_9' },
  persona: 'maintenance-dispatcher',
  prompt: 'triage',
  fireAndForget: true,
};

const SPAWN_CTX: SubAgentSpawnContext = {
  parentThreadId: 'th-parent',
  scope: SCOPE,
  depth: 1,
  parentPersona: 'estate-manager-head',
};

const WAKE: WakeRequest = {
  threadId: 'th-parent',
  wakeAt: '2026-06-08T09:00:00Z',
  reason: 'cure follow-up',
  scope: SCOPE,
  resumeToken: 'resume-1',
};

const MONITOR: MonitorRegistration = {
  watchId: 'w-1',
  threadId: 'th-parent',
  predicate: 'rent.paid',
  timeoutMs: 12 * 60 * 1000, // 12 min → 3 ticks at the 5-min default
  scope: SCOPE,
};

function noopRunners() {
  return {
    childTurnRunner: async () => {},
    resumeTurnRunner: async () => {},
    monitorResumeRunner: async () => {},
    monitorChecker: async () => false,
  };
}

// ---------------------------------------------------------------------------
// DURABLE path
// ---------------------------------------------------------------------------

describe('durable loop actuators — DURABLE path', () => {
  it('registers three durable functions', () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
    });
    expect(built.durable).toBe(true);
    expect(built.definitions).toHaveLength(3);
    expect(client.fns).toHaveLength(3);
  });

  it('spawn enqueues a sub-MD event with the child depth + derived child thread id', async () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
    });
    const handle = await built.actuators.subAgentSpawner!.spawn(SPAWN, SPAWN_CTX);
    expect(handle.mode).toBe('durable');
    const ev = client.sent.find((s) => s.name === SUB_MD_SPAWN_EVENT);
    expect(ev).toBeDefined();
    expect(ev?.data.subMdId).toBe('sub-1');
    expect(ev?.data.depth).toBe(1);
    expect(ev?.data.childThreadId).toBe('th-parent::sub::sub-1');
  });

  it('the spawn function runs the child turn when driven by the step runner', async () => {
    const client = createCapturingClient();
    const ran: Array<{ subMdId: string; depth: number }> = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
      childTurnRunner: async (a) => {
        ran.push({ subMdId: a.subMdId, depth: a.depth });
      },
    });
    await built.actuators.subAgentSpawner!.spawn(SPAWN, SPAWN_CTX);
    // Drive the registered function with the captured event.
    const def = built.definitions[0]!;
    const event = client.sent.find((s) => s.name === SUB_MD_SPAWN_EVENT)!;
    await def.handler({
      event: event as unknown as SubMdSpawnRequestedEvent,
      step: createMemoStep(),
    });
    expect(ran).toHaveLength(1);
    expect(ran[0]?.subMdId).toBe('sub-1');
    expect(ran[0]?.depth).toBe(1);
  });

  it('wake enqueues a wake event and the function sleeps-until then resumes', async () => {
    const client = createCapturingClient();
    const resumed: string[] = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
      resumeTurnRunner: async (a) => {
        resumed.push(a.resumeToken);
      },
    });
    const handle = await built.actuators.scheduler!.schedule(WAKE);
    expect(handle.mode).toBe('durable');
    const ev = client.sent.find((s) => s.name === ORCHESTRATOR_WAKE_EVENT)!;
    expect(ev.data.wakeAt).toBe('2026-06-08T09:00:00Z');

    const step = createMemoStep();
    const def = built.definitions[1]!;
    await def.handler({
      event: ev as unknown as OrchestratorWakeRequestedEvent,
      step,
    });
    // Suspended on the wake time, then re-invoked the orchestrator.
    expect(step.sleeps.some((s) => s.startsWith('sleep-until-wake:'))).toBe(true);
    expect(resumed).toEqual(['resume-1']);
  });

  it('monitor polls until the predicate fires, then resumes (and stops polling)', async () => {
    const client = createCapturingClient();
    const resumed: string[] = [];
    let checks = 0;
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
      // Fire on the 2nd poll tick.
      monitorChecker: async () => {
        checks += 1;
        return checks >= 2;
      },
      monitorResumeRunner: async (a) => {
        resumed.push(a.resumeToken);
      },
    });
    const handle = await built.actuators.monitorRegistry!.register(MONITOR);
    expect(handle.mode).toBe('registered');
    const ev = client.sent.find((s) => s.name === ORCHESTRATOR_MONITOR_EVENT)!;

    const def = built.definitions[2]!;
    const result = (await def.handler({
      event: ev as unknown as OrchestratorMonitorArmedEvent,
      step: createMemoStep(),
    })) as { outcome: string };
    expect(result.outcome).toBe('fired');
    // Stopped after the firing tick — did NOT exhaust all 3 ticks.
    expect(checks).toBe(2);
    expect(resumed).toEqual(['monitor:w-1']);
  });

  it('monitor expires without firing when the predicate never trips', async () => {
    const client = createCapturingClient();
    const resumed: string[] = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
      monitorChecker: async () => false,
      monitorResumeRunner: async (a) => {
        resumed.push(a.resumeToken);
      },
    });
    await built.actuators.monitorRegistry!.register(MONITOR);
    const ev = client.sent.find((s) => s.name === ORCHESTRATOR_MONITOR_EVENT)!;
    const def = built.definitions[2]!;
    const result = (await def.handler({
      event: ev as unknown as OrchestratorMonitorArmedEvent,
      step: createMemoStep(),
    })) as { outcome: string };
    expect(result.outcome).toBe('expired');
    expect(resumed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DEGRADE path (composition disabled)
// ---------------------------------------------------------------------------

describe('durable loop actuators — DEGRADE path', () => {
  it('spawn runs the in-process child turn fallback (no enqueue)', async () => {
    const client = createCapturingClient();
    let ranChild = false;
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      childTurnRunner: async () => {
        ranChild = true;
      },
    });
    expect(built.durable).toBe(false);
    const handle = await built.actuators.subAgentSpawner!.spawn(SPAWN, SPAWN_CTX);
    expect(handle.mode).toBe('in-process');
    // Nothing was enqueued — the fallback ran in-process.
    expect(client.sent).toHaveLength(0);
    // The detached child task runs on a microtask; flush it.
    await new Promise((r) => setTimeout(r, 0));
    expect(ranChild).toBe(true);
  });

  it('wake degrades to a recorded handle (no enqueue, intent not silently dropped)', async () => {
    const client = createCapturingClient();
    const warns: string[] = [];
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      logger: { warn: (_m, msg) => warns.push(msg) },
    });
    const handle = await built.actuators.scheduler!.schedule(WAKE);
    expect(handle.mode).toBe('recorded');
    expect(client.sent).toHaveLength(0);
    expect(warns.some((m) => m.includes('wake recorded'))).toBe(true);
  });

  it('monitor degrades to a recorded handle (no enqueue, intent logged)', async () => {
    const client = createCapturingClient();
    const warns: string[] = [];
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      logger: { warn: (_m, msg) => warns.push(msg) },
    });
    const handle = await built.actuators.monitorRegistry!.register(MONITOR);
    expect(handle.mode).toBe('recorded');
    expect(client.sent).toHaveLength(0);
    expect(warns.some((m) => m.includes('monitor recorded'))).toBe(true);
  });
});
