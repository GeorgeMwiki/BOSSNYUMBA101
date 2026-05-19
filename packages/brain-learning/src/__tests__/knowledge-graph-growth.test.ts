/**
 * knowledge-graph-growth tests.
 *
 * Covers decay function, conflict resolution, daily orchestrator,
 * 365d orphan archival, and per-tenant ceiling eviction.
 */

import { describe, it, expect } from 'vitest';
import {
  runKGGrowthCycle,
  decayConfidence,
  resolveKGConflict,
  defaultGrowthConfig,
  EDGE_HALF_LIFE_DAYS,
  ORPHAN_NODE_ARCHIVE_DAYS,
  DEFAULT_PER_TENANT_NODE_CEILING,
  type TemporalKGPort,
  type KGGrowthPorts,
  type KGObservationCandidate,
  type KGEdgeForDecay,
  type KGNodeForArchive,
} from '../knowledge-graph-growth/index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-19T08:00:00Z');

function mkKG(opts?: {
  pending?: KGObservationCandidate[];
  decay?: KGEdgeForDecay[];
  orphans?: KGNodeForArchive[];
  liveCount?: number;
  evictResult?: number;
}): TemporalKGPort & {
  __confidenceUpdates: Array<{ edgeId: string; newConfidence: number }>;
  __archived: string[];
} {
  const confidenceUpdates: Array<{ edgeId: string; newConfidence: number }> = [];
  const archived: string[] = [];
  return {
    __confidenceUpdates: confidenceUpdates,
    __archived: archived,
    listPendingObservations: async () => opts?.pending ?? [],
    insertObservations: async (args) => ({
      nodesAdded: args.observations.length * 2,
      edgesAdded: args.observations.length,
    }),
    listEdgesForDecay: async () => opts?.decay ?? [],
    updateEdgeConfidence: async (args) => {
      confidenceUpdates.push(args);
    },
    listOrphanNodes: async () => opts?.orphans ?? [],
    archiveNode: async (args) => {
      archived.push(args.nodeId);
    },
    evictOldestArchived: async () => opts?.evictResult ?? 0,
    countLiveNodes: async () => opts?.liveCount ?? 0,
  };
}

function mkPorts(opts?: Parameters<typeof mkKG>[0]): KGGrowthPorts & {
  __kg: ReturnType<typeof mkKG>;
} {
  const kg = mkKG(opts);
  return {
    kg,
    clock: () => NOW,
    __kg: kg,
  };
}

// ─────────────────────── decay function ──────────────────────────

describe('decayConfidence', () => {
  it('confidence halves at exactly one half-life', () => {
    expect(
      decayConfidence({
        currentConfidence: 1,
        ageDays: EDGE_HALF_LIFE_DAYS,
        halfLifeDays: EDGE_HALF_LIFE_DAYS,
      }),
    ).toBeCloseTo(0.5, 6);
  });

  it('confidence quartered at two half-lives', () => {
    expect(
      decayConfidence({
        currentConfidence: 1,
        ageDays: EDGE_HALF_LIFE_DAYS * 2,
        halfLifeDays: EDGE_HALF_LIFE_DAYS,
      }),
    ).toBeCloseTo(0.25, 6);
  });

  it('no decay at age 0', () => {
    expect(
      decayConfidence({
        currentConfidence: 0.9,
        ageDays: 0,
        halfLifeDays: EDGE_HALF_LIFE_DAYS,
      }),
    ).toBe(0.9);
  });

  it('returns input when halfLifeDays is 0 (guard)', () => {
    expect(
      decayConfidence({
        currentConfidence: 0.7,
        ageDays: 100,
        halfLifeDays: 0,
      }),
    ).toBe(0.7);
  });
});

// ─────────────────────── conflict resolution ─────────────────────

describe('resolveKGConflict', () => {
  it('higher source-confidence wins', () => {
    const a = {
      sourceConfidence: 0.9,
      observedAt: new Date('2026-01-01'),
      content: 'A',
    };
    const b = {
      sourceConfidence: 0.7,
      observedAt: new Date('2026-05-01'),
      content: 'B',
    };
    expect(resolveKGConflict(a, b).content).toBe('A');
  });

  it('more recent wins when confidence ties', () => {
    const a = {
      sourceConfidence: 0.8,
      observedAt: new Date('2026-01-01'),
      content: 'A',
    };
    const b = {
      sourceConfidence: 0.8,
      observedAt: new Date('2026-05-01'),
      content: 'B',
    };
    expect(resolveKGConflict(a, b).content).toBe('B');
  });
});

