import { describe, expect, it } from 'vitest';
import {
  checkContamination,
  assertNoContamination,
  ContaminationError,
} from '../contamination.js';

describe('checkContamination', () => {
  it('passes pure Swahili output', () => {
    const result = checkContamination(
      'Karibu BossNyumba. Pango lako limeandaliwa tayari.',
      'sw',
    );
    expect(result.ok).toBe(true);
    expect(result.leakedTokens).toEqual([]);
  });

  it('flags English leak inside Swahili output', () => {
    const result = checkContamination(
      'Karibu BossNyumba. The pango is ready for you because it was prepared today.',
      'sw',
    );
    expect(result.ok).toBe(false);
    expect(result.leakedTokens).toContain('the');
    expect(result.leakedTokens).toContain('because');
  });

  it('flags Swahili leak inside English output', () => {
    const result = checkContamination(
      'Welcome. Pango yako ni ready kwa matumizi.',
      'en',
    );
    expect(result.ok).toBe(false);
    expect(result.leakedTokens).toContain('kwa');
  });

  it('returns ok=true for empty text', () => {
    const result = checkContamination('', 'sw');
    expect(result.ok).toBe(true);
    expect(result.tokensChecked).toBe(0);
  });
});

describe('assertNoContamination', () => {
  it('throws ContaminationError on leak', () => {
    expect(() =>
      assertNoContamination(
        'Karibu the because while which would these',
        'sw',
      ),
    ).toThrow(ContaminationError);
  });

  it('does not throw on clean Swahili', () => {
    expect(() =>
      assertNoContamination('Karibu BossNyumba. Pango lako limeandaliwa.', 'sw'),
    ).not.toThrow();
  });
});
