/**
 * /api/v1/translate — BossNyumba locale toggle re-translation endpoint.
 *
 * Purpose:
 *   When a user toggles between Swahili and English in the BossNyumba
 *   chat widget, every cached message whose `content[newLang]` is empty
 *   must be re-rendered in the new language so the transcript stays in
 *   ONE language end-to-end (no mixed sw/en lines). The widget calls
 *   this endpoint in parallel (one POST per missing translation) and
 *   stores the result in `localStorage` under
 *   `bossnyumba_chat_history_v1`.
 *
 * Wire shape:
 *   POST /api/v1/translate
 *     body:  { text, from, to, context? }
 *     reply: { translation }
 *
 * Implementation notes:
 *   - Backed by Claude Haiku (cheapest tier, ~$0.25 / Mtok input).
 *     We invoke the @anthropic-ai/sdk lazily so the gateway can boot
 *     in dev environments without the SDK present (it falls through to
 *     a `{ kind: 'unconfigured' }` error which the widget renders as
 *     a transient banner — the user can keep chatting in the new
 *     language; only the history scrollback remains stale).
 *   - System prompt is tight: "Translate from {from} to {to}. Preserve
 *     property-management terms (DSR, NOI, MRI, KRA, CRB, BRELA, lease,
 *     unit, parcel) as-is. Return ONLY the translation."
 *   - Cached in Redis keyed by sha256(text+from+to+context) with a
 *     7-day TTL so repeat toggles cost zero LLM tokens. Falls back to
 *     a process-local LRU when REDIS_URL is unset (the gateway uses
 *     the same pattern in the rate-limit middleware).
 *   - No tenant scope on the cache key: translations are pure text →
 *     text functions with no sensitive context. The widget never sends
 *     anything beyond the visible chat content the user already sees.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TranslateLanguage = z.enum(['en', 'sw']);

const TranslateRequestSchema = z
  .object({
    text: z.string().min(1).max(8_000),
    from: TranslateLanguage,
    to: TranslateLanguage,
    context: z.string().max(60).optional(),
  })
  .refine((d) => d.from !== d.to, {
    message: 'from and to must differ',
    path: ['to'],
  });

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export interface TranslateResponse {
  readonly translation: string;
}

// ---------------------------------------------------------------------------
// Cache — Redis with in-memory fallback
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CACHE_KEY_PREFIX = 'bossnyumba:translate:v1';

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function buildCacheKey(req: TranslateRequest): string {
  const ctx = req.context ?? '';
  const hash = createHash('sha256')
    .update(`${req.text} ${req.from} ${req.to} ${ctx}`)
    .digest('hex');
  return `${CACHE_KEY_PREFIX}:${hash}`;
}

class InMemoryCache implements CacheBackend {
  private readonly store = new Map<string, { readonly value: string; readonly expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1_000;
    this.store.set(key, { value, expiresAt });
    if (this.store.size > 5_000) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
  }
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  on?: (event: string, handler: (err: Error) => void) => unknown;
}

class RedisCache implements CacheBackend {
  constructor(
    private readonly client: RedisLike,
    private readonly fallback: CacheBackend,
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch {
      await this.fallback.set(key, value, ttlSeconds);
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic client — lazy load, singleton, fail-soft
// ---------------------------------------------------------------------------

interface AnthropicLike {
  readonly messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{ content: ReadonlyArray<{ type: string; text?: string }> }>;
  };
}

let anthropicSingleton: AnthropicLike | null | undefined;

async function loadAnthropic(): Promise<AnthropicLike | null> {
  if (anthropicSingleton !== undefined) return anthropicSingleton;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    anthropicSingleton = null;
    return null;
  }
  try {
    const mod = (await import('@anthropic-ai/sdk')) as unknown as {
      default?: new (cfg: { apiKey: string }) => AnthropicLike;
      Anthropic?: new (cfg: { apiKey: string }) => AnthropicLike;
    };
    const Ctor = mod.default ?? mod.Anthropic;
    if (!Ctor) {
      anthropicSingleton = null;
      return null;
    }
    anthropicSingleton = new Ctor({ apiKey: key });
    return anthropicSingleton;
  } catch {
    anthropicSingleton = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt + translation
// ---------------------------------------------------------------------------

const TRANSLATE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1_024;

const LANGUAGE_LABEL: Record<'en' | 'sw', string> = {
  en: 'English',
  sw: 'Swahili (Kiswahili)',
};

function buildSystemPrompt(from: 'en' | 'sw', to: 'en' | 'sw'): string {
  return [
    `Translate the following BossNyumba property-management context message from ${LANGUAGE_LABEL[from]} to ${LANGUAGE_LABEL[to]}.`,
    'Preserve technical terms (DSR, NOI, MRI, KRA, CRB, BRELA, lease, unit, parcel, tenant) as-is.',
    'Preserve all numbers, currency codes (TZS, KES, USD), and proper nouns.',
    'Return ONLY the translation, no commentary, no preamble, no quotes, no markdown.',
  ].join(' ');
}

async function translateViaAnthropic(
  client: AnthropicLike,
  req: TranslateRequest,
): Promise<string> {
  const response = await client.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(req.from, req.to),
    messages: [{ role: 'user', content: req.text }],
  });
  let out = '';
  for (const block of response.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') out += block.text;
  }
  return out.trim();
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export interface TranslateRouterDeps {
  /** Optional override of the Anthropic client (tests). */
  readonly anthropicClient?: AnthropicLike | null;
  /** Optional override of the cache backend (tests). */
  readonly cache?: CacheBackend;
  /** Optional pre-built Redis-like client. When unset, the router lazily
   *  constructs one from REDIS_URL (the same pattern the rate-limit
   *  middleware uses). */
  readonly redisClient?: RedisLike;
  /** Override the system clock for tests. */
  readonly now?: () => number;
}

