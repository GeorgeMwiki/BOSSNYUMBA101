/**
 * wire.test.ts — the default-OFF composition seam.
 *
 * Asserts the flag name, the null-when-disabled contract, the bound facade
 * when enabled, a happy-path handle, and that a malformed claim is rejected at
 * the zod boundary without throwing.
 */

import { describe, it, expect } from 'vitest';

import {
  wireBeliefEngine,
  BELIEF_ENGINE_FLAG,
  type WireBeliefEngineDeps,
} from './wire';
import { createInMemoryBeliefStore } from './in-memory-store';
import type { BeliefAuditSink } from './ports';
import type { ExtractedClaim } from './types';

const FIXED = new Date('2026-06-03T00:00:00.000Z');

function validClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    subject: 'kinondoni-2br-rent-comparable',
    description: 'Believed market rent for a Kinondoni 2BR',
    proposedValue: { kind: 'scalar', scalar: 650000, unit: 'TZS/mo' },
    evidenceFromTurn: 'comparable 2BRs are letting around 650k a month',
    confidence: 0.7,
    conversationId: 'conv-1',
    turnId: 'turn-1',
    portal: 'owner',
    domain: 'market-prices',
    subjectUserId: null,
    subjectOrgId: null,
    ...overrides,
  };
}

function baseDeps(
  enabled: boolean,
  audit?: BeliefAuditSink,
): WireBeliefEngineDeps {
  return {
    enabled,
    store: createInMemoryBeliefStore(),
    clock: { now: () => FIXED },
    idFactory: () => 'belief-1',
    ...(audit ? { audit } : {}),
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(BELIEF_ENGINE_FLAG).toBe('BOSSNYUMBA_FEATURE_BELIEF_ENGINE');
  });
});

describe('wireBeliefEngine — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireBeliefEngine(baseDeps(false))).toBeNull();
  });

  it('returns a bound engine when the flag is enabled', () => {
    const engine = wireBeliefEngine(baseDeps(true));
    expect(engine).not.toBeNull();
    expect(typeof engine?.handle).toBe('function');
  });
});

describe('wireBeliefEngine — bound handle', () => {
  it('handles a happy-path claim (creates a belief via reviseBelief)', async () => {
    const engine = wireBeliefEngine(baseDeps(true));
    const out = await engine!.handle(validClaim());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.priorBelief).toBeNull();
      expect(out.result.action).toBe('strengthen');
      expect(out.result.newBelief.id).toBe('belief-1');
      expect(out.result.newBelief.subject).toBe(
        'kinondoni-2br-rent-comparable',
      );
    }
  });

  it('rejects a malformed claim at the zod boundary without throwing', async () => {
    const engine = wireBeliefEngine(baseDeps(true));
    // confidence out of range + empty subject — must not throw.
    const malformed = {
      ...validClaim(),
      subject: '',
      confidence: 5,
    } as ExtractedClaim;
    const out = await engine!.handle(malformed);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain('invalid claim');
  });

  it('emits a fire-and-forget audit entry on a handled claim', async () => {
    const entries: string[] = [];
    const audit: BeliefAuditSink = {
      log: (e) => {
        entries.push(e.event);
      },
    };
    const engine = wireBeliefEngine(baseDeps(true, audit));
    await engine!.handle(validClaim());
    expect(entries).toContain('belief.strengthen');
  });

  it('never lets a throwing audit sink break the belief path', async () => {
    const audit: BeliefAuditSink = {
      log: () => {
        throw new Error('sink exploded');
      },
    };
    const engine = wireBeliefEngine(baseDeps(true, audit));
    const out = await engine!.handle(validClaim());
    expect(out.ok).toBe(true);
  });
});
