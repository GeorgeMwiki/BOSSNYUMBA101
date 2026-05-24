import { describe, expect, it } from 'vitest';
import { LOI_AXES, emptyLOI, scoreLOI } from '../loi-psa/loi-25-axis-scorer.js';
import type { LOIAxisRating } from '../types.js';

function fillAll(score: LOIAxisRating['score']): LOIAxisRating[] {
  return LOI_AXES.map((key) => ({ key, score, notes: '' }));
}

describe('loi-25-axis-scorer', () => {
  it('exports exactly 25 axes', () => {
    expect(LOI_AXES.length).toBe(25);
  });

  it('emptyLOI returns 25 zero-rated axes', () => {
    const e = emptyLOI();
    expect(e.length).toBe(25);
    expect(e.every((a) => a.score === 0)).toBe(true);
  });

  it('throws when axis count is wrong', () => {
    expect(() => scoreLOI(fillAll(3).slice(0, 24))).toThrow(/exactly/);
  });

  it('throws on duplicate axis key', () => {
    const dup: LOIAxisRating[] = fillAll(3);
    dup[1] = { ...dup[0], notes: 'dup' };
    expect(() => scoreLOI(dup)).toThrow(/duplicate/);
  });

  it('throws on out-of-range score', () => {
    const bad: LOIAxisRating[] = fillAll(3);
    bad[0] = { ...bad[0], score: 9 as unknown as LOIAxisRating['score'] };
    expect(() => scoreLOI(bad)).toThrow(/0..5/);
  });

  it('do-not-sign when fully empty (all zero)', () => {
    const r = scoreLOI(emptyLOI());
    expect(r.verdict).toBe('do-not-sign');
    expect(r.criticalGaps.length).toBeGreaterThan(0);
  });

  it('strong when fully scored 5', () => {
    const r = scoreLOI(fillAll(5));
    expect(r.normalized).toBe(1);
    expect(r.verdict).toBe('strong');
  });

  it('acceptable around 0.70 normalized', () => {
    const r = scoreLOI(fillAll(4));
    expect(r.normalized).toBeCloseTo(0.8, 1);
    expect(r.verdict).toBe('acceptable');
  });

  it('redraft for normalized 0.45-0.65 with no critical gaps', () => {
    const axes: LOIAxisRating[] = LOI_AXES.map((key) => ({
      key,
      score: 3 as LOIAxisRating['score'],
      notes: '',
    }));
    const r = scoreLOI(axes);
    expect(r.normalized).toBeCloseTo(0.6, 1);
    expect(r.verdict).toBe('redraft');
  });

  it('critical gap on casualtyCondemnation forces do-not-sign', () => {
    const axes: LOIAxisRating[] = fillAll(5);
    const idx = LOI_AXES.indexOf('casualtyCondemnation');
    axes[idx] = { ...axes[idx], score: 0 };
    const r = scoreLOI(axes);
    expect(r.verdict).toBe('do-not-sign');
    expect(r.criticalGaps).toContain('casualtyCondemnation');
  });
});
