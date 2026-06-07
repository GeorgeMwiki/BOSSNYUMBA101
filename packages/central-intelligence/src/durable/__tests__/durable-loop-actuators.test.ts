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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
      // M2 — a REAL predicate checker is wired below, so attest the monitor
      // is available (otherwise it degrade-ACKs instead of arming a poll).
      monitorAvailable: true,
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
      // H1 — the DURABLE path asserts true durable behaviour, which now
      // requires the composition root to attest a registered consumer.
      consumerRegistered: true,
      // M2 — drive the durable poll loop directly; attest availability so it
      // arms (this test exercises the EXPIRY branch of an armed monitor).
      monitorAvailable: true,
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

// ---------------------------------------------------------------------------
// H1 — durable PRODUCER honesty. `composition.enabled === true` only means
// the producer CAN enqueue; it says nothing about whether a CONSUMER (serve
// handler) is registered. Enqueuing onto an unserved bus would black-hole
// the event while reporting `mode:'durable'` success — a silent drop. The
// producers must NOT report durable success unless a consumer is attested.
// ---------------------------------------------------------------------------

describe('durable loop actuators — H1 producer honesty (no false durable success)', () => {
  it('does NOT report durable when enabled but no consumer is registered', () => {
    const client = createCapturingClient();
    const warns: string[] = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      // consumerRegistered omitted → false (fail-closed).
      ...noopRunners(),
      logger: { warn: (_m, msg) => warns.push(msg) },
    });
    expect(built.durable).toBe(false);
    expect(warns.some((m) => m.includes('no consumer registered'))).toBe(true);
  });

  it('spawn falls back to in-process (NOT durable) and does NOT enqueue when no consumer is registered', async () => {
    const client = createCapturingClient();
    let ranChild = false;
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
      childTurnRunner: async () => {
        ranChild = true;
      },
      // consumerRegistered omitted → durable is NOT trusted.
    });
    const handle = await built.actuators.subAgentSpawner!.spawn(SPAWN, SPAWN_CTX);
    // Honest: in-process, not a false `durable`.
    expect(handle.mode).toBe('in-process');
    // The event was NOT enqueued onto the unserved bus.
    expect(client.sent).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(ranChild).toBe(true);
  });

  it('wake reports recorded (NOT durable) and does NOT enqueue when no consumer is registered', async () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      ...noopRunners(),
    });
    const handle = await built.actuators.scheduler!.schedule(WAKE);
    expect(handle.mode).toBe('recorded');
    expect(client.sent).toHaveLength(0);
  });

  it('reports durable ONLY when a consumer is attested', async () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      consumerRegistered: true,
      ...noopRunners(),
    });
    expect(built.durable).toBe(true);
    const handle = await built.actuators.subAgentSpawner!.spawn(SPAWN, SPAWN_CTX);
    expect(handle.mode).toBe('durable');
    expect(client.sent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// M1 — wake/monitor degrade is REPLAYABLE, not log-only. When a degrade
// recorder is wired the intent is persisted there so a supervisor can act.
// ---------------------------------------------------------------------------

describe('durable loop actuators — M1 replayable degrade recorder', () => {
  it('records the wake intent to the degrade recorder (not just a log)', async () => {
    const client = createCapturingClient();
    const recordedWakes: Array<{ threadId: string; resumeToken: string }> = [];
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      degradeRecorder: {
        recordWake: (req) => {
          recordedWakes.push({ threadId: req.threadId, resumeToken: req.resumeToken });
        },
      },
    });
    const handle = await built.actuators.scheduler!.schedule(WAKE);
    expect(handle.mode).toBe('recorded');
    // The intent landed in the replayable recorder — not silently dropped.
    expect(recordedWakes).toEqual([
      { threadId: 'th-parent', resumeToken: 'resume-1' },
    ]);
  });

  it('records the monitor intent to the degrade recorder', async () => {
    const client = createCapturingClient();
    const recordedMonitors: string[] = [];
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      degradeRecorder: {
        recordMonitor: (reg) => {
          recordedMonitors.push(reg.watchId);
        },
      },
    });
    await built.actuators.monitorRegistry!.register(MONITOR);
    expect(recordedMonitors).toEqual(['w-1']);
  });

  it('never throws when the degrade recorder itself fails', async () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: disabledComposition(client),
      ...noopRunners(),
      degradeRecorder: {
        recordWake: () => {
          throw new Error('recorder down');
        },
      },
    });
    // Producer must still resolve with the honest recorded handle.
    const handle = await built.actuators.scheduler!.schedule(WAKE);
    expect(handle.mode).toBe('recorded');
  });
});

// ---------------------------------------------------------------------------
// M2 — monitor must NOT arm a doomed poll when no real predicate source is
// attested. Arming a poll backed by an always-false stub burns durable
// steps for a guaranteed expiry; instead the producer degrade-ACKs.
// ---------------------------------------------------------------------------

describe('durable loop actuators — M2 monitor availability gate', () => {
  it('degrade-ACKs (no enqueue) when durable but monitorAvailable is unset', async () => {
    const client = createCapturingClient();
    const warns: string[] = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      consumerRegistered: true,
      // monitorAvailable omitted → no real predicate source.
      ...noopRunners(),
      logger: { warn: (_m, msg) => warns.push(msg) },
    });
    const handle = await built.actuators.monitorRegistry!.register(MONITOR);
    // Recorded (not 'registered') and NOT enqueued — no doomed poll armed.
    expect(handle.mode).toBe('recorded');
    expect(
      client.sent.filter((s) => s.name === ORCHESTRATOR_MONITOR_EVENT),
    ).toHaveLength(0);
    expect(warns.some((m) => m.includes('not armed'))).toBe(true);
  });

  it('arms the durable monitor when monitorAvailable is attested', async () => {
    const client = createCapturingClient();
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      consumerRegistered: true,
      monitorAvailable: true,
      ...noopRunners(),
    });
    const handle = await built.actuators.monitorRegistry!.register(MONITOR);
    expect(handle.mode).toBe('registered');
    expect(
      client.sent.filter((s) => s.name === ORCHESTRATOR_MONITOR_EVENT),
    ).toHaveLength(1);
  });
});
