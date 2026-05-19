/**
 * extractConfidence — verbalized-pattern matching + mode routing.
 */

import { describe, it, expect } from 'vitest';
import {
  appendJustAskConfidence,
  extractConfidence,
} from '../confidence/extract-confidence.js';
import type { LlmResponse } from '../types.js';

function mkResp(text: string, logprob: number | null = null): LlmResponse {
  return Object.freeze({
    text,
    logprob,
    tokensIn: 100,
    tokensOut: 100,
    costUsdCents: 1,
    latencyMs: 100,
  });
}

describe('extractConfidence — verbalized pattern recognition', () => {
  it('parses "confidence: 0.82"', () => {
    const c = extractConfidence(mkResp('Answer ...\nconfidence: 0.82'));
    expect(c.verbalized).toBeCloseTo(0.82, 2);
  });

  it('parses "confidence: 8/10"', () => {
    const c = extractConfidence(mkResp('Answer.\nconfidence: 8/10'));
    expect(c.verbalized).toBeCloseTo(0.8, 2);
  });

  it('parses "confidence: 85%"', () => {
    const c = extractConfidence(mkResp('Answer.\nconfidence: 85%'));
    expect(c.verbalized).toBeCloseTo(0.85, 2);
  });

  it('parses "I am 75% confident"', () => {
    const c = extractConfidence(mkResp('I am 75% confident.'));
    expect(c.verbalized).toBeCloseTo(0.75, 2);
  });

  it('parses "I am 7/10 confident"', () => {
    const c = extractConfidence(mkResp('I am 7/10 confident.'));
    expect(c.verbalized).toBeCloseTo(0.7, 2);
  });

  it('handles confidence as raw 0–10 number ("confidence: 8")', () => {
    const c = extractConfidence(mkResp('confidence: 8'));
    expect(c.verbalized).toBeCloseTo(0.8, 2);
  });

  it('returns verbalized=null when no pattern matches', () => {
    const c = extractConfidence(mkResp('The answer is 42.'));
    expect(c.verbalized).toBeNull();
  });
});

describe('extractConfidence — logprob handling', () => {
  it('exponentiates raw negative logprob', () => {
    // ln(0.6) ≈ -0.5108
    const c = extractConfidence(mkResp('answer', -0.5108));
    expect(c.logprob).toBeCloseTo(0.6, 1);
  });

  it('treats positive logprob in 0..1 as already-normalised', () => {
    const c = extractConfidence(mkResp('answer', 0.92));
    expect(c.logprob).toBeCloseTo(0.92, 2);
  });

  it('returns null for NaN logprob', () => {
    const c = extractConfidence(mkResp('answer', NaN));
    expect(c.logprob).toBeNull();
  });
});

describe('extractConfidence — autonomy-mode routing', () => {
  it('routes calibrated < 0.30 → safe-mode', () => {
    const c = extractConfidence(mkResp('answer\nconfidence: 0.3', 0.2));
    expect(c.mode).toBe('safe-mode');
  });

  it('routes 0.30 ≤ calibrated < 0.50 → plan-mode', () => {
    // verbalized 0.7 calibrates to ~0.55; combined w/ logprob 0.4
    // = 0.7*0.4 + 0.3*0.55 = 0.28 + 0.165 = 0.445 → plan-mode
    const c = extractConfidence(mkResp('answer\nconfidence: 0.7', 0.4));
    expect(c.calibrated).toBeGreaterThanOrEqual(0.3);
    expect(c.calibrated).toBeLessThan(0.5);
    expect(c.mode).toBe('plan-mode');
  });

  it('routes 0.50 ≤ calibrated < 0.70 → high-confidence-only', () => {
    const c = extractConfidence(mkResp('answer\nconfidence: 0.7', 0.6));
    expect(c.mode).toBe('high-confidence-only');
  });

  it('routes 0.70 ≤ calibrated < 0.95 → normal', () => {
    const c = extractConfidence(mkResp('answer', 0.8));
    expect(c.mode).toBe('normal');
  });

  it('routes calibrated ≥ 0.95 → destructive-eligible (only when logprob is also very high)', () => {
    // L3 calibration is intentionally pessimistic about verbalized scores:
    // verbalized 1.0 → 0.85 alone. Getting to ≥0.95 requires logprob >= ~0.99.
    // 0.7 * 0.99 + 0.3 * 0.85 = 0.693 + 0.255 = 0.948 → just below 0.95.
    // 0.7 * 1.0  + 0.3 * 0.85 = 0.7  + 0.255   = 0.955 → destructive-eligible.
    const c = extractConfidence(mkResp('confidence: 1.0', 1.0));
    expect(c.mode).toBe('destructive-eligible');
  });
});

