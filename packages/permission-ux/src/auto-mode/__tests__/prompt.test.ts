/**
 * Classifier prompt — structural checks. We don't compare prompts
 * verbatim (they may evolve); we verify that the key pieces are
 * present and bounded.
 */

import { describe, it, expect } from 'vitest';
import {
  CLASSIFIER_SYSTEM_PROMPT,
  buildClassifierPrompt,
} from '../prompt.js';
import { ClassifierVerdictSchema } from '../verdict-schema.js';
import { SAFE_FIXTURES } from './fixtures.js';

describe('CLASSIFIER_SYSTEM_PROMPT', () => {
  it('mentions all three verdict labels', () => {
    expect(CLASSIFIER_SYSTEM_PROMPT).toContain('safe');
    expect(CLASSIFIER_SYSTEM_PROMPT).toContain('borderline');
    expect(CLASSIFIER_SYSTEM_PROMPT).toContain('unsafe');
  });
  it('asks for JSON output', () => {
    expect(CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain('json');
  });
});

describe('buildClassifierPrompt', () => {
  it('contains the tool name + tier + args', () => {
    const f = SAFE_FIXTURES[3]!; // mark_inspection_complete
    const out = buildClassifierPrompt(f.input);
    expect(out).toContain(f.input.toolName);
    expect(out).toContain(f.input.tier);
    expect(out).toContain('inspectionId');
  });

  it('renders no-prior-turns marker when recentTurns is empty', () => {
    const f = SAFE_FIXTURES[0]!;
    const out = buildClassifierPrompt({ ...f.input, recentTurns: [] });
    expect(out).toContain('(no prior turns)');
  });

  it('renders "none" marker when statedBoundaries is empty', () => {
    const f = SAFE_FIXTURES[0]!;
    const out = buildClassifierPrompt({ ...f.input, statedBoundaries: [] });
    expect(out).toContain('(none)');
  });

  it('truncates absurdly long turns', () => {
    const f = SAFE_FIXTURES[0]!;
    const huge = 'x'.repeat(50_000);
    const out = buildClassifierPrompt({
      ...f.input,
      recentTurns: [huge],
    });
    expect(out.length).toBeLessThan(20_000);
  });

  it('windows recentTurns to the last 8', () => {
    const f = SAFE_FIXTURES[0]!;
    const turns: string[] = [];
    for (let i = 0; i < 20; i++) turns.push(`turn ${i}`);
    const out = buildClassifierPrompt({ ...f.input, recentTurns: turns });
    expect(out).toContain('turn 12'); // included
    expect(out).not.toContain('turn 0'); // dropped
  });
});

describe('ClassifierVerdictSchema', () => {
  it('accepts a valid verdict object', () => {
    const r = ClassifierVerdictSchema.safeParse({
      verdict: 'safe',
      reason: 'because',
      recommendPlanMode: false,
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown verdict strings', () => {
    const r = ClassifierVerdictSchema.safeParse({
      verdict: 'maybe',
      reason: 'because',
      recommendPlanMode: false,
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing recommendPlanMode', () => {
    const r = ClassifierVerdictSchema.safeParse({
      verdict: 'safe',
      reason: 'because',
    });
    expect(r.success).toBe(false);
  });
});
