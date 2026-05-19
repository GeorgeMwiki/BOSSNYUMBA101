/**
 * buildSafeModeMessage + resolveSafeModeChoice — UI envelope + 3-button
 * dispatch.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSafeModeMessage,
  resolveSafeModeChoice,
} from '../build-message.js';

describe('buildSafeModeMessage', () => {
  it('includes three explicit buttons', () => {
    const msg = buildSafeModeMessage({ reasons: ['perplexity high'] });
    expect(msg.buttons.length).toBe(3);
    const ids = msg.buttons.map((b) => b.id).sort();
    expect(ids).toEqual(
      ['continue-anyway', 'take-over', 'try-different-approach'],
    );
  });

  it('echoes the reasons array', () => {
    const msg = buildSafeModeMessage({
      reasons: ['perplexity high', 'failure rate high'],
    });
    expect(msg.reasons).toEqual(['perplexity high', 'failure rate high']);
  });

  it('uses sensible defaults for title + explanation', () => {
    const msg = buildSafeModeMessage({ reasons: [] });
    expect(msg.title.length).toBeGreaterThan(0);
    expect(msg.explanation.length).toBeGreaterThan(0);
  });

  it('allows overriding title + explanation', () => {
    const msg = buildSafeModeMessage({
      reasons: [],
      title: 'Stop',
      explanation: 'Take over?',
    });
    expect(msg.title).toBe('Stop');
    expect(msg.explanation).toBe('Take over?');
  });
});

describe('resolveSafeModeChoice', () => {
  it('maps take-over -> pause-agent', () => {
    expect(resolveSafeModeChoice('take-over')).toEqual({ kind: 'pause-agent' });
  });
  it('maps try-different-approach -> enter-plan-mode', () => {
    expect(resolveSafeModeChoice('try-different-approach')).toEqual({
      kind: 'enter-plan-mode',
    });
  });
  it('maps continue-anyway -> resume-with-override', () => {
    expect(resolveSafeModeChoice('continue-anyway')).toEqual({
      kind: 'resume-with-override',
    });
  });
});