let sharedCache: CacheBackend | null = null;

async function resolveCache(deps: TranslateRouterDeps): Promise<CacheBackend> {
  if (deps.cache) return deps.cache;
  if (sharedCache) return sharedCache;

  const fallback = new InMemoryCache();
  const url = process.env.REDIS_URL?.trim();
  if (!url && !deps.redisClient) {
    sharedCache = fallback;
    return sharedCache;
  }

  let client = deps.redisClient ?? null;
  if (!client && url) {
    try {
      const mod = (await import('ioredis')) as unknown as {
        default?: new (url: string, opts?: Record<string, unknown>) => RedisLike;
        Redis?: new (url: string, opts?: Record<string, unknown>) => RedisLike;
      };
      const Ctor = mod.default ?? mod.Redis;
      if (Ctor) {
        client = new Ctor(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
        if (typeof client.on === 'function') {
          client.on('error', () => {
            /* swallow — Redis cache degrades silently to in-memory */
          });
        }
      }
    } catch {
      client = null;
    }
  }

  sharedCache = client ? new RedisCache(client, fallback) : fallback;
  return sharedCache;
}

/**
 * Build the /api/v1/translate sub-router. Mounted at `/translate` by the
 * gateway so the full path is `/api/v1/translate`.
 */
export function createTranslateRouter(deps: TranslateRouterDeps = {}): Hono {
  const app = new Hono();

  app.post('/', zValidator('json', TranslateRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const cache = await resolveCache(deps);
    const cacheKey = buildCacheKey(body);

    const cached = await cache.get(cacheKey);
    if (cached) {
      return c.json<TranslateResponse>({ translation: cached });
    }

    const client = deps.anthropicClient !== undefined ? deps.anthropicClient : await loadAnthropic();
    if (!client) {
      return c.json(
        {
          error: 'translation_unavailable',
          message:
            'BossNyumba translation service is not configured on this gateway. The widget will keep working in the newly selected language for fresh turns.',
        },
        503,
      );
    }

    let translation = '';
    try {
      translation = await translateViaAnthropic(client, body);
    } catch (err) {
      return c.json(
        {
          error: 'translation_failed',
          message: err instanceof Error ? err.message : 'unknown_error',
        },
        502,
      );
    }

    if (!translation) {
      return c.json(
        {
          error: 'empty_translation',
          message: 'Model returned an empty translation.',
        },
        502,
      );
    }

    await cache.set(cacheKey, translation, CACHE_TTL_SECONDS);
    return c.json<TranslateResponse>({ translation });
  });

  return app;
}

// Default export for the standard mount path used by the gateway index.
export const translateRouter = createTranslateRouter();
