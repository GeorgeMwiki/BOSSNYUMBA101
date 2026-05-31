/**
 * BN translate() facade tests — passthrough, cache, fallback semantics.
 */

import { describe, expect, it, vi } from 'vitest';
import { createTranslate } from '../translate.js';
import { createInMemoryTranslationCache } from '../in-memory-cache.js';
import { resolveRecipientLocale, sourceLangFor } from '../recipient-locale.js';
import type { ClaudeTranslatorPort } from '../types.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFakeTranslator(targetText: string): ClaudeTranslatorPort {
  return {
    async translate() {
      return targetText;
    },
  };
}

describe('translate()', () => {
  it('passes through when source and target match', async () => {
    const cache = createInMemoryTranslationCache();
    const translator = makeFakeTranslator('Karibu');
    const translate = createTranslate({ cache, translator, logger: makeLogger() });

    const out = await translate({
      text: 'Welcome',
      sourceLang: 'en',
      targetLang: 'en',
      tenantId: 't1',
    });

    expect(out.text).toBe('Welcome');
    expect(out.provider).toBe('passthrough');
    expect(out.cacheHit).toBe(false);
    expect(cache.stats().size).toBe(0);
  });

  it('returns cache hit on second identical call', async () => {
    const cache = createInMemoryTranslationCache();
    const translator = makeFakeTranslator('Karibu BossNyumba');
    const translate = createTranslate({ cache, translator, logger: makeLogger() });

    const first = await translate({
      text: 'Welcome to BossNyumba',
      sourceLang: 'en',
      targetLang: 'sw',
      tenantId: 't1',
      surface: 'email.welcome.subject',
    });
    expect(first.cacheHit).toBe(false);
    expect(first.text).toBe('Karibu BossNyumba');

    const second = await translate({
      text: 'Welcome to BossNyumba',
      sourceLang: 'en',
      targetLang: 'sw',
      tenantId: 't1',
      surface: 'email.welcome.subject',
    });
    expect(second.cacheHit).toBe(true);
    expect(second.text).toBe('Karibu BossNyumba');
    expect(second.provider).toBe('cache');
  });

  it('fails open with source text when translator throws', async () => {
    const cache = createInMemoryTranslationCache();
    const broken: ClaudeTranslatorPort = {
      async translate() {
        throw new Error('claude unavailable');
      },
    };
    const logger = makeLogger();
    const translate = createTranslate({ cache, translator: broken, logger });

    const out = await translate({
      text: 'Welcome to BossNyumba',
      sourceLang: 'en',
      targetLang: 'sw',
      tenantId: 't1',
      surface: 'email.welcome.subject',
    });
    expect(out.text).toBe('Welcome to BossNyumba');
    expect(out.provider).toBe('passthrough');
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws when strict=true and translator fails', async () => {
    const cache = createInMemoryTranslationCache();
    const broken: ClaudeTranslatorPort = {
      async translate() {
        throw new Error('claude unavailable');
      },
    };
    const translate = createTranslate({
      cache,
      translator: broken,
      logger: makeLogger(),
    });

    await expect(
      translate(
        {
          text: 'Welcome',
          sourceLang: 'en',
          targetLang: 'sw',
          tenantId: 't1',
          surface: 'email.subject',
        },
        { strict: true },
      ),
    ).rejects.toThrow('claude unavailable');
  });
});

describe('resolveRecipientLocale', () => {
  it('prefers profile language', () => {
    expect(
      resolveRecipientLocale({
        profilePreferredLanguage: 'sw',
        tenantDefaultLanguage: 'en',
      }),
    ).toBe('sw');
  });

  it('falls back to tenant default', () => {
    expect(
      resolveRecipientLocale({
        profilePreferredLanguage: null,
        tenantDefaultLanguage: 'sw',
      }),
    ).toBe('sw');
  });

  it('falls back to en when neither is supported', () => {
    expect(
      resolveRecipientLocale({
        profilePreferredLanguage: 'fr',
        tenantDefaultLanguage: 'de',
      }),
    ).toBe('en');
  });
});

describe('sourceLangFor', () => {
  it('returns the opposite of target', () => {
    expect(sourceLangFor('sw')).toBe('en');
    expect(sourceLangFor('en')).toBe('sw');
  });
});
