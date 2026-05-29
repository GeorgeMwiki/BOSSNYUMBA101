/**
 * tab-suggester runner — orchestration test. Uses in-memory stubs for
 * observation accessor + persistence so we lock the dedup + insert flow
 * without touching the database.
 */

import { describe, expect, it, vi } from 'vitest';

import { runTabSuggesterTick } from '../runner.js';
import type {
  DrillDownObservation,
  MwikilaObservation,
  NavigationObservation,
} from '../detectors.js';

const NOW = new Date('2026-05-29T12:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

function makeRunnerArgs(opts: {
  drills?: ReadonlyArray<DrillDownObservation>;
  navs?: ReadonlyArray<NavigationObservation>;
  mws?: ReadonlyArray<MwikilaObservation>;
  cooldownReturns?: boolean;
}) {
  const insertProposal = vi.fn(async () => 'proposal-id-1');
  const hasActiveOrCooldown = vi.fn(
    async () => opts.cooldownReturns ?? false,
  );
  return {
    insertProposal,
    hasActiveOrCooldown,
    args: {
      tenantId: 't1',
      userId: 'u1',
      now: NOW,
      observations: {
        drillDowns: async () => opts.drills ?? [],
        navigations: async () => opts.navs ?? [],
        mwikilaActions: async () => opts.mws ?? [],
      },
      persistence: {
        hasActiveOrCooldown,
        insertProposal,
      },
    } as const,
  };
}

describe('runTabSuggesterTick', () => {
  it('returns no candidates when there is no signal', async () => {
    const { args } = makeRunnerArgs({});
    const result = await runTabSuggesterTick(args);
    expect(result.created).toHaveLength(0);
    expect(result.skipped.length).toBe(3);
  });

  it('inserts a proposal on a strong drill-down repeat', async () => {
    const drills: DrillDownObservation[] = Array.from(
      { length: 4 },
      (_, i) => ({
        id: `obs-${i}`,
        tabType: 'rent',
        focus: 'Mwenge T-23',
        occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
      }),
    );
    const { insertProposal, args } = makeRunnerArgs({ drills });
    const result = await runTabSuggesterTick(args);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]?.detector).toBe('drill_down_repeat');
    expect(insertProposal).toHaveBeenCalledOnce();
  });

  it('skips insert when dedup says we already have an active proposal', async () => {
    const drills: DrillDownObservation[] = Array.from(
      { length: 4 },
      (_, i) => ({
        id: `obs-${i}`,
        tabType: 'rent',
        focus: 'Mwenge T-23',
        occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
      }),
    );
    const { insertProposal, args } = makeRunnerArgs({
      drills,
      cooldownReturns: true,
    });
    const result = await runTabSuggesterTick(args);
    expect(result.created).toHaveLength(0);
    expect(insertProposal).not.toHaveBeenCalled();
    expect(result.skipped.some((s) => s.reason === 'dedup')).toBe(true);
  });
});
