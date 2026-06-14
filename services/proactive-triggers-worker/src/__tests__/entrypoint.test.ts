/**
 * Entrypoint + drop-safety live detectors.
 *
 * These tests are the "the pod actually does something" guard for
 * BLOCKER #4 (index.ts exported `launchProactiveTriggersWorker` but never
 * invoked it, so `node dist/index.js` did nothing) and the
 * mark-seen-only-on-success guard for HIGH #8 (a failed emit used to be
 * marked seen + counted fired, permanently suppressing the trigger).
 *
 * They mock ONLY the `@bossnyumba/user-context-store` rule pipeline so a
 * deterministic high-urgency trigger flows through the REAL cron handler
 * and the REAL `main()` supervisor — the orchestration under test is not
 * stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role, Trigger } from '@bossnyumba/user-context-store';

// --- Deterministic trigger pipeline -----------------------------------
// One high-urgency (5) trigger per user, so it clears the default
// minUrgency (4) and reaches the sink. Keeps the cron handler's real
// idempotency + emit + drop logic on the hot path.
const SYNTH_TRIGGER: Trigger = {
  id: 'trig-synthetic-1',
  kind: 'rent.due_soon',
  urgency: 5,
  summary: 'Rent is due soon',
  suggestedAction: 'Send the reminder',
  suggestedPromptForChat: 'Draft a rent reminder',
  triggeringEvidence: [{ kind: 'lease', id: 'lease-1' }],
};

vi.mock('@bossnyumba/user-context-store', () => ({
  buildProfile: vi.fn(async () => ({})),
  gatherSignals: vi.fn(async () => ({})),
  computeTriggers: vi.fn(() => [SYNTH_TRIGGER]),
}));

import { main } from '../index.js';
import { runHourlySweep } from '../schedule/cron-handler.js';
import { buildProductionDeps } from '../bootstrap/build-deps.js';
import { InMemoryIdempotencyCache } from '../idempotency/trigger-seen.js';
import type { RunSweepDeps } from '../schedule/cron-handler.js';
import type {
  StaffAlertSink,
  TenantDirectory,
  TriggerSink,
} from '../types.js';

function emptyDb() {
  return {
    async execute() {
      return { rows: [] };
    },
  };
}

function directory(users: ReadonlyArray<{ userId: string; role: Role }>): TenantDirectory {
  return {
    async listActiveTenants() {
      return ['t1'];
    },
    async listActiveUsers() {
      return users;
    },
  };
}

function okSink(): TriggerSink & { emitted: Trigger[] } {
  const emitted: Trigger[] = [];
  return {
    emitted,
    async emit({ trigger }) {
      emitted.push(trigger);
    },
  };
}

function throwingSink(): TriggerSink {
  return {
    async emit() {
      throw new Error('sink emit boom');
    },
  };
}

function baseDeps(over: Partial<RunSweepDeps>): RunSweepDeps {
  return {
    directory: directory([{ userId: 'u1', role: 'tenant' }]),
    sink: okSink(),
    cache: new InMemoryIdempotencyCache(),
    db: emptyDb(),
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env['PROACTIVE_TRIGGERS_PROD_ADAPTERS'];
  delete process.env['NODE_ENV'];
});

describe('entrypoint main() — BLOCKER #4', () => {
  it('runs at least one sweep and emits the trigger (one-shot, exits)', async () => {
    const sink = okSink();
    const deps = baseDeps({ sink });

    const { handle } = await main({ deps, intervalMs: 0 });

    // One-shot mode returns a null handle (process would exit naturally).
    expect(handle).toBeNull();
    // The sweep actually ran end-to-end: the synthetic trigger reached the
    // sink. Before the fix, `node dist/index.js` only loaded exports — zero
    // sweeps, zero emits.
    expect(sink.emitted).toHaveLength(1);
    expect(sink.emitted[0]?.id).toBe('trig-synthetic-1');
  });

  it('marks the fired trigger seen on success so a re-sweep suppresses it', async () => {
    const cache = new InMemoryIdempotencyCache();
    const sink = okSink();
    const deps = baseDeps({ sink, cache });

    await main({ deps, intervalMs: 0 });
    expect(sink.emitted).toHaveLength(1);

    // Second sweep: idempotency cache now has the key — no re-emit.
    const summary2 = await runHourlySweep(deps);
    expect(sink.emitted).toHaveLength(1);
    expect(summary2.triggersSuppressedIdempotent).toBe(1);
    expect(summary2.triggersFired).toBe(0);
  });
});

describe('failed emit — HIGH #8', () => {
  it('does NOT markSeen on a failed emit, increments triggersDropped, and retries next sweep', async () => {
    const cache = new InMemoryIdempotencyCache();
    const sink = throwingSink();
    const raised: Array<{ tenantId: string; droppedCount: number }> = [];
    const staffAlertSink: StaffAlertSink = {
      async raise(args) {
        raised.push({ tenantId: args.tenantId, droppedCount: args.droppedCount });
      },
    };
    const deps = baseDeps({ sink, cache, staffAlertSink });

    const summary = await runHourlySweep(deps);

    // A failed emit must NOT be counted fired...
    expect(summary.triggersFired).toBe(0);
    // ...must be counted dropped...
    expect(summary.triggersDropped).toBe(1);
    // ...must leave the key UNSEEN so the next sweep retries it...
    expect(cache.hasSeenRecently('trig-synthetic-1', 24)).toBe(false);
    // ...and must raise exactly one staff alert for the tenant.
    expect(raised).toHaveLength(1);
    expect(raised[0]?.droppedCount).toBe(1);

    // Next sweep retries (not permanently suppressed). Still drops because
    // the sink still throws — proving the trigger was never suppressed.
    const summary2 = await runHourlySweep(deps);
    expect(summary2.triggersDropped).toBe(1);
    expect(summary2.triggersSuppressedIdempotent).toBe(0);
  });
});

describe('prod-readiness fail-fast — buildProductionDeps', () => {
  it('THROWS when prod adapters are required but no db can be resolved', async () => {
    await expect(
      buildProductionDeps({ db: null, requireProdAdapters: true }),
    ).rejects.toThrow(/production adapters are required/i);
  });

  it('returns a benign null no-op when prod adapters are NOT required', async () => {
    const deps = await buildProductionDeps({
      db: null,
      requireProdAdapters: false,
    });
    expect(deps).toBeNull();
  });

  it('treats NODE_ENV=production as prod-adapters-required (fail-fast)', async () => {
    process.env['NODE_ENV'] = 'production';
    await expect(buildProductionDeps({ db: null })).rejects.toThrow(
      /production adapters are required/i,
    );
  });

  it('treats PROACTIVE_TRIGGERS_PROD_ADAPTERS=1 as prod-adapters-required', async () => {
    process.env['PROACTIVE_TRIGGERS_PROD_ADAPTERS'] = '1';
    await expect(buildProductionDeps({ db: null })).rejects.toThrow(
      /production adapters are required/i,
    );
  });
});
