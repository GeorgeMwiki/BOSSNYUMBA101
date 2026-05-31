import { describe, expect, it } from 'vitest';
import { contentHash, canonicalCacheString } from '../hash.js';
import type { TranslationCacheKey } from '../types.js';

function key(overrides: Partial<TranslationCacheKey> = {}): TranslationCacheKey {
  return {
    tenantId: 't1',
    sourceText: 'Welcome to BossNyumba',
    sourceLang: 'en',
    targetLang: 'sw',
    register: 'neutral',
    surface: 'email.welcome.subject',
    ...overrides,
  };
}

describe('contentHash', () => {
  it('produces a 64-char hex digest', () => {
    expect(contentHash(key())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across calls', () => {
    expect(contentHash(key())).toBe(contentHash(key()));
  });

  it('ignores tenantId — same content across tenants collapses', () => {
    expect(contentHash(key({ tenantId: 't1' }))).toBe(
      contentHash(key({ tenantId: 't2' })),
    );
  });

  it('changes when source text changes', () => {
    expect(contentHash(key({ sourceText: 'Hello' }))).not.toBe(
      contentHash(key({ sourceText: 'Bye' })),
    );
  });

  it('changes when target language changes', () => {
    expect(contentHash(key({ targetLang: 'sw' }))).not.toBe(
      contentHash(key({ targetLang: 'en' })),
    );
  });
});

describe('canonicalCacheString', () => {
  it('joins fields including text', () => {
    const s = canonicalCacheString(key());
    expect(s).toContain('Welcome to BossNyumba');
    expect(s).toContain('email.welcome.subject');
  });
});
