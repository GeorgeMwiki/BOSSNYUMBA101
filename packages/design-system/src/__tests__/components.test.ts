/**
 * Baseline tests for @bossnyumba/design-system.
 *
 * Note: @testing-library/react is not currently listed in this package's
 * dependencies (see package.json). The repo-level vitest config also runs in
 * the `node` environment by default. Rendering React components therefore
 * requires extra infrastructure we don't want to assume here.
 *
 * Instead, we cover:
 *   1. The pure utility exports from `lib/utils` (cn, formatCurrency,
 *      formatDate, truncate, getInitials).
 *   2. The presence of component exports on the public surface.
 */

import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  truncate,
  getInitials,
} from '../lib/utils';
import * as ds from '../index';

describe('cn (tailwind class merger)', () => {
  it('merges plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values and dedupes conflicting tailwind classes', () => {
    // twMerge keeps the last of a conflicting set.
    expect(cn('px-2', false && 'px-4', undefined, 'px-6')).toBe('px-6');
  });
});

describe('formatCurrency', () => {
  it('formats minor-unit KES amounts with the KE locale', () => {
    // 150000 minor units → 1,500 KES. Intl formatting may use either U+00A0
    // (NBSP) or a narrow NBSP between the currency code and amount, so we
    // assert on the meaningful substrings rather than exact whitespace.
    const out = formatCurrency(150000);
    expect(out).toContain('KES');
    expect(out).toContain('1,500');
  });

  it('respects an explicit currency override', () => {
    const out = formatCurrency(100000, 'USD', 'en-US');
    expect(out).toContain('$');
    expect(out).toContain('1,000');
  });
});

describe('formatDate', () => {
  it('returns a human-readable string by default', () => {
    const out = formatDate(new Date('2026-04-15T00:00:00Z'));
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    // default options include the 4-digit year
    expect(out).toMatch(/2026/);
  });
});

describe('truncate', () => {
  it('returns the input unchanged when shorter than the limit', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('cuts to (max - 3) chars and adds an ellipsis when too long', () => {
    // "abcdefghij" length 10, max 7 → "abcd..." (length 7)
    const out = truncate('abcdefghij', 7);
    expect(out).toBe('abcd...');
    expect(out).toHaveLength(7);
  });
});

describe('getInitials', () => {
  it('returns up to two uppercase initials', () => {
    expect(getInitials('Jane Doe')).toBe('JD');
    expect(getInitials('alice bob carol')).toBe('AB');
    expect(getInitials('Solo')).toBe('S');
  });
});

describe('design-system public surface', () => {
  it('re-exports common components and utilities from index', () => {
    expect(typeof ds.cn).toBe('function');
    expect(ds.Button).toBeDefined();
    expect(ds.Input).toBeDefined();
    expect(ds.Card).toBeDefined();
    expect(ds.Badge).toBeDefined();
    expect(ds.Modal).toBeDefined();
  });
});
