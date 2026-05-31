/**
 * `translate()` — entry point for every text-producing surface in
 * BossNyumba. Mirrors @borjie/translation contract.
 *
 * Flow:
 *   1. sourceLang === targetLang → passthrough.
 *   2. Cache lookup by content-hash; hit → return.
 *   3. Miss → Claude translator call → cache write → return.
 *   4. Failure → fail-open with source text (logged), unless
 *      strict: true.
 */

import type {
  ClaudeTranslatorPort,
  TranslateInput,
  TranslateOutput,
  TranslationCachePort,
} from './types.js';

export interface TranslateDeps {
  readonly cache: TranslationCachePort;
  readonly translator: ClaudeTranslatorPort;
  readonly logger: {
    readonly info: (msg: string, meta?: Record<string, unknown>) => void;
    readonly warn: (msg: string, meta?: Record<string, unknown>) => void;
    readonly error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  readonly defaultSurface?: string;
  readonly now?: () => number;
}

export interface TranslateOptions {
  readonly strict?: boolean;
}

export type TranslateFn = (
  input: TranslateInput,
  options?: TranslateOptions,
) => Promise<TranslateOutput>;

const PASSTHROUGH_SURFACE_FALLBACK = 'unspecified';
const CLAUDE_PROVIDER_ID = 'claude-sonnet-4-5';

export function createTranslate(deps: TranslateDeps): TranslateFn {
  const now = deps.now ?? (() => Date.now());

  return async function translate(input, options): Promise<TranslateOutput> {
    const t0 = now();
    const surface = input.surface ?? deps.defaultSurface ?? PASSTHROUGH_SURFACE_FALLBACK;
    const register = input.register ?? 'neutral';

    if (input.sourceLang === input.targetLang) {
      return Object.freeze({
        text: input.text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        cacheHit: false,
        provider: 'passthrough',
        latencyMs: now() - t0,
      });
    }

    if (input.text.trim().length === 0) {
      return Object.freeze({
        text: input.text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        cacheHit: false,
        provider: 'passthrough',
        latencyMs: now() - t0,
      });
    }

    const cacheKey = {
      tenantId: input.tenantId,
      sourceText: input.text,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      register,
      surface,
    };

    let cached: string | null = null;
    try {
      cached = await deps.cache.get(cacheKey);
    } catch (err) {
      deps.logger.warn('translation.cache.get.error', {
        surface,
        error: (err as Error).message,
      });
    }

    if (cached !== null) {
      return Object.freeze({
        text: cached,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        cacheHit: true,
        provider: 'cache',
        latencyMs: now() - t0,
      });
    }

    try {
      const targetText = await deps.translator.translate({
        text: input.text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        register,
        surface,
      });

      try {
        await deps.cache.set(cacheKey, {
          targetText,
          provider: CLAUDE_PROVIDER_ID,
          glossaryVersion: 'v1',
        });
      } catch (err) {
        deps.logger.warn('translation.cache.set.error', {
          surface,
          error: (err as Error).message,
        });
      }

      deps.logger.info('translation.complete', {
        surface,
        provider: CLAUDE_PROVIDER_ID,
        latencyMs: now() - t0,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
      });

      return Object.freeze({
        text: targetText,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        cacheHit: false,
        provider: CLAUDE_PROVIDER_ID,
        latencyMs: now() - t0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.logger.error('translation.failed', {
        surface,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        error: message,
      });

      if (options?.strict === true) {
        throw new Error(`translate(${surface}): ${message}`);
      }

      return Object.freeze({
        text: input.text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        cacheHit: false,
        provider: 'passthrough',
        latencyMs: now() - t0,
      });
    }
  };
}

let globalTranslate: TranslateFn | undefined;

export function setGlobalTranslate(fn: TranslateFn): void {
  globalTranslate = fn;
}

export function resetGlobalTranslateForTests(): void {
  globalTranslate = undefined;
}

export async function translate(
  input: TranslateInput,
  options?: TranslateOptions,
): Promise<TranslateOutput> {
  if (globalTranslate === undefined) {
    if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'test') {
      const warn = (msg: string): void => {
        const stderr = (globalThis as { process?: { stderr?: { write: (s: string) => void } } })
          .process?.stderr;
        if (stderr !== undefined) {
          stderr.write(`${msg}\n`);
        }
      };
      warn(
        '[@bossnyumba/translation] translate() called before setGlobalTranslate; returning source text',
      );
    }
    return Object.freeze({
      text: input.text,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      cacheHit: false,
      provider: 'passthrough',
      latencyMs: 0,
    });
  }
  return globalTranslate(input, options);
}
