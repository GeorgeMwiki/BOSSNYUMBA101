/**
 * PRIMARY — in-process wake (+ monitor) supervisor tests.
 *
 * Proves the DEPLOY-FREE actuator: `schedule_wake` arms a real process-local
 * resume that fires on a tick WITHOUT Inngest (durable disabled), and the
 * resumed turn re-invokes the bound `ResumeTurnRunner` (the composition root
 * binds this to `kernel.think()`). Also proves:
 *   - the wake handle mode is the HONEST `'in-process'` (not a false durable);
 *   - a wake whose `wakeAt` is in the future does NOT fire early;
 *   - re-arming the same resumeToken replaces (no duplicate fire);
 *   - monitor degrade-records when no predicate source is attested (honest);
 *   - monitor arms + fires in-process when a real predicate source IS attested;
 *   - an armed monitor expires after its timeout without firing.
 *
 * No Inngest SDK and no kernel — the runner callbacks are plain capturing
 * stubs, exactly how the composition root binds the real ones.
 */

import { describe, it, expect } from 'vitest';
import { createInProcessWakeScheduler } from '../in-process-wake-scheduler.js';
import type { ResumeTurnRunner, MonitorChecker } from '../durable-loop-actuators.js';
import type {
  WakeRequest,
  MonitorRegistration,
} from '../../kernel/orchestrator/adapters/loop-actuators.js';
import type { ScopeContext } from '../../types.js';

const SCOPE: ScopeContext = {
  kind: 'tenant',
  tenantId: 't_alpha',
  actorUserId: 'u_demo',
  roles: ['estate-manager'],
  personaId: 'estate-manager-head',
};

function wakeAt(offsetMs: number, now: number): string {
  return new Date(now + offsetMs).toISOString();
}

function makeWake(overrides: Partial<WakeRequest> = {}): WakeRequest {
  return {
    threadId: 'th-parent',
    wakeAt: '2026-06-08T09:00:00Z',
    reason: 'cure follow-up',
    scope: SCOPE,
    resumeToken: 'resume-1',
    ...overrides,
  };
}

const MONITOR: MonitorRegistration = {
  watchId: 'w-1',
  threadId: 'th-parent',
  predicate: 'rent.paid',
  timeoutMs: 60_000,
  scope: SCOPE,
};

// ---------------------------------------------------------------------------
// WAKE — the PRIMARY unblock.
// ---------------------------------------------------------------------------

