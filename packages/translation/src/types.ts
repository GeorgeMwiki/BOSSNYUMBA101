/**
 * `@bossnyumba/translation` — facade types.
 *
 * Mirrors @borjie/translation. Wraps Anthropic SDK with a cache layer
 * keyed by (sourceText, sourceLang, targetLang, glossaryVersion,
 * register).
 *
 * The cache table (`translation_cache`) is shared by every surface
 * that emits user-facing text: emails, PDFs, push, SMS, audit log
 * render, decision-journal render, webhook payloads, cron workers,
 * reports, badges, error toasts.
 *
 * BossNyumba domain hint: real estate (property management) — not
 * mining. Tanzanian Swahili variant rule preserved.
 */

export type Locale = 'en' | 'sw';
export type Register = 'casual' | 'neutral' | 'formal';

export interface TranslateInput {
  readonly text: string;
  readonly sourceLang: Locale;
  readonly targetLang: Locale;
  readonly tenantId: string;
  readonly register?: Register;
  /** Optional surface label for telemetry / cache key isolation. */
  readonly surface?: string;
}

export interface TranslateOutput {
  readonly text: string;
  readonly sourceLang: Locale;
  readonly targetLang: Locale;
  readonly cacheHit: boolean;
  readonly provider: 'cache' | 'passthrough' | 'claude-sonnet-4-5';
  readonly latencyMs: number;
}

export interface TranslationCachePort {
  readonly get: (key: TranslationCacheKey) => Promise<string | null>;
  readonly set: (key: TranslationCacheKey, value: TranslationCacheValue) => Promise<void>;
}

export interface TranslationCacheKey {
  readonly tenantId: string;
  readonly sourceText: string;
  readonly sourceLang: Locale;
  readonly targetLang: Locale;
  readonly register: Register;
  readonly surface: string;
}

export interface TranslationCacheValue {
  readonly targetText: string;
  readonly provider: string;
  readonly glossaryVersion: string;
}

/**
 * Provider port — the Claude runner conforms to this. Lets tests
 * inject a deterministic fake without touching the network.
 */
export interface ClaudeTranslatorPort {
  readonly translate: (input: {
    readonly text: string;
    readonly sourceLang: Locale;
    readonly targetLang: Locale;
    readonly register: Register;
    readonly surface: string;
  }) => Promise<string>;
}
