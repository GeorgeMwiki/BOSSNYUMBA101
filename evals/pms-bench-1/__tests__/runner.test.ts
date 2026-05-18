/**
 * runner.test.ts — end-to-end test of the PMS-bench-1 driver against the
 * deterministic mock LLM.
 *
 * Verifies:
 *   1. The mock LLM produces parseable JSON plans for every canned task.
 *   2. The sub-MD adapter wires those plans into ObservedRun shape.
 *   3. The scorers + composer produce a pass for every maintenance.dispatch
 *      and complaint.triage fixture (the canned plans are hand-crafted to
 *      score >= 0.8).
 *   4. The SLO stream emits 4 events per run (one per scorer).
 *   5. Unsupported scenarios (arrears, kra-filing, lease-renewal) fail by
 *      design until those sub-MDs ship.
 */

import { describe, it, expect } from 'vitest';
import { createMockLlm, getCannedPlanForTask } from '../runner/mock-llm.js';
import { runSubMd } from '../runner/sub-md-adapter.js';
import { loadFixtures, listScenarios, runTask } from '../runner/run-bench.js';
import type { BenchSloEvent, SloStreamWriter } from '../runner/slo-stream-writer.js';

function createMemorySloWriter(): {
  writer: SloStreamWriter;
  events: BenchSloEvent[];
} {
  const events: BenchSloEvent[] = [];
  const writer: SloStreamWriter = Object.freeze({
    outputPath: '(memory)',
    async emit(event: BenchSloEvent): Promise<void> {
      events.push(event);
    },
  });
  return { writer, events };
}

describe('pms-bench-1 runner — mock-llm end-to-end', () => {
  it('mock LLM produces parseable canned plans for every maintenance + complaint fixture', async () => {
    const llm = createMockLlm();
    const fixtures = [
      ...(await loadFixtures('maintenance-dispatch')),
      ...(await loadFixtures('complaint-triage')),
    ];
    expect(fixtures.length).toBe(20);

    for (const fixture of fixtures) {
      const result = await runSubMd({ fixture, llm, seed: 0 });
      expect(result.parseOk).toBe(true);
      expect(result.subMd).not.toBeNull();
      expect(result.observed.actions.length).toBeGreaterThan(0);
      expect((result.observed.comm ?? '').length).toBeGreaterThan(20);
      expect(getCannedPlanForTask(fixture.id)).not.toBeNull();
    }
  });

  it('every maintenance.dispatch + complaint.triage task passes pass^k under the mock', async () => {
    const llm = createMockLlm();
    const { writer, events } = createMemorySloWriter();

    const passes: Array<{ id: string; scenario: string; pass: boolean; mean: number }> = [];
    for (const scenario of ['maintenance-dispatch', 'complaint-triage']) {
      const fixtures = await loadFixtures(scenario);
      for (const fixture of fixtures) {
        const summary = await runTask({ fixture, k: 3, llm, sloWriter: writer });
        const mean = summary.runs.reduce((a, r) => a + r.composite, 0) / summary.runs.length;
        passes.push({ id: summary.taskId, scenario, pass: summary.passK, mean });
      }
    }

    const failed = passes.filter((p) => !p.pass);
    expect(failed, `expected all 20 mock-LLM tasks to pass — failures: ${JSON.stringify(failed, null, 2)}`).toEqual([]);
    // 20 fixtures * k=3 runs * 4 scorers = 240 SLO events
    expect(events.length).toBe(20 * 3 * 4);
    // Every event has a non-empty subMd + a valid metric
    for (const e of events) {
      expect(e.subMd === 'maintenance.dispatch' || e.subMd === 'complaint.triage').toBe(true);
      expect(['resolution-quality', 'task-completion-rate', 'owner-cs-score', 'cost-per-resolution']).toContain(
        e.metric,
      );
      expect(Number.isFinite(e.actualValue)).toBe(true);
      expect(Number.isFinite(e.delta)).toBe(true);
    }
  });

  it('unsupported scenarios (Tier-B/C) fail by design under the mock', async () => {
    const llm = createMockLlm();
    const { writer } = createMemorySloWriter();
    for (const scenario of ['arrears-triage', 'kra-filing', 'lease-renewal']) {
      const fixtures = await loadFixtures(scenario);
expect(fixtures.length).toBeGreaterThan(0);
      const fixture = fixtures[0] as (typeof fixtures)[0];
      const summary = await runTask({ fixture, k: 2, llm, sloWriter: writer });
      expect(summary.passK).toBe(false);
      expect(summary.subMd).toBeNull();
    }
  });

  it('listScenarios returns all 5 scenarios', async () => {
    const scenarios = await listScenarios();
    const set = new Set(scenarios);
    expect(set.has('arrears-triage')).toBe(true);
    expect(set.has('maintenance-dispatch')).toBe(true);
    expect(set.has('complaint-triage')).toBe(true);
    expect(set.has('kra-filing')).toBe(true);
    expect(set.has('lease-renewal')).toBe(true);
  });

  it('cost-per-resolution event reports observed cost cents (not the [0,1] score)', async () => {
    const llm = createMockLlm();
    const { writer, events } = createMemorySloWriter();
    const fixtures = await loadFixtures('maintenance-dispatch');
    const first = fixtures[0];
    if (first === undefined) throw new Error('fixtures missing');
    await runTask({ fixture: first, k: 1, llm, sloWriter: writer });
    const costEvents = events.filter((e) => e.metric === 'cost-per-resolution');
    expect(costEvents.length).toBe(1);
    const ce = costEvents[0];
    if (ce === undefined) throw new Error('cost event missing');
    expect(ce.actualValue).toBeGreaterThan(0);
    expect(ce.actualValue).toBeLessThanOrEqual(50); // sanity: cents
  });
});
