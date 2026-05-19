/**
 * Integration tests — Phase N-E
 *
 * 15 multi-module flows exercising:
 *   - trace → owner reaction → pair flow
 *   - active-learning → label → pair flow
 *   - eval cycle → failed scenario → pair flow
 *   - skill curation full lifecycle (draft → promoted, with HITL)
 *   - KG growth → ceiling → eviction
 *   - distilled-student infra resolution
 *   - cycle-tracker aggregation across all 8 other modules
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Module 1
  logTrace,
  makeRedactionPipeline,
  // Module 2
  captureReaction,
  // Module 3
  buildPreferencePairs,
  pairToJsonlRow,
  // Module 4
  enqueueActiveLearningItem,
  buildDailyDigest,
  recordDecline,
  // Module 5
  runEvalCycle,
  // Module 6
  runSkillCuration,
  // Module 7
  runKGGrowthCycle,
  defaultGrowthConfig,
  // Module 8
  resolveStudentClient,
  // Module 9
  buildWeeklyDigest,
  renderCapabilityCardPayload,
  type FeedbackEvent,
  type ActiveLearningItem,
  type TraceEvent,
  type IStudentModelClient,
  type NcCostCascadeFallback,
  type PreferencePair,
} from '../../index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

// ─────────────────────────── 1 ───────────────────────────────────

describe('Integration 1 — trace logger redacts AND captures consent', () => {
  it('logs a redacted trace and the redaction audit reflects consent layer', async () => {
    const rows: TraceEvent[] = [];
    const ports = {
      redaction: makeRedactionPipeline({
        ml: { redact: vi.fn(async (i) => ({ redacted: i.content, fired: false })) },
        canary: { detect: vi.fn(async () => ({ hits: 0, canaryIds: [] })) },
        config: {
          modelVersion: 'haiku-4.5',
          policyVersion: 'v1',
          clock: () => CLOCK_AT,
        },
      }),
      store: {
        upsertIfAbsent: async (e: TraceEvent) => {
          rows.push(e);
          return { inserted: true };
        },
        exists: async () => false,
      },
      clock: () => CLOCK_AT,
    };
    const result = await logTrace(ports, {
      tenantId: TENANT,
      conversationId: 'c1',
      turnId: 't1',
      turn: 1,
      role: 'owner',
      content: 'send to ada@example.com',
      consentForTraining: false,
      actorId: 'kernel',
    });
    expect(result.inserted).toBe(true);
    expect(rows[0].content).toContain('<email>');
    expect(rows[0].redaction.layersFired).toContain('consent');
  });
});

// ─────────────────────────── 2 ───────────────────────────────────

describe('Integration 2 — owner reaction → preference pair flow (DPO)', () => {
  it('regenerated + accepted → DPO pair via preference-pair-builder', async () => {
    const feedback: FeedbackEvent[] = [
      {
        tenantId: TENANT,
        turnId: 'turn-A',
        kind: 'regenerated',
        payload: { kind: 'regenerated', newContent: 'better v2' },
        capturedAt: CLOCK_AT.toISOString(),
      },
      {
        tenantId: TENANT,
        turnId: 'turn-A',
        kind: 'accepted_as_is',
        payload: { kind: 'accepted_as_is' },
        capturedAt: CLOCK_AT.toISOString(),
      },
    ];
    const result = await buildPreferencePairs(
      {
        feedback: { listSince: async () => feedback },
        content: {
          resolvePrompt: async () => 'original prompt',
          resolveResponse: async () => 'original v1',
        },
        scorer: { scoreResponse: async () => 0.9 },
        clock: () => CLOCK_AT,
      },
      {
        tenantId: TENANT,
        since: new Date('2026-01-01'),
        minPairs: 1,
      },
    );
    expect(result.stats.dpo).toBe(1);
    const pair = result.pairs[0];
    expect(pair.chosen).toBe('better v2');
    expect(pair.rejected).toBe('original v1');
    expect(JSON.parse(pairToJsonlRow(pair)).chosen).toBe('better v2');
  });
});

// ─────────────────────────── 3 ───────────────────────────────────

describe('Integration 3 — captureReaction → feedback store → pair builder reads it', () => {
  it('end-to-end: capture edit, build pair', async () => {
    const rows: FeedbackEvent[] = [];
    const reactionPorts = {
      store: {
        insert: async (e: FeedbackEvent) => {
          rows.push(e);
        },
        listForTurn: async () => rows,
      },
      clock: () => CLOCK_AT,
    };
    await captureReaction(reactionPorts, {
      tenantId: TENANT,
      turnId: 'tX',
      kind: 'edited_by_owner',
      payload: {
        kind: 'edited_by_owner',
        editedContent: 'owner-edited final',
      },
    });
    const result = await buildPreferencePairs(
      {
        feedback: { listSince: async () => rows },
        content: {
          resolvePrompt: async () => 'P',
          resolveResponse: async () => 'brain-draft',
        },
        scorer: { scoreResponse: async () => 0.92 },
        clock: () => CLOCK_AT,
      },
      { tenantId: TENANT, since: new Date('2026-01-01'), minPairs: 1 },
    );
    expect(result.stats.dpo).toBe(1);
    expect(result.pairs[0].chosen).toBe('owner-edited final');
  });
});

// ─────────────────────────── 4 ───────────────────────────────────

describe('Integration 4 — active-learning triggers + anti-fatigue cap', () => {
  it('enqueue + digest respects 25/day cap', async () => {
    const rows: ActiveLearningItem[] = [];
    const queuePorts = {
      store: {
        insert: async (i: ActiveLearningItem) => {
          rows.push(i);
        },
        updateStatus: async () => {},
        incrementDeclineCount: async () => null,
        listPending: async () => rows,
        countAssignedToday: async () => 23,
      },
      clock: () => CLOCK_AT,
    };
    for (let i = 0; i < 5; i++) {
      await enqueueActiveLearningItem(queuePorts, {
        tenantId: TENANT,
        turnId: `t${i}`,
        signals: { verbalisedConfidence: 0.4, prmStepScore: null },
      });
    }
    const digest = await buildDailyDigest(queuePorts, {
      tenantId: TENANT,
      labellerId: 'l1',
    });
    expect(digest.length).toBe(2); // 25 cap - 23 assigned today = 2
  });
});

// ─────────────────────────── 5 ───────────────────────────────────

describe('Integration 5 — repeated decline deprioritises an item', () => {
  it('deprioritises after 3 declines', async () => {
    const rows: ActiveLearningItem[] = [
      {
        tenantId: TENANT,
        turnId: 't1',
        status: 'pending',
        verbalisedConfidence: 0.3,
        prmStepScore: null,
        reason: 'confidence-low',
        queuedAt: CLOCK_AT.toISOString(),
        declineCount: 0,
      },
    ];
    const queuePorts = {
      store: {
        insert: async () => {},
        updateStatus: async () => {},
        incrementDeclineCount: async (args: {
          tenantId: string;
          turnId: string;
        }) => {
          const r = rows.find(
            (x) => x.tenantId === args.tenantId && x.turnId === args.turnId,
          );
          if (!r) return null;
          const updated = { ...r, declineCount: r.declineCount + 1 };
          rows[rows.indexOf(r)] = updated;
          return updated;
        },
        listPending: async () => rows,
        countAssignedToday: async () => 0,
      },
      clock: () => CLOCK_AT,
    };
    let last = await recordDecline(queuePorts, {
      tenantId: TENANT,
      turnId: 't1',
    });
    expect(last.deprioritised).toBe(false);
    last = await recordDecline(queuePorts, { tenantId: TENANT, turnId: 't1' });
    expect(last.deprioritised).toBe(false);
    last = await recordDecline(queuePorts, { tenantId: TENANT, turnId: 't1' });
    expect(last.deprioritised).toBe(true);
    expect(last.newDeclineCount).toBe(3);
  });
});

// ─────────────────────────── 6 ───────────────────────────────────

describe('Integration 6 — eval cycle → failed scenarios become DPO pairs', () => {
  it('feeds 2 failures into pair sink', async () => {
    const sinkPairs: PreferencePair[] = [];
    const result = await runEvalCycle(
      {
        inspect: {
          runAllScenarios: async () => [
            {
              scenarioId: 's1',
              passed: false,
              expectedAction: 'a',
              actualAction: 'b',
              traceId: 'tr1',
            },
            {
              scenarioId: 's2',
              passed: true,
              expectedAction: 'a',
              actualAction: 'a',
              traceId: 'tr2',
            },
            {
              scenarioId: 's3',
              passed: false,
              expectedAction: 'x',
              actualAction: 'y',
              traceId: 'tr3',
            },
          ],
          getRollingPassRate: async () => 0.9,
          resolveScenarioPrompt: async (id) => `prompt-${id}`,
        },
        pairSink: {
          enqueuePairs: async (p) => {
            for (const x of p) sinkPairs.push(x);
          },
        },
        clock: () => CLOCK_AT,
        cycleIdFactory: () => 'c1',
      },
      { tenantId: TENANT },
    );
    expect(result.failedScenarios.length).toBe(2);
    expect(sinkPairs.length).toBe(2);
    expect(sinkPairs[0].chosen).toBe('a');
    expect(sinkPairs[0].rejected).toBe('b');
  });
});

// ─────────────────────────── 7 ───────────────────────────────────

describe('Integration 7 — eval cycle 5pp regression alert fires', () => {
  it('triggers regressionAlert when pass-rate drops sharply', async () => {
    const result = await runEvalCycle(
      {
        inspect: {
          runAllScenarios: async () => [
            { scenarioId: 's1', passed: false, expectedAction: '', actualAction: '', traceId: 't' },
            { scenarioId: 's2', passed: false, expectedAction: '', actualAction: '', traceId: 't' },
            { scenarioId: 's3', passed: true, expectedAction: '', actualAction: '', traceId: 't' },
            { scenarioId: 's4', passed: true, expectedAction: '', actualAction: '', traceId: 't' },
          ],
          getRollingPassRate: async () => 0.95,
          resolveScenarioPrompt: async () => 'p',
        },
        pairSink: { enqueuePairs: async () => {} },
        clock: () => CLOCK_AT,
        cycleIdFactory: () => 'c2',
      },
      { tenantId: TENANT },
    );
    expect(result.regressionAlert).toBe(true);
  });
});

// ─────────────────────────── 8 ───────────────────────────────────

describe('Integration 8 — skill curation auto-quarantine fires', () => {
  it('catastrophic failures quarantine without HITL', async () => {
    const updates: Array<{ skillId: string; lifecycle: string }> = [];
    const result = await runSkillCuration({
      registry: {
        listCurationCandidates: async () => [
          {
            skillId: 'bad-skill',
            tenantId: TENANT,
            lifecycle: 'promoted',
            stats: {
              successfulRuns: 80,
              catastrophicFailures: 4,
              positiveFeedbackRatio: 0.9,
              confidenceTrend: 0.05,
            },
          },
        ],
        setLifecycle: async (args) => {
          updates.push({ skillId: args.skillId, lifecycle: args.lifecycle });
        },
      },
      gate: { requestPromotion: vi.fn() },
      clock: () => CLOCK_AT,
    });
    expect(result.quarantined).toBe(1);
    expect(updates[0].lifecycle).toBe('quarantined');
  });
});

// ─────────────────────────── 9 ───────────────────────────────────

describe('Integration 9 — skill promotion ALWAYS gated by M-F HITL', () => {
  it('promotion is BLOCKED when gate denies', async () => {
    const updates: Array<{ skillId: string; lifecycle: string }> = [];
    const result = await runSkillCuration({
      registry: {
        listCurationCandidates: async () => [
          {
            skillId: 'good-skill',
            tenantId: TENANT,
            lifecycle: 'draft',
            stats: {
              successfulRuns: 50,
              catastrophicFailures: 0,
              positiveFeedbackRatio: 0.9,
              confidenceTrend: 0.05,
            },
          },
        ],
        setLifecycle: async (args) => {
          updates.push({ skillId: args.skillId, lifecycle: args.lifecycle });
        },
      },
      gate: { requestPromotion: async () => false },
      clock: () => CLOCK_AT,
    });
    expect(result.promoted).toBe(0);
    expect(result.promotionsQueuedForHitl).toBe(1);
    expect(updates.length).toBe(0); // no registry write
  });
});

// ─────────────────────────── 10 ──────────────────────────────────

describe('Integration 10 — KG growth archives 365d orphans', () => {
  it('orphan past 365d is archived', async () => {
    const archived: string[] = [];
    const result = await runKGGrowthCycle(
      {
        kg: {
          listPendingObservations: async () => [],
          insertObservations: async () => ({ nodesAdded: 0, edgesAdded: 0 }),
          listEdgesForDecay: async () => [],
          updateEdgeConfidence: async () => {},
          listOrphanNodes: async () => [
            { nodeId: 'old-node', lastEdgeAt: new Date('2024-01-01') },
          ],
          archiveNode: async (args) => {
            archived.push(args.nodeId);
          },
          evictOldestArchived: async () => 0,
          countLiveNodes: async () => 100,
        },
        clock: () => CLOCK_AT,
      },
      { tenantId: TENANT },
    );
    expect(result.nodesArchived).toBe(1);
    expect(archived).toContain('old-node');
  });
});

// ─────────────────────────── 11 ──────────────────────────────────

describe('Integration 11 — KG ceiling eviction triggers when over limit', () => {
  it('over 50k → eviction', async () => {
    let evicted = 0;
    const result = await runKGGrowthCycle(
      {
        kg: {
          listPendingObservations: async () => [],
          insertObservations: async () => ({ nodesAdded: 0, edgesAdded: 0 }),
          listEdgesForDecay: async () => [],
          updateEdgeConfidence: async () => {},
          listOrphanNodes: async () => [],
          archiveNode: async () => {},
          evictOldestArchived: async (args) => {
            evicted = args.count;
            return args.count;
          },
          countLiveNodes: async () => 50_050,
        },
        clock: () => CLOCK_AT,
        config: defaultGrowthConfig(),
      },
      { tenantId: TENANT },
    );
    expect(result.ceilingHit).toBe(true);
    expect(evicted).toBe(50);
  });
});

// ─────────────────────────── 12 ──────────────────────────────────

describe('Integration 12 — distilled-student resolver uses student when ready', () => {
  it('routes to student when STUDENT_MODEL_PATH set + isReady=true', async () => {
    const studentInvoke = vi.fn().mockResolvedValue({
      content: 'student-output',
      costUsdCents: 0,
      latencyMs: 30,
      adapter: 'vllm',
    });
    const fallbackInvoke = vi.fn();
    const primary: IStudentModelClient = {
      adapter: 'vllm',
      isReady: async () => true,
      invoke: studentInvoke,
    };
    const fallback: NcCostCascadeFallback = { invoke: fallbackInvoke };
    const client = await resolveStudentClient({
      primary,
      fallback,
      studentModelPath: '/models/qwen',
    });
    await client.invoke({ prompt: 'P' });
    expect(studentInvoke).toHaveBeenCalledTimes(1);
    expect(fallbackInvoke).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── 13 ──────────────────────────────────

describe('Integration 13 — distilled-student resolver falls back to N-C when not loaded', () => {
  it('routes to N-C cost-cascade when no checkpoint', async () => {
    const fallbackInvoke = vi.fn().mockResolvedValue({
      content: 'haiku-out',
      costUsdCents: 5,
      latencyMs: 80,
      adapter: 'fallback',
    });
    const fallback: NcCostCascadeFallback = { invoke: fallbackInvoke };
    const client = await resolveStudentClient({
      fallback,
      // studentModelPath absent
    });
    const out = await client.invoke({ prompt: 'P' });
    expect(client.adapter).toBe('fallback');
    expect(out.adapter).toBe('fallback');
    expect(fallbackInvoke).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────── 14 ──────────────────────────────────

describe('Integration 14 — 90-day-cycle digest aggregates ALL modules', () => {
  it('builds a digest with non-zero counts from each source', async () => {
    const digest = await buildWeeklyDigest({
      sources: {
        weekIso: '2026-W20',
        preferencePairs: async () => ({
          dpo: 8,
          kto: 12,
          simpo: 3,
          prmStepDpo: 2,
        }),
        activeLearning: async () => ({ queueDepth: 10, labelRate: 0.8 }),
        inspectPassRateTrend: async () => [0.7, 0.75, 0.8, 0.85, 0.88],
        skillCuration: async () => ({ promotions: 3, quarantines: 1 }),
        kgGrowth: async () => ({ added: 120, pruned: 30 }),
        npsDelta: async () => 0.8,
        costPerConversationDelta: async () => -0.4,
      },
    });
    expect(digest.pairsCollected.dpo).toBe(8);
    expect(digest.skillPromotions).toBe(3);
    expect(digest.kgGrowth.pruned).toBe(30);
    expect(digest.npsDelta).toBe(0.8);
    expect(digest.inspectPassRateTrend.length).toBe(5);
  });
});

// ─────────────────────────── 15 ──────────────────────────────────

describe('Integration 15 — capability-card UI payload renders a healthy week', () => {
  it('produces 6 metrics, line chart, and headline mentioning improvements', async () => {
    const digest = await buildWeeklyDigest({
      sources: {
        weekIso: '2026-W20',
        preferencePairs: async () => ({
          dpo: 25,
          kto: 50,
          simpo: 5,
          prmStepDpo: 5,
        }),
        activeLearning: async () => ({ queueDepth: 8, labelRate: 0.85 }),
        inspectPassRateTrend: async () => [
          0.6, 0.65, 0.7, 0.75, 0.78, 0.82, 0.85, 0.86, 0.88, 0.9, 0.91, 0.92,
        ],
        skillCuration: async () => ({ promotions: 5, quarantines: 0 }),
        kgGrowth: async () => ({ added: 200, pruned: 50 }),
        npsDelta: async () => 1.2,
        costPerConversationDelta: async () => -0.7,
      },
    });
    const payload = renderCapabilityCardPayload(digest);
    expect(payload.metrics.length).toBe(6);
    expect(payload.chart.data.length).toBe(12);
    // 25+50+5+5 = 85 pairs
    expect(payload.headlineText).toContain('85');
    expect(payload.headlineText).toContain('NPS +1.20');
    // Cost trend should be 'up' (good: dropped)
    const cost = payload.metrics.find((m) =>
      m.label.includes('Cost / conversation'),
    )!;
    expect(cost.trend).toBe('up');
  });
});
