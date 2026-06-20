/**
 * Unit tests for chartLocaleTag — the UI-locale → BCP-47 mapping used by
 * owner-portal chart/period grouping. Guards against a regression that
 * reintroduces a hard-coded jurisdiction tag (e.g. en-KE).
 */

import { describe, expect, it } from 'vitest';
import { chartLocaleTag } from '../chart-locale';

describe('chartLocaleTag', () => {
  it('maps English to a region-neutral en tag (never a single jurisdiction)', () => {
    const tag = chartLocaleTag('en');
    expect(tag).toBe('en-GB');
    // Explicitly NOT pinned to Kenya / Tanzania / any launch market.
    expect(tag).not.toBe('en-KE');
    expect(tag).not.toBe('en-US');
  });

  it('maps Swahili to the Tanzania launch-jurisdiction tag', () => {
    expect(chartLocaleTag('sw')).toBe('sw-TZ');
  });

  it('produces tags that group the same month into one stable bucket key', () => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    const a = date.toLocaleDateString(chartLocaleTag('en'), {
      month: 'short',
      year: 'numeric',
    });
    const b = date.toLocaleDateString(chartLocaleTag('en'), {
      month: 'short',
      year: 'numeric',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/2026/);
  });

  it('falls back to the English tag for an out-of-range locale', () => {
    // @ts-expect-error — deliberately passing an unsupported value.
    expect(chartLocaleTag('fr')).toBe('en-GB');
  });
});
