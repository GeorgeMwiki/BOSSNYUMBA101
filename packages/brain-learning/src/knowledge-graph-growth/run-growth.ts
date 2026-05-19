/**
 * runKGGrowthCycle — daily orchestrator for KG growth + pruning.
 *
 * Steps:
 *   1. Ingest pending observations (from PI-A, Reflexion, decision events)
 *   2. Apply edge decay for edges older than half-life
 *   3. Archive nodes with no touched edge in ORPHAN_NODE_ARCHIVE_DAYS
 *   4. If node count > ceiling: evict oldest-archived first
 */

import type { KGGrowthResult } from '../types.js';
import {
  decayConfidence,
  defaultGrowthConfig,
  type KGGrowthConfig,
} from './growth-config.js';

export interface KGObservationCandidate {
  readonly subjectId: string;
  readonly predicate: string;
  readonly objectId: string;
  readonly sourceConfidence: number;
  readonly observedAt: Date;
}

export interface KGEdgeForDecay {
  readonly edgeId: string;
  readonly currentConfidence: number;
  readonly lastTouchedAt: Date;
}

export interface KGNodeForArchive {
  readonly nodeId: string;
  readonly lastEdgeAt: Date | null;
}

/**
 * Port over K-D TemporalKG.
 */
export interface TemporalKGPort {
  listPendingObservations(args: {
    tenantId: string;
  }): Promise<ReadonlyArray<KGObservationCandidate>>;
  insertObservations(args: {
    tenantId: string;
    observations: ReadonlyArray<KGObservationCandidate>;
  }): Promise<{ nodesAdded: number; edgesAdded: number }>;
  listEdgesForDecay(args: {
    tenantId: string;
    olderThan: Date;
  }): Promise<ReadonlyArray<KGEdgeForDecay>>;
  updateEdgeConfidence(args: {
    edgeId: string;
    newConfidence: number;
  }): Promise<void>;
  listOrphanNodes(args: {
    tenantId: string;
    olderThan: Date;
  }): Promise<ReadonlyArray<KGNodeForArchive>>;
  archiveNode(args: { nodeId: string }): Promise<void>;
  evictOldestArchived(args: {
    tenantId: string;
    count: number;
  }): Promise<number>;
  countLiveNodes(args: { tenantId: string }): Promise<number>;
}

export interface KGGrowthPorts {
  readonly kg: TemporalKGPort;
  readonly clock: () => Date;
  readonly config?: KGGrowthConfig;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Public entrypoint. Daily-cadence by design.
 */
export async function runKGGrowthCycle(
  ports: KGGrowthPorts,
  args: { tenantId: string },
): Promise<KGGrowthResult> {
  const config = ports.config ?? defaultGrowthConfig();
  const now = ports.clock();

  // ── 1. Ingest pending observations ──
  const observations = await ports.kg.listPendingObservations({
    tenantId: args.tenantId,
  });
  const { nodesAdded, edgesAdded } = await ports.kg.insertObservations({
    tenantId: args.tenantId,
    observations,
  });

  // ── 2. Decay edges older than half-life ──
  const halfLifeCutoff = new Date(
    now.getTime() - config.edgeHalfLifeDays * MS_PER_DAY,
  );
  const decayCandidates = await ports.kg.listEdgesForDecay({
    tenantId: args.tenantId,
    olderThan: halfLifeCutoff,
  });
  let edgesDecayed = 0;
  for (const edge of decayCandidates) {
    const ageDays =
      (now.getTime() - edge.lastTouchedAt.getTime()) / MS_PER_DAY;
    const newConfidence = decayConfidence({
      currentConfidence: edge.currentConfidence,
      ageDays,
      halfLifeDays: config.edgeHalfLifeDays,
    });
    await ports.kg.updateEdgeConfidence({
      edgeId: edge.edgeId,
      newConfidence,
    });
    edgesDecayed += 1;
  }

  // ── 3. Archive orphan nodes (no touched edge in N days) ──
  const orphanCutoff = new Date(
    now.getTime() - config.orphanArchiveDays * MS_PER_DAY,
  );
  const orphans = await ports.kg.listOrphanNodes({
    tenantId: args.tenantId,
    olderThan: orphanCutoff,
  });
  for (const node of orphans) {
    await ports.kg.archiveNode({ nodeId: node.nodeId });
  }
  const nodesArchived = orphans.length;

  // ── 4. Ceiling enforcement ──
  const liveCount = await ports.kg.countLiveNodes({
    tenantId: args.tenantId,
  });
  let evictedDueToCeiling = 0;
  let ceilingHit = false;
  if (liveCount > config.perTenantNodeCeiling) {
    ceilingHit = true;
    const toEvict = liveCount - config.perTenantNodeCeiling;
    evictedDueToCeiling = await ports.kg.evictOldestArchived({
      tenantId: args.tenantId,
      count: toEvict,
    });
  }

  return Object.freeze({
    tenantId: args.tenantId,
    nodesAdded,
    edgesAdded,
    edgesDecayed,
    nodesArchived,
    evictedDueToCeiling,
    ceilingHit,
  });
}
