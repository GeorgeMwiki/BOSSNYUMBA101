/**
 * Reason-strategize tool (RT-7) — output structure tests.
 *
 * Verifies:
 *   - StrategyTrace contains 2 (quick) or 4 (thorough) strategies.
 *   - A recommended_index always points at a valid strategy.
 *   - The trace is bilingual-grounded: every *_prompt is a non-empty
 *     directive the model can ground with live data.
 *   - compose_guidance reaches the model so the chat turn is fresh.
 *   - The grounding_tools list names tools the orchestrator can call.
 */

import { describe, expect, it } from 'vitest';
import { reasonStrategizeTool } from '../reason-strategize-tool.js';

const ctx = {
  tenantId: 'tnt-test',
  actorId: 'usr-test',
  personaSlug: 'T1_owner_strategist',
};

describe('reasonStrategizeTool', () => {
  it('quick depth returns 2 strategies', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'should I raise rent across the block?', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(out.trace.strategies.length).toBe(2);
    expect(out.depth).toBe('quick');
  });

  it('thorough depth returns 4 strategies', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'should I evict or restructure?', depth: 'thorough', language: 'en' },
      ctx,
    );
    expect(out.trace.strategies.length).toBe(4);
    expect(out.depth).toBe('thorough');
  });

  it('recommended_index always points to a valid strategy', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'is now the right time to refinance?', depth: 'thorough', language: 'en' },
      ctx,
    );
    expect(out.trace.recommended_index).toBeGreaterThanOrEqual(0);
    expect(out.trace.recommended_index).toBeLessThan(
      out.trace.strategies.length,
    );
  });

  it('every strategy has non-empty pros, cons, evidence_prompt, confidence', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'should I pilot the rent-uplift?', depth: 'thorough', language: 'en' },
      ctx,
    );
    for (const s of out.trace.strategies) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.pros.length).toBeGreaterThan(0);
      expect(s.cons.length).toBeGreaterThan(0);
      expect(s.evidence_prompt.length).toBeGreaterThan(0);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('every *_prompt in the trace is a non-empty model directive', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'expand to NG?', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(out.trace.current_state_prompt.length).toBeGreaterThan(20);
    expect(out.trace.why_prompt.length).toBeGreaterThan(20);
    expect(out.trace.downsides_prompt.length).toBeGreaterThan(20);
    expect(out.trace.retrospective_grade_plan.length).toBeGreaterThan(20);
  });

  it('grounding_tools names BOSSNYUMBA tool ids the orchestrator can call', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'should I evict?', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(out.grounding_tools.length).toBeGreaterThan(0);
    for (const id of out.grounding_tools) {
      expect(id.startsWith('bossnyumba.')).toBe(true);
    }
  });

  it('compose_guidance instructs the model to vary phrasing per turn', async () => {
    const out = await reasonStrategizeTool.handler(
      { question: 'should I refit Unit 5?', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(out.compose_guidance.toLowerCase()).toContain('vary');
    expect(out.compose_guidance.toLowerCase()).toContain('reason');
  });

  it('scope_filter is forwarded into the output as nullable', async () => {
    const noFilter = await reasonStrategizeTool.handler(
      { question: 'q', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(noFilter.scope_filter).toBeNull();
    const withFilter = await reasonStrategizeTool.handler(
      {
        question: 'q',
        depth: 'quick',
        language: 'en',
        scope_filter: { entity_type: 'lease', entity_id: 'L-001' },
      },
      ctx,
    );
    expect(withFilter.scope_filter).toEqual({
      entity_type: 'lease',
      entity_id: 'L-001',
    });
  });
});

describe('RT-1 variation contract', () => {
  /**
   * Three consecutive invocations with the same question should produce
   * deterministic SCAFFOLDS (tests pin the trace shape) — the model is
   * what introduces fresh phrasing per turn, not the tool. The contract
   * here is that the SCAFFOLD is stable so the model has a fixed grounding
   * surface to work from.
   */
  it('produces a deterministic scaffold across turns', async () => {
    const a = await reasonStrategizeTool.handler(
      { question: 'q', depth: 'quick', language: 'en' },
      ctx,
    );
    const b = await reasonStrategizeTool.handler(
      { question: 'q', depth: 'quick', language: 'en' },
      ctx,
    );
    const c = await reasonStrategizeTool.handler(
      { question: 'q', depth: 'quick', language: 'en' },
      ctx,
    );
    expect(a.trace.strategies.length).toBe(b.trace.strategies.length);
    expect(b.trace.strategies.length).toBe(c.trace.strategies.length);
    expect(a.trace.recommended_index).toBe(b.trace.recommended_index);
  });
});
