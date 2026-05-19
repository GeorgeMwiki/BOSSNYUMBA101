/**
 * Pipeline integration tests (8 fixtures).
 *
 * Each test wires the full set of dependencies (heuristic
 * implementations + in-memory sovereign ledger) and verifies:
 *   - The right modules run / skip
 *   - The aggregate verdict
 *   - Sovereign-ledger emits one entry per module + a pipeline entry
 */

import { describe, expect, it } from 'vitest';
import { verifyBeforeAction } from '../pipeline.js';
import {
  evidenceAnswerer,
  type AnswererPort,
} from '../../cove/independent-answerer.js';
import { heuristicCritic } from '../../self-refine/critic.js';
import { heuristicRefiner } from '../../self-refine/refiner.js';
import { createConstitutionalGate } from '../../constitutional-gate/gate.js';
import { heuristicConstitutionalCritic } from '../../constitutional-gate/heuristic-critic.js';
import { functionSampler } from '../../self-consistency/sampler.js';
import { heuristicPersona } from '../../debate/persona-port.js';
import { InMemorySovereignLedger } from '../../ports/sovereign-ledger.js';
import { fixedClock } from '../../ports/clock.js';
import type { PipelineAction } from '../../types.js';

function buildAnswerer(): AnswererPort {
  return evidenceAnswerer({
    lookup: (claim) => {
      // Stable answers — always confirm with high confidence unless the
      // claim contains 'fake' or 'NotReal'.
      if (/fake|notreal|imaginary/i.test(claim.text)) {
        return { answer: `No record matching ${claim.text}.`, confidence: 0.85 };
      }
      return {
        answer: `Confirmed: ${claim.text}`,
        confidence: 0.9,
      };
    },
  });
}

function buildDeps(opts: { sample: number } = { sample: 100 }) {
  return {
    cove: {
      answerer: buildAnswerer(),
      clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
    },
    selfRefine: {
      critic: heuristicCritic(),
      refiner: heuristicRefiner(),
      clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
    },
    constitutional: createConstitutionalGate({
      critic: heuristicConstitutionalCritic(),
      clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
    }),
    consistency: {
      sampler: functionSampler(() => opts.sample),
      clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
      n: 5,
      bucketDecimals: 0,
    },
    debate: {
      persona: heuristicPersona(),
      clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
      rounds: 2 as const,
    },
    ledger: new InMemorySovereignLedger(),
    clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
    // Deterministic random: 0.5 > 0.05 sample rate so non-destructive
    // actions never get sampled into Constitutional.
    random: () => 0.5,
  };
}

