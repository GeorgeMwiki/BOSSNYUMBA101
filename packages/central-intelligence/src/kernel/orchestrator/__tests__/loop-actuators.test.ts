/**
 * PART A — orchestrator loop-actuator tests.
 *
 * Proves the registry dispatcher ACTUATES the three agentic-loop Decision
 * variants for REAL when the ports are wired, ENFORCES the recursion depth
 * cap, and DEGRADES gracefully (records intent + still ACKs, never throws,
 * never silently drops) when a port is absent:
 *
 *   (a) spawn_sub_md  → invokes the SubAgentSpawner with the child depth;
 *                       refuses cleanly at the depth cap; degrades when no
 *                       spawner is wired.
 *   (b) schedule_wake → persists via the WakeScheduler; degrades to a
 *                       recorded wake_ack when null.
 *   (c) monitor       → registers via the MonitorRegistry; degrades to a
 *                       recorded monitor_ack when null.
 *
 * Mirrors the fixtures + style of `adapters.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createBrainToolRegistry,
  type BrainToolRegistry,
} from '../../tool-spec.js';
import { createRegistryDispatcher } from '../adapters/registry-dispatcher.js';
import {
  createInMemorySubAgentSpawner,
  createInMemoryWakeScheduler,
  createInMemoryMonitorRegistry,
  type SubAgentSpawner,
  type SubAgentSpawnContext,
  type LoopActuators,
} from '../adapters/loop-actuators.js';
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
  threadId: 'th-loop',
  scope: SCOPE,
  tier: 'property',
  userMessage: 'orchestrate',
  tickStartedAt: 0,
};

function emptyRegistry(): BrainToolRegistry {
  return createBrainToolRegistry();
}

const SPAWN_DECISION: Extract<Decision, { kind: 'spawn_sub_md' }> = {
  kind: 'spawn_sub_md',
  spawn: {
    subMdId: 'sub-maint-1',
    scope: SCOPE,
    initialInput: { ticketId: 'tk_1' },
    persona: 'maintenance-dispatcher',
    prompt: 'triage this ticket',
    fireAndForget: true,
  },
};

const WAKE_DECISION: Extract<Decision, { kind: 'schedule_wake' }> = {
  kind: 'schedule_wake',
  wake: {
    wakeAt: '2026-06-08T09:00:00Z',
    reason: 'follow-up on arrears cure',
    resumeToken: 'resume-arrears-1',
  },
};

const MONITOR_DECISION: Extract<Decision, { kind: 'monitor' }> = {
  kind: 'monitor',
  watch: { watchId: 'w-rent-1', predicate: 'rent.paid', timeoutMs: 60_000 },
};

// ─────────────────────────────────────────────────────────────────────
// (a) spawn_sub_md
// ─────────────────────────────────────────────────────────────────────

describe('registry dispatcher — spawn_sub_md actuation', () => {
  it('invokes the spawner with childDepth=currentDepth+1 and returns its handoff token', async () => {
    const spawner = createInMemorySubAgentSpawner();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { subAgentSpawner: spawner, currentDepth: 1 },
    });

    const result = await dispatcher.dispatch(SPAWN_DECISION, CTX);

    expect(result.kind).toBe('spawn_ack');
    if (result.kind === 'spawn_ack') {
      expect(result.subMdId).toBe('sub-maint-1');
      expect(result.background).toBe(true);
      // The in-memory spawner returns an `inproc:` token; the dispatcher
      // forwards the spawner's handoff token verbatim.
      expect(result.handoffToken).toBe('inproc:sub-maint-1');
    }
    const recorded = spawner.recorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.subMdId).toBe('sub-maint-1');
    expect(recorded[0]?.parentThreadId).toBe('th-loop');
    // currentDepth 1 → child depth 2.
    expect(recorded[0]?.depth).toBe(2);
  });

  it('REFUSES the spawn cleanly at the recursion depth cap (spawner never called)', async () => {
    const spawner = createInMemorySubAgentSpawner();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      // maxSpawnDepth 2, currentDepth 2 → child would be depth 3 > cap → refuse.
      loopActuators: {
        subAgentSpawner: spawner,
        maxSpawnDepth: 2,
        currentDepth: 2,
      },
    });

    const result = await dispatcher.dispatch(SPAWN_DECISION, CTX);

    // The parent still gets an ack (it keeps looping) but the child is refused.
    expect(result.kind).toBe('spawn_ack');
    if (result.kind === 'spawn_ack') {
      expect(result.handoffToken).toBe('refused-depth:sub-maint-1');
    }
    // The spawner was NEVER invoked — the cap is enforced BEFORE the port.
    expect(spawner.recorded()).toHaveLength(0);
  });

  it('refuses ALL spawning when maxSpawnDepth=0', async () => {
    const spawner = createInMemorySubAgentSpawner();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { subAgentSpawner: spawner, maxSpawnDepth: 0, currentDepth: 0 },
    });
    const result = await dispatcher.dispatch(SPAWN_DECISION, CTX);
    expect(result.kind).toBe('spawn_ack');
    if (result.kind === 'spawn_ack') {
      expect(result.handoffToken).toBe('refused-depth:sub-maint-1');
    }
    expect(spawner.recorded()).toHaveLength(0);
  });

  it('degrades to a logged spawn_ack when NO spawner is wired (intent not lost)', async () => {
    const warns: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      logger: { warn: (msg, meta) => warns.push({ msg, ...(meta ? { meta } : {}) }) },
      // No subAgentSpawner — degrade.
      loopActuators: {},
    });

    const result = await dispatcher.dispatch(SPAWN_DECISION, CTX);

    expect(result.kind).toBe('spawn_ack');
    if (result.kind === 'spawn_ack') {
      expect(result.handoffToken).toBe('handoff:sub-maint-1');
      expect(result.background).toBe(true);
    }
    // Honest degrade signal — not a silent drop.
    expect(warns.some((w) => w.msg.includes('spawn_sub_md degraded'))).toBe(true);
  });

  it('degrades (does not crash) when the spawner itself throws', async () => {
    const throwingSpawner: SubAgentSpawner = {
      async spawn(_spawn: never, _ctx: SubAgentSpawnContext): Promise<never> {
        throw new Error('spawn infra unreachable');
      },
    };
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { subAgentSpawner: throwingSpawner, currentDepth: 0 },
    });
    const result = await dispatcher.dispatch(SPAWN_DECISION, CTX);
    expect(result.kind).toBe('spawn_ack');
    if (result.kind === 'spawn_ack') {
      expect(result.handoffToken).toBe('handoff:sub-maint-1');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// (b) schedule_wake
// ─────────────────────────────────────────────────────────────────────

describe('registry dispatcher — schedule_wake actuation', () => {
  it('persists the wake via the scheduler and echoes its resume token', async () => {
    const scheduler = createInMemoryWakeScheduler();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { scheduler },
    });

    const result = await dispatcher.dispatch(WAKE_DECISION, CTX);

    expect(result.kind).toBe('wake_ack');
    if (result.kind === 'wake_ack') {
      expect(result.resumeToken).toBe('resume-arrears-1');
    }
    const recorded = scheduler.recorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.threadId).toBe('th-loop');
    expect(recorded[0]?.wakeAt).toBe('2026-06-08T09:00:00Z');
    expect(recorded[0]?.resumeToken).toBe('resume-arrears-1');
  });

  it('degrades to a wake_ack when NO scheduler is wired (intent logged)', async () => {
    const warns: string[] = [];
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      logger: { warn: (msg) => warns.push(msg) },
      loopActuators: {},
    });

    const result = await dispatcher.dispatch(WAKE_DECISION, CTX);

    expect(result.kind).toBe('wake_ack');
    if (result.kind === 'wake_ack') {
      expect(result.resumeToken).toBe('resume-arrears-1');
    }
    expect(warns.some((m) => m.includes('schedule_wake degraded'))).toBe(true);
  });

  it('falls back to wakeAt as the resume token when none is supplied', async () => {
    const scheduler = createInMemoryWakeScheduler();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { scheduler },
    });
    const result = await dispatcher.dispatch(
      {
        kind: 'schedule_wake',
        wake: { wakeAt: '2026-07-01T00:00:00Z', reason: 'monthly close' },
      },
      CTX,
    );
    expect(result.kind).toBe('wake_ack');
    if (result.kind === 'wake_ack') {
      expect(result.resumeToken).toBe('2026-07-01T00:00:00Z');
    }
    expect(scheduler.recorded()[0]?.resumeToken).toBe('2026-07-01T00:00:00Z');
  });

  it('degrades (does not crash) when the scheduler throws', async () => {
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: {
        scheduler: {
          async schedule(): Promise<never> {
            throw new Error('scheduler down');
          },
        },
      },
    });
    const result = await dispatcher.dispatch(WAKE_DECISION, CTX);
    expect(result.kind).toBe('wake_ack');
  });
});

// ─────────────────────────────────────────────────────────────────────
// (c) monitor
// ─────────────────────────────────────────────────────────────────────

describe('registry dispatcher — monitor actuation', () => {
  it('registers the watch via the monitor registry and echoes the watch id', async () => {
    const registry = createInMemoryMonitorRegistry();
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: { monitorRegistry: registry },
    });

    const result = await dispatcher.dispatch(MONITOR_DECISION, CTX);

    expect(result.kind).toBe('monitor_ack');
    if (result.kind === 'monitor_ack') {
      expect(result.watchId).toBe('w-rent-1');
    }
    const recorded = registry.recorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.watchId).toBe('w-rent-1');
    expect(recorded[0]?.threadId).toBe('th-loop');
    expect(recorded[0]?.predicate).toBe('rent.paid');
  });

  it('degrades to a monitor_ack when NO registry is wired (intent logged)', async () => {
    const warns: string[] = [];
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      logger: { warn: (msg) => warns.push(msg) },
      loopActuators: {},
    });

    const result = await dispatcher.dispatch(MONITOR_DECISION, CTX);

    expect(result.kind).toBe('monitor_ack');
    if (result.kind === 'monitor_ack') {
      expect(result.watchId).toBe('w-rent-1');
    }
    expect(warns.some((m) => m.includes('monitor degraded'))).toBe(true);
  });

  it('degrades (does not crash) when the registry throws', async () => {
    const dispatcher = createRegistryDispatcher(emptyRegistry(), {
      loopActuators: {
        monitorRegistry: {
          async register(): Promise<never> {
            throw new Error('registry down');
          },
        },
      },
    });
    const result = await dispatcher.dispatch(MONITOR_DECISION, CTX);
    expect(result.kind).toBe('monitor_ack');
  });
});

// ─────────────────────────────────────────────────────────────────────
// No actuators at all — every variant degrades, none throws (parity with
// the pre-PART-A behaviour the existing adapters.test.ts also asserts).
// ─────────────────────────────────────────────────────────────────────

describe('registry dispatcher — all-variant degrade with zero actuators', () => {
  it('schedule_wake, monitor, and spawn_sub_md all degrade-but-ACK', async () => {
    const dispatcher = createRegistryDispatcher(emptyRegistry());
    const wake = await dispatcher.dispatch(WAKE_DECISION, CTX);
    const monitor = await dispatcher.dispatch(MONITOR_DECISION, CTX);
    const spawn = await dispatcher.dispatch(SPAWN_DECISION, CTX);
    expect(wake.kind).toBe('wake_ack');
    expect(monitor.kind).toBe('monitor_ack');
    expect(spawn.kind).toBe('spawn_ack');
  });
});

// Type-only export pin so an unused-import lint never strips the bundle type.
const _typePin: LoopActuators = {};
void _typePin;