describe('in-process wake scheduler — WAKE executes without Inngest', () => {
  it('schedule arms an in-process wake (honest mode, not false durable)', async () => {
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {},
      clock: () => 1_000,
    });
    const handle = await sup.scheduler.schedule(makeWake());
    // The honest mode is 'in-process' — it WILL fire, but is not crash-resilient.
    expect(handle.mode).toBe('in-process');
    expect(handle.resumeToken).toBe('resume-1');
    expect(sup.pendingWakeCount()).toBe(1);
  });

  it('a due wake fires the resume runner on tick (no Inngest involved)', async () => {
    const now = 10_000;
    const resumed: Array<{ threadId: string; resumeToken: string; reason: string }> = [];
    const resumeTurnRunner: ResumeTurnRunner = async (a) => {
      resumed.push({ threadId: a.threadId, resumeToken: a.resumeToken, reason: a.reason });
    };
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner,
      clock: () => now,
    });
    // wakeAt 5s in the PAST → due immediately.
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(-5_000, now), resumeToken: 'rt-due' }));
    const outcome = await sup.tick(now);
    expect(outcome.wakesFired).toBe(1);
    expect(resumed).toEqual([
      { threadId: 'th-parent', resumeToken: 'rt-due', reason: 'cure follow-up' },
    ]);
    // Fired wake is removed — a second tick does not double-fire it.
    expect(sup.pendingWakeCount()).toBe(0);
    const second = await sup.tick(now);
    expect(second.wakesFired).toBe(0);
    expect(resumed).toHaveLength(1);
  });

  it('a future wake does NOT fire until its wakeAt arrives', async () => {
    const now = 10_000;
    let fired = 0;
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {
        fired += 1;
      },
      clock: () => now,
    });
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(60_000, now), resumeToken: 'rt-future' }));
    // Tick at `now` — wake is 60s out, must not fire.
    expect((await sup.tick(now)).wakesFired).toBe(0);
    expect(fired).toBe(0);
    expect(sup.pendingWakeCount()).toBe(1);
    // Advance the clock past wakeAt — now it fires.
    expect((await sup.tick(now + 61_000)).wakesFired).toBe(1);
    expect(fired).toBe(1);
  });

  it('re-arming the same resumeToken replaces (fires once, not twice)', async () => {
    const now = 10_000;
    let fired = 0;
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {
        fired += 1;
      },
      clock: () => now,
    });
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(-1_000, now), resumeToken: 'dup' }));
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(-1_000, now), resumeToken: 'dup' }));
    expect(sup.pendingWakeCount()).toBe(1);
    await sup.tick(now);
    expect(fired).toBe(1);
  });

  it('a resume-runner fault does not stop the other due wakes', async () => {
    const now = 10_000;
    const ok: string[] = [];
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async (a) => {
        if (a.resumeToken === 'bad') throw new Error('think() blew up');
        ok.push(a.resumeToken);
      },
      clock: () => now,
      logger: { error: () => {} },
    });
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(-1, now), resumeToken: 'bad' }));
    await sup.scheduler.schedule(makeWake({ wakeAt: wakeAt(-1, now), resumeToken: 'good' }));
    const outcome = await sup.tick(now);
    // Only the good one counts as fired; the bad one is logged + dropped.
    expect(outcome.wakesFired).toBe(1);
    expect(ok).toEqual(['good']);
    // Both removed from the queue (a failed resume is not retried by this loop).
    expect(sup.pendingWakeCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MONITOR — honest degrade when no predicate source; real poll when attested.
// ---------------------------------------------------------------------------

describe('in-process wake scheduler — MONITOR', () => {
  it('degrade-records (no arm) when no predicate source is attested', async () => {
    const warns: string[] = [];
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {},
      // monitorAvailable / monitorChecker omitted → no real source.
      logger: { warn: (_m, msg) => warns.push(msg) },
    });
    const handle = await sup.monitorRegistry.register(MONITOR);
    expect(handle.mode).toBe('recorded');
    expect(sup.armedMonitorCount()).toBe(0);
    expect(warns.some((m) => m.includes('monitor NOT armed'))).toBe(true);
  });

  it('arms + fires in-process when a real predicate source is attested', async () => {
    const now = 10_000;
    let checks = 0;
    const resumed: string[] = [];
    const monitorChecker: MonitorChecker = async () => {
      checks += 1;
      return checks >= 2; // trip on the 2nd poll
    };
    const monitorResumeRunner: ResumeTurnRunner = async (a) => {
      resumed.push(a.resumeToken);
    };
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {},
      monitorAvailable: true,
      monitorChecker,
      monitorResumeRunner,
      clock: () => now,
    });
    const handle = await sup.monitorRegistry.register(MONITOR);
    expect(handle.mode).toBe('in-process');
    expect(sup.armedMonitorCount()).toBe(1);
    // 1st tick — predicate false, still armed.
    expect((await sup.tick(now)).monitorsFired).toBe(0);
    expect(sup.armedMonitorCount()).toBe(1);
    // 2nd tick — predicate trips, resume fires, watch removed.
    const outcome = await sup.tick(now);
    expect(outcome.monitorsFired).toBe(1);
    expect(resumed).toEqual(['monitor:w-1']);
    expect(sup.armedMonitorCount()).toBe(0);
  });

  it('an armed monitor expires after its timeout without firing', async () => {
    const now = 10_000;
    const resumed: string[] = [];
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {},
      monitorAvailable: true,
      monitorChecker: async () => false, // never trips
      monitorResumeRunner: async (a) => {
        resumed.push(a.resumeToken);
      },
      clock: () => now,
    });
    await sup.monitorRegistry.register({ ...MONITOR, timeoutMs: 30_000 });
    // Before timeout — retained, not fired, not expired.
    let outcome = await sup.tick(now + 10_000);
    expect(outcome.monitorsFired).toBe(0);
    expect(outcome.monitorsExpired).toBe(0);
    expect(sup.armedMonitorCount()).toBe(1);
    // After timeout — expired (removed), still never fired.
    outcome = await sup.tick(now + 31_000);
    expect(outcome.monitorsExpired).toBe(1);
    expect(resumed).toEqual([]);
    expect(sup.armedMonitorCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle — start()/stop() are idempotent and the self-drive interval fires.
// ---------------------------------------------------------------------------

describe('in-process wake scheduler — lifecycle', () => {
  it('start()/stop() are idempotent', () => {
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {},
      tickIntervalMs: 1_000,
    });
    expect(() => {
      sup.start();
      sup.start();
      sup.stop();
      sup.stop();
    }).not.toThrow();
  });

  it('the self-drive interval fires a due wake without an external tick', async () => {
    let fired = 0;
    // A clock that always returns "now" so the wake (armed at wakeAt in the
    // past) is due the moment the interval ticks.
    const sup = createInProcessWakeScheduler({
      resumeTurnRunner: async () => {
        fired += 1;
      },
      tickIntervalMs: 1_000, // floor is 1s; we wait just over one tick
    });
    await sup.scheduler.schedule(
      makeWake({ wakeAt: new Date(Date.now() - 1_000).toISOString(), resumeToken: 'rt-interval' }),
    );
    sup.start();
    // Wait just over one interval for the self-drive tick to fire it.
    await new Promise((r) => setTimeout(r, 1_200));
    sup.stop();
    expect(fired).toBe(1);
  });
});
