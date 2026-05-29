import { describe, expect, it } from 'vitest';

import { toPgTextArray } from '../pg-array.js';

describe('toPgTextArray', () => {
  it('returns canonical empty literal for []', () => {
    expect(toPgTextArray([])).toBe('{}');
  });

  it('wraps each element in double quotes', () => {
    expect(toPgTextArray(['a', 'b'])).toBe('{"a","b"}');
  });

  it('escapes embedded backslashes', () => {
    expect(toPgTextArray(['a\\b'])).toBe('{"a\\\\b"}');
  });

  it('escapes embedded double quotes', () => {
    expect(toPgTextArray(['a"b'])).toBe('{"a\\"b"}');
  });

  it('handles real-estate scope ids', () => {
    expect(toPgTextArray(['nyumba_palace', 'unit_4b'])).toBe(
      '{"nyumba_palace","unit_4b"}',
    );
  });
});
