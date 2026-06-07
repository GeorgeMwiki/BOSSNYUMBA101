/**
 * SECONDARY — in-process Inngest runtime tests.
 *
 * Proves the consumer/serve side the `/api/v1/inngest` webhook dispatches to:
 *   - routes an event by name to the matching `DurableFunctionDefinition` and
 *     runs its handler with an in-process step;
 *   - the durable wake function, driven through this runtime, fires the bound
 *     `resumeTurnRunner` (so an enqueued event is no longer black-holed);
 *   - an unregistered event name throws (webhook → 500, not a silent ACK);
 *   - cron-triggered defs are skipped (no event name to route by).
 */

import { describe, it, expect } from 'vitest';
import { createInProcessInngestRuntime } from '../in-process-inngest-runtime.js';
import {
  createDurableLoopActuators,
  ORCHESTRATOR_WAKE_EVENT,
} from '../durable-loop-actuators.js';
import type {
  DurableFunctionDefinition,
  InngestClientLike,
  InngestComposition,
} from '../inngest-client.js';
import type { WakeRequest } from '../../kernel/orchestrator/adapters/loop-actuators.js';
import type { ScopeContext } from '../../types.js';

const SCOPE: ScopeContext = {
  kind: 'tenant',
  tenantId: 't_alpha',
  actorUserId: 'u_demo',
  roles: ['estate-manager'],
  personaId: 'estate-manager-head',
};

function createCapturingClient(): InngestClientLike & {
  readonly sent: Array<{ name: string; data: Record<string, unknown> }>;
} {
  const sent: Array<{ name: string; data: Record<string, unknown> }> = [];
  return {
    async send(args) {
      sent.push({ name: args.name, data: { ...args.data } });
      return undefined;
    },
    createFunction(def) {
      return def;
    },
    sent,
  };
}

function enabledComposition(client: InngestClientLike): InngestComposition {
  return { client, config: { appId: 'test-app', enabled: true }, enabled: true };
}

const WAKE: WakeRequest = {
  threadId: 'th-parent',
  wakeAt: '2026-06-08T09:00:00Z',
  reason: 'cure follow-up',
  scope: SCOPE,
  resumeToken: 'resume-1',
};

describe('in-process Inngest runtime', () => {
  it('routes the wake event to its function and fires the resume runner', async () => {
    const client = createCapturingClient();
    const resumed: string[] = [];
    const built = createDurableLoopActuators({
      composition: enabledComposition(client),
      consumerRegistered: true,
      childTurnRunner: async () => {},
      resumeTurnRunner: async (a) => {
        resumed.push(a.resumeToken);
      },
      monitorResumeRunner: async () => {},
      monitorChecker: async () => false,
    });
    // Producer enqueues the wake event.
    await built.actuators.scheduler!.schedule(WAKE);
    const ev = client.sent.find((s) => s.name === ORCHESTRATOR_WAKE_EVENT)!;

    // The runtime (consumer) routes it to the wake function + runs the body.
    const runtime = createInProcessInngestRuntime({ definitions: built.definitions });
    expect(runtime.registeredEvents).toContain(ORCHESTRATOR_WAKE_EVENT);
    const result = await runtime.handle({ name: ev.name, data: ev.data, id: 'evt-1' });
    expect(result.ok).toBe(true);
    // The wake function's body ran the resume runner (sleepUntil is a no-op
    // in-process, so the resume fires immediately).
    expect(resumed).toEqual(['resume-1']);
  });

  it('throws for an unregistered event name (webhook → 500, not silent ACK)', async () => {
    const runtime = createInProcessInngestRuntime({ definitions: [] });
    await expect(
      runtime.handle({ name: 'orchestrator/does-not-exist', data: {} }),
    ).rejects.toThrow(/no durable function registered/);
  });

  it('skips cron-triggered defs (no event name to route by)', () => {
    const cronDef: DurableFunctionDefinition = {
      id: 'app.nightly',
      trigger: { cron: '0 0 * * *' },
      handler: async () => ({ ok: true }),
    };
    const eventDef: DurableFunctionDefinition = {
      id: 'app.on-event',
      trigger: { event: 'app/thing.happened' },
      handler: async () => ({ ok: true }),
    };
    const runtime = createInProcessInngestRuntime({
      definitions: [cronDef, eventDef],
    });
    expect(runtime.registeredEvents).toEqual(['app/thing.happened']);
  });

  it('propagates a handler fault as a throw (retryable, not a drop)', async () => {
    const boomDef: DurableFunctionDefinition = {
      id: 'app.boom',
      trigger: { event: 'app/boom' },
      handler: async () => {
        throw new Error('handler exploded');
      },
    };
    const runtime = createInProcessInngestRuntime({
      definitions: [boomDef],
      logger: { error: () => {} },
    });
    await expect(
      runtime.handle({ name: 'app/boom', data: {} }),
    ).rejects.toThrow(/handler exploded/);
  });
});