describe('verifyBeforeAction — integration', () => {
  it('skips all modules when no inputs supplied (non-destructive)', async () => {
    const action: PipelineAction = {
      id: 'a_1',
      tenantId: 'T-1',
      actionClass: 'rent-reminder',
      destructive: false,
    };
    const deps = buildDeps();
    const result = await verifyBeforeAction(action, deps);
    expect(result.skipped).toContain('cove');
    expect(result.skipped).toContain('self-refine');
    expect(result.skipped).toContain('self-consistency');
    expect(result.skipped).toContain('constitutional');
    expect(result.skipped).toContain('debate');
    expect(result.verdict).toBe('pass');
  });

  it('runs CoVe when factualDraft present', async () => {
    const action: PipelineAction = {
      id: 'a_2',
      tenantId: 'T-1',
      actionClass: 'rent-reminder',
      destructive: false,
      factualDraft: 'Your rent of KES 50,000 is due on 1 May 2026.',
      factClass: 'amount',
    };
    const deps = buildDeps();
    const result = await verifyBeforeAction(action, deps);
    expect(result.verifiedDraft).not.toBeNull();
    expect(result.skipped).not.toContain('cove');
  });

  it('runs Self-Refine when messageDraft present', async () => {
    const action: PipelineAction = {
      id: 'a_3',
      tenantId: 'T-1',
      actionClass: 'rent-reminder',
      destructive: false,
      messageDraft:
        'Dear Mr John Otieno, your rent of KES 50,000 due on 1 May 2026 remains unpaid.',
      context: { tenantJurisdiction: 'TZ-DSM' },
    };
    const deps = buildDeps();
    const result = await verifyBeforeAction(action, deps);
    expect(result.refinedMessage).not.toBeNull();
    expect(result.skipped).not.toContain('self-refine');
  });

  it('runs Self-Consistency when numericPrompt present', async () => {
    const action: PipelineAction = {
      id: 'a_4',
      tenantId: 'T-1',
      actionClass: 'late-fee-compute',
      destructive: false,
      numericValue: 2500,
      numericPrompt: 'Compute late fee for KES 50,000 at 5%.',
    };
    const deps = buildDeps({ sample: 2500 });
    const result = await verifyBeforeAction(action, deps);
    expect(result.consistency).not.toBeNull();
    expect(result.consistency?.value).toBe(2500);
    expect(result.skipped).not.toContain('self-consistency');
  });

  it('Constitutional REQUIRED for destructive (no sampling)', async () => {
    const action: PipelineAction = {
      id: 'a_5',
      tenantId: 'T-1',
      actionClass: 'eviction',
      destructive: true,
      messageDraft:
        'Dear Mr John Otieno, this is the statutory 14-day notice for non-payment of TZS 120,000 since 1 March 2026.',
      context: {
        tenantJurisdiction: 'TZ-DSM',
        no_statutory_notice: false,
        hardship_request_open: false,
        recovery_probability: 0.85,
        operational_burden: 'low',
      },
    };
    const deps = buildDeps();
    const result = await verifyBeforeAction(action, deps);
    expect(result.constitutional).not.toBeNull();
    expect(result.constitutional?.required).toBe(true);
    expect(result.skipped).not.toContain('constitutional');
  });

  it('Constitutional sampled 5% for non-destructive — deterministic random=0.99 → SKIP', async () => {
    const action: PipelineAction = {
      id: 'a_6',
      tenantId: 'T-1',
      actionClass: 'rent-reminder',
      destructive: false,
      messageDraft: 'Pay your rent.',
    };
    const deps = { ...buildDeps(), random: () => 0.99 };
    const result = await verifyBeforeAction(action, deps);
    expect(result.constitutional).toBeNull();
    expect(result.skipped).toContain('constitutional');
  });

  it('Constitutional sampled 5% — deterministic random=0.01 → RUN', async () => {
    const action: PipelineAction = {
      id: 'a_7',
      tenantId: 'T-1',
      actionClass: 'rent-reminder',
      destructive: false,
      messageDraft: 'Pay your rent.',
    };
    const deps = { ...buildDeps(), random: () => 0.01 };
    const result = await verifyBeforeAction(action, deps);
    expect(result.constitutional).not.toBeNull();
  });

  it('Eviction action exercises ALL modules + ledger has 6 entries', async () => {
    const ledger = new InMemorySovereignLedger();
    const action: PipelineAction = {
      id: 'a_evict',
      tenantId: 'T-evict',
      actionClass: 'eviction',
      destructive: true,
      factualDraft:
        'Mr John Otieno at Plot 7 Unit 12B owes TZS 120,000 since 1 March 2026.',
      factClass: 'amount',
      messageDraft:
        'Dear Mr John Otieno, this is the statutory 14-day notice for non-payment of TZS 120,000 since 1 March 2026.',
      numericPrompt: 'Compute late fee on TZS 120,000 at 5%.',
      context: {
        tenantJurisdiction: 'TZ-DSM',
        no_statutory_notice: false,
        hardship_request_open: false,
        recovery_probability: 0.85,
        operational_burden: 'low',
      },
    };
    const deps = { ...buildDeps({ sample: 6000 }), ledger };
    const result = await verifyBeforeAction(action, deps);
    expect(result.verifiedDraft).not.toBeNull();
    expect(result.refinedMessage).not.toBeNull();
    expect(result.consistency).not.toBeNull();
    expect(result.constitutional).not.toBeNull();
    expect(result.debate).not.toBeNull();
    expect(result.skipped).toHaveLength(0);
    // 5 module entries + 1 pipeline entry
    expect(ledger.list()).toHaveLength(6);
  });
});

describe('verifyBeforeAction — performance bounds', () => {
  it('eviction pipeline returns in well under 8s p95', async () => {
    // Heuristic-only path — must be very fast.
    const action: PipelineAction = {
      id: 'a_perf',
      tenantId: 'T-perf',
      actionClass: 'eviction',
      destructive: true,
      factualDraft: 'Mr John Otieno owes TZS 100,000 since 1 May 2026.',
      factClass: 'amount',
      messageDraft:
        'Dear Mr John Otieno, this is the statutory 14-day notice.',
      numericPrompt: 'Compute late fee TZS 100,000 at 5%.',
      context: {
        tenantJurisdiction: 'TZ-DSM',
        no_statutory_notice: false,
        hardship_request_open: false,
        recovery_probability: 0.85,
        operational_burden: 'low',
      },
    };
    const start = Date.now();
    const deps = { ...buildDeps({ sample: 5000 }), random: () => 0.5 };
    await verifyBeforeAction(action, deps);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  it('warm pipeline (cached / heuristic) runs in well under 3s', async () => {
    // Run twice to "warm".
    const deps = { ...buildDeps({ sample: 5000 }), random: () => 0.5 };
    const action: PipelineAction = {
      id: 'a_warm',
      tenantId: 'T-warm',
      actionClass: 'rent-reminder',
      destructive: false,
      messageDraft: 'Pay rent.',
    };
    await verifyBeforeAction(action, deps);
    const start = Date.now();
    await verifyBeforeAction({ ...action, id: 'a_warm_2' }, deps);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
