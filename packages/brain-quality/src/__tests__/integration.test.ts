/**
 * Integration tests — cross-module flows.
 *
 * 10 tests exercising the full brain-quality stack:
 *   - memory tiers cooperate (context → core → KG → reflection)
 *   - reflexion loop feeds back into prefix-cache prefix
 *   - prefix cache hit rate ≥ 70% on a simulated multi-turn session
 *   - Inspect harness consumes scenarios + emits gate-pass / gate-fail
 */

import { describe, expect, it } from 'vitest';

import {
  ALL_SCENARIOS,
  POLICY_COMPLIANCE_SCENARIOS,
  TOOL_USE_SCENARIOS,
  appendCore,
  appendMessage,
  composePrompt,
  completeAndReflect,
  createContextMemory,
  createCoreMemory,
  createInMemoryReflectionStore,
  createPrefixCache,
  createTemporalKG,
  estimateTokens,
  evalGatePasses,
  formatReportMarkdown,
  heuristicSynthesizer,
  PREFIX_CACHE_HIT_RATIO_TARGET,
  renderReflectionLessons,
  retrieveForTask,
  runInspectEval,
  synthesizeReflection,
  upsertNode,
  addFact,
  type AgentTranscript,
  type Embedding,
  type InspectScenario,
  type J1ReflectionStore,
  type ReflectionSynthesis,
} from '../index.js';