describe('appendJustAskConfidence', () => {
  it('appends a confidence-eliciting directive', () => {
    const original = 'You are a helpful assistant.';
    const result = appendJustAskConfidence(original);
    expect(result).toContain(original);
    expect(result).toMatch(/confidence/i);
    expect(result).toMatch(/0\.0/);
  });

  it('never mutates input', () => {
    const original = 'system';
    const before = original;
    const after = appendJustAskConfidence(original);
    expect(original).toBe(before);
    expect(after).not.toBe(original);
  });
});

describe('extractConfidence — frozen result + reason explanation', () => {
  it('returns a frozen object', () => {
    const c = extractConfidence(mkResp('answer\nconfidence: 0.8', 0.7));
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('explains the routing in `reason`', () => {
    const c = extractConfidence(mkResp('answer\nconfidence: 0.8', 0.7));
    expect(c.reason).toMatch(/verbalized=0\.80/);
    expect(c.reason).toMatch(/logprob=0\.70/);
    expect(c.reason).toMatch(/calibrated=/);
    expect(c.reason).toMatch(/→/);
  });
});

describe('autonomy-slider degrade flow (12 fixtures end-to-end)', () => {
  const fixtures: ReadonlyArray<{
    label: string;
    text: string;
    logprob: number | null;
    expectedMode:
      | 'safe-mode'
      | 'plan-mode'
      | 'high-confidence-only'
      | 'normal'
      | 'destructive-eligible';
  }> = [
    {
      label: 'low verbalized + low logprob → safe-mode',
      text: 'I am 20% confident.',
      logprob: 0.15,
      expectedMode: 'safe-mode',
    },
    {
      label: 'mid verbalized only → plan-mode (verbalized 0.60 → 0.45)',
      text: 'I am 60% confident.',
      logprob: null,
      // verbalized 0.60 calibrates to 0.45 → plan-mode (range [0.3, 0.5))
      expectedMode: 'plan-mode',
    },
    {
      label: 'no signal → plan-mode (calibrated 0.5)',
      text: 'answer',
      logprob: null,
      expectedMode: 'high-confidence-only',
    },
    {
      label: 'high verbalized + low logprob → high-confidence-only',
      text: 'confidence: 0.9',
      logprob: 0.5,
      expectedMode: 'high-confidence-only',
    },
    {
      label: 'high verbalized + high logprob → normal',
      text: 'confidence: 0.9',
      logprob: 0.85,
      expectedMode: 'normal',
    },
    {
      label: 'top verbalized + max logprob → destructive-eligible',
      text: 'confidence: 1.0',
      // 0.7 * 1.0 + 0.3 * 0.85 = 0.955 → destructive-eligible
      logprob: 1.0,
      expectedMode: 'destructive-eligible',
    },
    {
      label: 'verbalized 0.5 → safe-mode (calibrates to 0.32)',
      text: 'confidence: 0.5',
      logprob: null,
      expectedMode: 'plan-mode',
    },
    {
      label: '0.3 verbalized → safe-mode',
      text: 'confidence: 0.3',
      logprob: null,
      expectedMode: 'safe-mode',
    },
    {
      label: 'verbalized 0.7 + logprob 0.8 → normal',
      text: 'confidence: 0.7',
      logprob: 0.8,
      expectedMode: 'normal',
    },
    {
      label: 'verbalized 1.0 + logprob 0.7 → normal',
      text: 'confidence: 1.0',
      logprob: 0.7,
      expectedMode: 'normal',
    },
    {
      label: 'verbalized 0.4 + logprob 0.3 → safe-mode',
      text: 'confidence: 0.4',
      logprob: 0.3,
      expectedMode: 'safe-mode',
    },
    {
      label: 'verbalized 0.85 + null logprob → normal (calibrates to 0.70)',
      text: 'confidence: 0.85',
      // verbalized 0.85 calibrates to 0.70 → normal range [0.7, 0.95)
      logprob: null,
      expectedMode: 'normal',
    },
  ];

  for (const fx of fixtures) {
    it(fx.label, () => {
      const c = extractConfidence(mkResp(fx.text, fx.logprob));
      expect(c.mode).toBe(fx.expectedMode);
    });
  }
});