// ─────────────────────── constants ───────────────────────────────

describe('config constants', () => {
  it('half-life = 180d, orphan archive = 365d, ceiling = 50k', () => {
    expect(EDGE_HALF_LIFE_DAYS).toBe(180);
    expect(ORPHAN_NODE_ARCHIVE_DAYS).toBe(365);
    expect(DEFAULT_PER_TENANT_NODE_CEILING).toBe(50_000);
  });

  it('default config returns frozen defaults', () => {
    const cfg = defaultGrowthConfig();
    expect(cfg.edgeHalfLifeDays).toBe(180);
    expect(cfg.orphanArchiveDays).toBe(365);
    expect(cfg.perTenantNodeCeiling).toBe(50_000);
  });
});

// ─────────────────────── cycle orchestrator ──────────────────────

describe('runKGGrowthCycle', () => {
  it('ingests observations and reports counts', async () => {
    const ports = mkPorts({
      pending: [
        mkObs('p1', 'r1'),
        mkObs('p2', 'r2'),
      ],
      liveCount: 100,
    });
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.nodesAdded).toBe(4);
    expect(result.edgesAdded).toBe(2);
  });

  it('archives orphan nodes after 365 days', async () => {
    const ports = mkPorts({
      orphans: [
        { nodeId: 'n1', lastEdgeAt: new Date('2024-01-01') },
        { nodeId: 'n2', lastEdgeAt: new Date('2024-02-01') },
      ],
      liveCount: 100,
    });
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.nodesArchived).toBe(2);
    expect(ports.__kg.__archived).toEqual(['n1', 'n2']);
  });

  it('decays old edges', async () => {
    const ports = mkPorts({
      decay: [
        {
          edgeId: 'e1',
          currentConfidence: 1.0,
          lastTouchedAt: new Date('2025-05-19T08:00:00Z'), // 365 days ago — 2 half-lives
        },
      ],
      liveCount: 100,
    });
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.edgesDecayed).toBe(1);
    // 365 days at 180-day half-life = 2.027 half-lives → 0.5^2.027 ≈ 0.245.
    expect(ports.__kg.__confidenceUpdates[0].newConfidence).toBeCloseTo(
      0.245,
      2,
    );
  });

  it('triggers ceiling eviction when liveCount > ceiling', async () => {
    const ports: KGGrowthPorts & { __kg: ReturnType<typeof mkKG> } = {
      kg: mkKG({
        liveCount: 50_010,
        evictResult: 10,
      }),
      clock: () => NOW,
      config: defaultGrowthConfig({ perTenantNodeCeiling: 50_000 }),
      __kg: undefined as never,
    };
    (ports as { __kg: typeof ports.kg }).__kg = ports.kg as ReturnType<
      typeof mkKG
    >;
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.ceilingHit).toBe(true);
    expect(result.evictedDueToCeiling).toBe(10);
  });

  it('no ceiling hit under the limit', async () => {
    const ports = mkPorts({ liveCount: 100 });
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.ceilingHit).toBe(false);
    expect(result.evictedDueToCeiling).toBe(0);
  });

  it('configurable ceiling override is honoured', async () => {
    const baseConfig = defaultGrowthConfig({ perTenantNodeCeiling: 10 });
    const kg = mkKG({ liveCount: 12, evictResult: 2 });
    const ports: KGGrowthPorts = {
      kg,
      clock: () => NOW,
      config: baseConfig,
    };
    const result = await runKGGrowthCycle(ports, { tenantId: TENANT });
    expect(result.ceilingHit).toBe(true);
    expect(result.evictedDueToCeiling).toBe(2);
  });
});

function mkObs(subjectId: string, objectId: string): KGObservationCandidate {
  return {
    subjectId,
    predicate: 'related_to',
    objectId,
    sourceConfidence: 0.85,
    observedAt: new Date('2026-05-19'),
  };
}
