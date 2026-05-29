/**
 * BossNyumba dynamic-ui-hints tests — ported from Borjie's DU-2/DU-3/DU-4
 * suite. Asserts bilingual sw/en parity, frozen immutability, stable
 * action.emit ids, and mastery-gate template structure.
 */

import { describe, expect, it } from 'vitest';

import {
  bossnyumbaProactiveHints,
  bossnyumbaMasteryGateCopy,
  bossnyumbaLearnedShortcutsHeadline,
} from '../dynamic-ui-hints.js';

describe('bossnyumbaProactiveHints', () => {
  it('returns the four canonical hint ids in both languages', () => {
    const ids = [
      'bossnyumba.frustration.handoff',
      'bossnyumba.comprehension.simpler',
      'bossnyumba.anxiety.safety',
      'bossnyumba.idle.cmdk',
    ];
    expect(bossnyumbaProactiveHints('sw').map((h) => h.id)).toEqual(ids);
    expect(bossnyumbaProactiveHints('en').map((h) => h.id)).toEqual(ids);
  });

  it('preserves canonical thresholds across languages', () => {
    const sw = bossnyumbaProactiveHints('sw');
    const en = bossnyumbaProactiveHints('en');
    sw.forEach((h, i) => {
      expect(h.threshold).toBe(en[i]?.threshold);
      expect(h.trigger).toBe(en[i]?.trigger);
    });
    expect(sw[0]?.trigger).toBe('frustration');
    expect(sw[0]?.threshold).toBe(0.5);
    expect(sw[2]?.trigger).toBe('anxiety');
    expect(sw[2]?.threshold).toBe(0.6);
  });

  it('returns frozen arrays + frozen objects', () => {
    const hints = bossnyumbaProactiveHints('sw');
    expect(Object.isFrozen(hints)).toBe(true);
    expect(Object.isFrozen(hints[0])).toBe(true);
  });

  it('uses Swahili copy when language=sw', () => {
    const h = bossnyumbaProactiveHints('sw');
    expect(h[0]?.title).toContain('Inaonekana');
    expect(h[3]?.action?.label).toBe('Funza');
  });

  it('uses English copy when language=en', () => {
    const h = bossnyumbaProactiveHints('en');
    expect(h[0]?.title).toContain('Looks like');
    expect(h[3]?.action?.label).toBe('Show me');
  });

  it('keeps action.emit identifiers stable across languages (regression lock)', () => {
    const sw = bossnyumbaProactiveHints('sw');
    const en = bossnyumbaProactiveHints('en');
    sw.forEach((h, i) => {
      expect(h.action?.emit).toBe(en[i]?.action?.emit);
    });
  });

  it('uses the bossnyumba: emit namespace (not borjie:)', () => {
    const hints = bossnyumbaProactiveHints('en');
    hints.forEach((h) => {
      if (h.action?.emit) {
        expect(h.action.emit.startsWith('bossnyumba:')).toBe(true);
        expect(h.action.emit.startsWith('borjie:')).toBe(false);
      }
    });
  });
});

describe('bossnyumbaMasteryGateCopy', () => {
  it('includes {level} placeholder in template', () => {
    expect(bossnyumbaMasteryGateCopy('sw').hintTemplate).toContain('{level}');
    expect(bossnyumbaMasteryGateCopy('en').hintTemplate).toContain('{level}');
  });

  it('returns Swahili copy when language=sw', () => {
    expect(bossnyumbaMasteryGateCopy('sw').dismissAriaLabel).toBe(
      'Funga kidokezo',
    );
  });

  it('returns English copy when language=en', () => {
    expect(bossnyumbaMasteryGateCopy('en').dismissAriaLabel).toBe(
      'Dismiss hint',
    );
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(bossnyumbaMasteryGateCopy('sw'))).toBe(true);
  });
});

describe('bossnyumbaLearnedShortcutsHeadline', () => {
  it('returns Swahili headline', () => {
    expect(bossnyumbaLearnedShortcutsHeadline('sw')).toBe('Njia zako za mkato');
  });

  it('returns English headline', () => {
    expect(bossnyumbaLearnedShortcutsHeadline('en')).toBe('Your shortcuts');
  });
});
