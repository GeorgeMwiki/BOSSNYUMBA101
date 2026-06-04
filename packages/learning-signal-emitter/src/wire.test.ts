/**
 * Wire tests — the composition-root facade.
 *
 * Verifies:
 *   (a) the FLAG constant is the canonical BOSSNYUMBA_FEATURE_* name,
 *   (b) wire returns null when enabled:false (default-OFF),
 *   (c) wire returns a bound facade when enabled:true,
 *   (d) the facade emits a happy-path signal end-to-end, and
 *   (e) the facade rejects a malformed input via the zod boundary without
 *       throwing.
 */

import { describe, it, expect } from 'vitest';

import {
  wireLearningSignalEmitter,
  LEARNING_SIGNAL_EMITTER_FLAG,
  type WireLearningSignalEmitterDeps,
} from './wire.js';
import { createInMemorySignalStore } from './in-memory-store.js';
import type { SignalSinks } from './ports.js';
import type { ActionEvent, OutcomeEvent } from './types.js';

function action(overrides: Partial<ActionEvent> = {}): ActionEvent {
  return {
    id: 'a-1',
    kind: 'decide',
    capturedAt: '2026-06-03T00:00:00.000Z',
    actorId: 'mgr-1',
    actorTier: 'manager',
    payload: {},
    tenantUserId: 'owner-1',
    ...overrides,
  };
}

function outcome(overrides: Partial<OutcomeEvent> = {}): OutcomeEvent {
  return {
    id: 'o-1',
    actionRef: 'a-1',
    observedAt: '2026-06-03T00:05:00.000Z',
    ...overrides,
  };
}

function sinks(calls: string[]): SignalSinks {
  return {
    masteryUpdate: async () => {
      calls.push('mastery');
      return true;
    },
  };
}

function baseDeps(enabled: boolean, calls: string[] = []): WireLearningSignalEmitterDeps {
  return {
    enabled,
    sinks: sinks(calls),
    store: createInMemorySignalStore(),
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(LEARNING_SIGNAL_EMITTER_FLAG).toBe(
      'BOSSNYUMBA_FEATURE_LEARNING_SIGNAL_EMITTER',
    );
  });
});

describe('wireLearningSignalEmitter — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireLearningSignalEmitter(baseDeps(false))).toBeNull();
  });

  it('returns a bound emitter when the flag is enabled', () => {
    const emitter = wireLearningSignalEmitter(baseDeps(true));
    expect(emitter).not.toBeNull();
    expect(typeof emitter?.handle).toBe('function');
  });
});

describe('wireLearningSignalEmitter — bound handle', () => {
  it('emits a happy-path signal through the facade', async () => {
    const calls: string[] = [];
    const emitter = wireLearningSignalEmitter(baseDeps(true, calls));
    const result = await emitter!.handle({
      action: action(),
      outcome: outcome({ slaDelaySeconds: -300, explicitSatisfaction: 1 }),
    });
    expect(result.signal.tenantScope).toBe('user');
    expect(result.routedTo).toContain('mastery-tracker');
    expect(calls).toContain('mastery');
  });

  it('rejects a malformed input via the zod boundary without throwing', async () => {
    const emitter = wireLearningSignalEmitter(baseDeps(true));
    // Missing required action fields (id/actorId/...). Must not throw.
    const result = await emitter!.handle({
      // @ts-expect-error — deliberately malformed to exercise the boundary.
      action: { kind: 'decide' },
      // @ts-expect-error — deliberately malformed to exercise the boundary.
      outcome: {},
    });
    expect(result.routedTo).toEqual(['no-route']);
    expect(result.notes[0]).toMatch(/validation blocked/);
  });
});
