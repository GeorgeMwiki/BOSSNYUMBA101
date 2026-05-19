import { describe, expect, it } from 'vitest';
import { fingerprint, stableStringify } from '../util/hash.js';

describe('stableStringify', () => {
  it('produces the same string for equal objects with different key order', () => {
    const a = { foo: 1, bar: 2 };
    const b = { bar: 2, foo: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles nested objects deterministically', () => {
    const a = { x: { z: 9, y: 8 }, w: [1, 2, 3] };
    const b = { w: [1, 2, 3], x: { y: 8, z: 9 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('strips undefined values', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe(stableStringify({ b: 1 }));
  });

  it('handles primitives and null', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('undefined');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify('hi')).toBe('"hi"');
  });
});

describe('fingerprint', () => {
  it('is 16 hex chars', () => {
    const h = fingerprint({ x: 1 });
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic across runs', () => {
    expect(fingerprint({ a: 1, b: [2, 3] })).toBe(fingerprint({ a: 1, b: [2, 3] }));
  });

  it('changes when the input changes', () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });

  it('does not depend on key order', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });
});