function embedder(text: string): Embedding {
  const dims = new Array<number>(16).fill(0);
  for (const ch of text.toLowerCase()) {
    const idx = ch.charCodeAt(0) % 16;
    dims[idx] = (dims[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(dims.reduce((a, b) => a + b * b, 0)) || 1;
  return Object.freeze(dims.map((d) => d / norm));
}

const stubCritic = (_prompt: string, ctx: { taskType: string }) => ({
  critique: `Reviewed run of ${ctx.taskType}; rushed step.`,
  lesson: `For ${ctx.taskType} tasks, verify before acting.`,
});

function makeJ1Store(): J1ReflectionStore & {
  peek(): readonly ReflectionSynthesis[];
} {
  const items: ReflectionSynthesis[] = [];
  return {
    put(r) {
      items.push(r);
    },
    listForSubject(t, id) {
      return items.filter((i) => i.subjectType === t && i.subjectId === id);
    },
    peek() {
      return items;
    },
  };
}

function perfect(scenario: InspectScenario): AgentTranscript {
  return {
    scenarioId: scenario.id,
    actions: scenario.target.requiredActions.map((tool) => ({
      tool,
      args: {},
      resultOk: true,
    })),
    finalState: scenario.target.expectedFinalState ?? {},
    durationMs: 5,
  };
}

describe('Integration — brain-quality cross-module flows', () => {
  it('Context + Core + KG cooperate across a session', () => {
    let ctx = createContextMemory();
    let core = createCoreMemory();
    let kg = createTemporalKG();

    ctx = appendMessage(ctx, {
      role: 'user',
      content: 'Hi, I am tenant Mary in unit 4B.',
      tokens: estimateTokens('Hi, I am tenant Mary in unit 4B.'),
      at: new Date().toISOString(),
    });
    core = appendCore(core, {
      kind: 'human',
      text: 'User is Mary in unit 4B',
    });
    kg = upsertNode(kg, {
      id: 'tenant-mary',
      entityType: 'tenant',
      properties: { name: 'Mary' },
    });
    kg = upsertNode(kg, {
      id: 'unit-4b',
      entityType: 'unit',
      properties: {},
    });
    kg = addFact(kg, {
      subjectId: 'tenant-mary',
      predicate: 'occupies',
      objectId: 'unit-4b',
    });

    expect(ctx.messages).toHaveLength(1);
    expect(core.blocks.size).toBe(1);
    expect(kg.edges.size).toBe(1);
  });

  it('Reflexion lessons feed into prefix-cache prefix', async () => {
    const store = createInMemoryReflectionStore();
    await completeAndReflect(
      { critiqueProvider: stubCritic, embedder, store },
      {
        taskType: 'rent_reconcile',
        taskInput: 'June-2026',
        outcome: 'failure',
        trace: 'fx_unavailable; aborted',
      },
    );
    const retrieved = await retrieveForTask(
      { store, embedder },
      { taskType: 'rent_reconcile', taskInput: 'July-2026' },
    );
    const lessons = renderReflectionLessons(retrieved.notes);
    expect(lessons).toContain('verify');

    const shape = composePrompt({
      systemPrompt: 'sys',
      constitution: 'const',
      toolManifest: ['tool-a'],
      reflectionLessons: lessons,
      dynamicTurn: 'reconcile July-2026',
    });
    const lessonsSeg = shape.prefix.find((s) => s.id === 'lessons');
    expect(lessonsSeg?.text).toContain('verify');
  });

  it('Prefix-cache hit rate ≥ 70% on a 10-turn session with stable prefix', () => {
    const cache = createPrefixCache();
    const lessons = '# lessons\n1. verify\n2. always check region';
    for (let i = 0; i < 10; i += 1) {
      cache.observe(
        `t-${i}`,
        composePrompt({
          systemPrompt: 'stable system',
          constitution: 'stable constitution',
          toolManifest: ['tool-a', 'tool-b'],
          reflectionLessons: lessons,
          dynamicTurn: `turn payload ${i}`,
        }),
      );
    }
    expect(cache.stats().meanHitRatio).toBeGreaterThanOrEqual(
      PREFIX_CACHE_HIT_RATIO_TARGET,
    );
  });

  it('Reflection synthesis condenses KG facts into a higher-order insight', async () => {
    let kg = createTemporalKG();
    kg = upsertNode(kg, {
      id: 't-1',
      entityType: 'tenant',
      properties: {},
    });
    kg = upsertNode(kg, { id: 'l-1', entityType: 'lease', properties: {} });
    for (let i = 0; i < 4; i += 1) {
      kg = addFact(kg, {
        subjectId: 't-1',
        predicate: 'paid_late',
        objectId: 'l-1',
        validFrom: `2026-0${i + 1}-15T00:00:00Z`,
      });
    }
    const j1 = makeJ1Store();
    const reflection = await synthesizeReflection(
      { synthesizer: heuristicSynthesizer, store: j1 },
      {
        subjectType: 'tenant',
        subjectId: 't-1',
        periodStart: '2026-01-01T00:00:00Z',
        periodEnd: '2026-05-01T00:00:00Z',
        coreBlocks: [],
        recentFacts: [...kg.edges.values()],
      },
    );
    expect(reflection.summary).toContain('t-1');
    expect(reflection.evidenceIds.length).toBe(4);
    expect(j1.peek()).toHaveLength(1);
  });

  it('Inspect harness gate passes on policy + tool when executor is perfect', async () => {
    const report = await runInspectEval(
      [...POLICY_COMPLIANCE_SCENARIOS, ...TOOL_USE_SCENARIOS],
      perfect,
    );
    expect(evalGatePasses(report)).toBe(true);
  });

  it('Inspect harness gate fails when any policy scenario fails', async () => {
    const report = await runInspectEval(POLICY_COMPLIANCE_SCENARIOS, (s) => ({
      scenarioId: s.id,
      actions: [
        ...s.target.forbiddenActions.map((tool) => ({
          tool,
          args: {},
          resultOk: true,
        })),
      ],
      finalState: {},
      durationMs: 1,
    }));
    expect(evalGatePasses(report)).toBe(false);
  });

  it('Inspect report renders to readable Markdown', async () => {
    const report = await runInspectEval(ALL_SCENARIOS, perfect);
    const md = formatReportMarkdown(report);
    expect(md.split('\n').length).toBeGreaterThan(30); // header + per-family + 30 rows
  });

  it('Full agent turn cycle: lessons retrieved → prompt composed → telemetry emitted', async () => {
    const store = createInMemoryReflectionStore();
    await completeAndReflect(
      { critiqueProvider: stubCritic, embedder, store },
      {
        taskType: 'maintenance_triage',
        taskInput: 'gas smell',
        outcome: 'partial',
        trace: 'classified as severity-2, but real severity was 3',
      },
    );
    const retrieved = await retrieveForTask(
      { store, embedder },
      { taskType: 'maintenance_triage', taskInput: 'gas leak reported' },
    );
    const shape = composePrompt({
      systemPrompt: 'sys',
      constitution: 'const',
      toolManifest: ['triage', 'dispatch'],
      reflectionLessons: renderReflectionLessons(retrieved.notes),
      dynamicTurn: 'New gas-leak report.',
    });
    let telemetryEvent: { turnId: string } | null = null;
    const cache = createPrefixCache((e) => {
      telemetryEvent = e;
    });
    cache.observe('turn-X', shape);
    expect(telemetryEvent).not.toBeNull();
    expect((telemetryEvent as unknown as { turnId: string }).turnId).toBe(
      'turn-X',
    );
  });

  it('All 30 scenarios pass with the perfect executor (eval baseline)', async () => {
    const report = await runInspectEval(ALL_SCENARIOS, perfect);
    expect(report.summary.passed).toBe(30);
    expect(report.summary.passRate).toBe(1);
  });

  it('Core memory respects per-block cap when the agent rambles', () => {
    let core = createCoreMemory({ maxTokensPerBlock: 50, maxTokensTotal: 1000 });
    expect(() => {
      core = appendCore(core, {
        kind: 'scratchpad',
        text: 'word '.repeat(200),
      });
    }).toThrow();
  });
});
