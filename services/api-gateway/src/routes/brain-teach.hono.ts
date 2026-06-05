// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (same root cause as brain.hono.ts /
// brain-dispatch.hono.ts). Tracked at hono-dev/hono#3891.

/**
 * Authenticated BossNyumba teaching chat — /api/v1/brain/teach (Gap 7).
 *
 * A lightweight, direct-LLM teaching surface for the owner/admin home screen.
 * DOES NOT touch the existing /api/v1/brain/turn route — purely additive.
 * /turn keeps its tool-calling persona-runtime; /teach is a chat-first stream
 * that walks the owner up the ESTATE lesson ladder.
 *
 * Retargeted from Borjie's mining HOME teaching chat to the real-estate
 * domain. The five-rung mining ladder (orient → licence → royalty → workforce
 * → marketplace) becomes the BossNyumba estate ladder:
 *
 *   1. ORIENT      — what BossNyumba is + how Mr. Mwikila helps.
 *   2. ONBOARDING  — get the portfolio in (properties, units, leases, rent roll).
 *   3. ARREARS     — find + chase the money owed; rent-collection discipline.
 *   4. COMPLIANCE  — statutory filings, certificates, audits before they bite.
 *   5. GROWTH      — occupancy, renewals, pricing, acquisition.
 *
 * Gap-5 wiring: the route resolves the mode-switched estate-manager persona
 * (`resolveEstateManagerWithMode`) for the owner's message so the teaching
 * register matches the active estate mode (Build / Operations / Finance /
 * Growth / Compliance). The selected mode is surfaced in the `turn.accepted`
 * SSE frame and the mode's mandate is folded into the teaching system prompt.
 *
 * Provider ladder (every entry tried regardless of error class — never a
 * curated fallback string):
 *   1. Anthropic — env override BOSSNYUMBA_HOME_ANTHROPIC_MODEL.
 *   2. OpenAI    — env override BOSSNYUMBA_HOME_OPENAI_MODEL.
 *
 * Wire shape (SSE) — preserved from Borjie so the chat-ui renderer is shared:
 *   event: turn.accepted     { mode:'teach', step, estateMode, language, sessionId, tenantId, at }
 *   event: message_chunk     { text, chunkNo, batched, evidence_ids[], confidence, done }
 *   event: ui_block          { block: {type, ...}, at }
 *   event: inline_metric     { metric: {label,value,tone}, at }
 *   event: suggested_actions { actions:string[], at }
 *   event: done              { at, provider, depth, latencyMs, attempts, ... }
 *   event: error             { kind, message, retryable }
 *
 * Honest-degrade: NO mock data. If every provider fails the stream emits a
 * real `error` event and the renderer surfaces it to the owner. Currency- and
 * jurisdiction-neutral; FULL EN + SW with single-language purity per locale.
 * Pino logger only.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import {
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  resolveEstateManagerWithMode,
  type EstateManagerModeId,
} from '@bossnyumba/ai-copilot';
import {
  AnthropicAdapter,
  OpenAIAdapter,
} from '@bossnyumba/brain-llm-router/universal-client';
import type {
  BrainLLMClient,
  BrainLLMMessage,
  BrainLLMResponse,
} from '@bossnyumba/brain-llm-router';
import { createAdaptiveStreamController } from '../services/brain/sse-adaptive';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'brain-teach',
});

// ─── Request validation ──────────────────────────────────────────────────

const TeachChatSchema = z
  .object({
    message: z.string().min(1).max(4000).optional(),
    query: z.string().min(1).max(4000).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          text: z.string().min(1).max(8000),
        }),
      )
      .max(40)
      .optional(),
    // English default per CLAUDE.md; SW toggle is absolute.
    language: z.enum(['en', 'sw']).optional().default('en'),
    sessionId: z.string().min(1).max(120).optional(),
    /** Lesson step the client thinks the owner is on (1-5). */
    step: z.number().int().min(1).max(5).optional(),
  })
  .refine((d) => Boolean(d.message ?? d.query), {
    message: 'message or query is required',
    path: ['message'],
  });

// ─── Auth — verified Supabase JWT, mirrors brain.hono.ts (JWKS-first) ──────

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

async function authenticate(c) {
  const token = extractBearer(c.req.header('authorization'));
  if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
  const e = env();
  const supabaseUrl = e.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const principal = await verifySupabaseJwt(token, {
    jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    jwtSecret: e.SUPABASE_JWT_SECRET,
    defaultEnvironment: 'production',
  });
  return principalToBrainContexts(principal);
}

// ─── Providers ─────────────────────────────────────────────────────────────

interface Providers {
  readonly anthropic: AnthropicAdapter | null;
  readonly openai: OpenAIAdapter | null;
}

function buildProviders(): Providers {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  return {
    anthropic: anthropicKey ? new AnthropicAdapter({ apiKey: anthropicKey }) : null,
    openai: openaiKey ? new OpenAIAdapter({ apiKey: openaiKey }) : null,
  };
}

let providersCache: Providers | null = null;
function providers(): Providers {
  if (!providersCache) providersCache = buildProviders();
  return providersCache;
}

// ─── Estate teaching system prompts (FULL EN + SW) ─────────────────────────
//
// Single-language purity per locale: the EN prompt forbids any Swahili and the
// SW prompt forbids any English. Currency- and jurisdiction-neutral — the
// model never names a currency or country; money is described abstractly and
// the renderer formats real figures.

const BOSSNYUMBA_TEACHING_SYSTEM_PROMPT_EN = [
  'You are Mr. Mwikila, the brain layer of BossNyumba — an AI-native real',
  'estate operating system for East African landlords, portfolio managers,',
  'leasing agents, housing cooperatives, and institutional property holders.',
  '',
  'You are teaching the owner how to run their property business with',
  'BossNyumba. Walk them up a five-rung ESTATE lesson ladder, one rung at a',
  'time, grounded in THEIR portfolio:',
  '  1. ORIENT      — what BossNyumba is and how you (Mr. Mwikila) help.',
  '  2. ONBOARDING  — getting the portfolio in: properties, units, leases,',
  '                   the rent roll.',
  '  3. ARREARS     — finding and chasing the money owed; rent-collection',
  '                   discipline.',
  '  4. COMPLIANCE  — statutory filings, certificates, and audits handled',
  '                   before they bite.',
  '  5. GROWTH      — occupancy, lease renewals, pricing, acquisition.',
  '',
  'STRATEGIC INTENT (invisible — never name these labels to the owner):',
  '  ASSESS what the owner already knows, TEACH the next concept, point to a',
  '  concrete next action they can EXECUTE, and SUMMARIZE what changed.',
  '',
  'HARD RULES:',
  '  - Reply in English ONLY. Never mix languages within a single reply.',
  '    Never open with a Swahili greeting.',
  '  - Never invent a number. Reference the owner\'s real data when you have',
  '    it; when you do not, ask a specific question or propose how to get it.',
  '  - Never name a hard-coded currency. Describe money abstractly; the app',
  '    renders real figures in the tenant\'s configured currency.',
  '  - Keep it concrete and East-Africa-grounded, but never assume a country.',
  '',
  'STYLE: one-sentence answer first, then the short teaching, then the single',
  'most useful next action. Speak plainly and respectfully — like a trusted',
  'estate director, not a textbook.',
  '',
  'OPTIONAL STRUCTURED BLOCKS (emit at most ONE primary ui_block, and up to',
  'TWO inline_metric chips, only when they genuinely help):',
  '  - A primary block:  <ui_block>{"type":"concept_card",...}</ui_block>',
  '    Allowed types: concept_card, metric_strip, decision_card,',
  '    step_progress, level_select.',
  '  - Live data chips:  <inline_metric>{"label":"Open arrears","value":"…",',
  '    "tone":"warning"}</inline_metric>  (tone: positive | neutral | warning).',
  '  - End with up to four next-step suggestions, each on its own line as:',
  '    ACTION: <short imperative>',
  'Frame the suggestions as next / deeper / wider so the owner sees which is',
  'the next rung, which goes deeper, and which goes wider.',
].join('\n');

const BOSSNYUMBA_TEACHING_SYSTEM_PROMPT_SW = [
  'Wewe ni Bwana Mwikila, tabaka la akili la BossNyumba — mfumo wa uendeshaji',
  'wa mali isiyohamishika unaotumia akili bandia kwa wamiliki wa nyumba,',
  'wasimamizi wa portfolio, mawakala wa upangishaji, vyama vya ushirika wa',
  'nyumba, na taasisi zinazomiliki majengo Afrika Mashariki.',
  '',
  'Unamfundisha mmiliki jinsi ya kuendesha biashara yake ya mali kwa kutumia',
  'BossNyumba. Mpandishe ngazi tano za somo la ESTATE, hatua moja kwa wakati,',
  'ukitumia portfolio YAKE kama msingi:',
  '  1. MWELEKEO   — BossNyumba ni nini na wewe (Bwana Mwikila) unasaidiaje.',
  '  2. USAJILI    — kuingiza portfolio: majengo, vyumba, mikataba, na orodha',
  '                  ya kodi (rent roll).',
  '  3. MADENI     — kutafuta na kufuatilia fedha zinazodaiwa; nidhamu ya',
  '                  ukusanyaji kodi.',
  '  4. UTII       — mawasilisho ya kisheria, vyeti, na ukaguzi kushughulikiwa',
  '                  kabla havijaleta matatizo.',
  '  5. UKUAJI     — ujazaji wa vyumba, kuendeleza mikataba, bei, na ununuzi.',
  '',
  'NIA YA KIMKAKATI (ya siri — usitaje majina haya kwa mmiliki):',
  '  PIMA kile mmiliki anachojua tayari, FUNDISHA dhana inayofuata, onyesha',
  '  hatua moja madhubuti ya KUTEKELEZA, na FUPISHA kilichobadilika.',
  '',
  'SHERIA NGUMU:',
  '  - Jibu kwa Kiswahili PEKEE. Usichanganye lugha kamwe katika jibu moja.',
  '    Usianze kwa salamu ya Kiingereza.',
  '  - Usibuni namba kamwe. Taja data halisi ya mmiliki unapokuwa nayo; pale',
  '    usipokuwa nayo, uliza swali mahususi au pendekeza jinsi ya kuipata.',
  '  - Usitaje sarafu maalum. Eleza fedha kwa ujumla; programu inaonyesha',
  '    namba halisi kwa sarafu aliyochagua mmiliki.',
  '  - Weka mambo madhubuti na yenye mizizi Afrika Mashariki, lakini usidhanie',
  '    nchi yoyote.',
  '',
  'MTINDO: jibu la sentensi moja kwanza, kisha fundisho fupi, kisha hatua moja',
  'yenye manufaa zaidi inayofuata. Ongea kwa uwazi na heshima — kama',
  'mkurugenzi wa mali anayeaminika, siyo kitabu cha kiada.',
  '',
  'VIPENGELE VYA HIARI VYENYE MUUNDO (toa kIPENGELE kimoja kikuu cha ui_block',
  'pekee, na hadi chips mbili za inline_metric, pale tu vinaposaidia kweli):',
  '  - Kipengele kikuu: <ui_block>{"type":"concept_card",...}</ui_block>',
  '    Aina zinazoruhusiwa: concept_card, metric_strip, decision_card,',
  '    step_progress, level_select.',
  '  - Chips za data hai: <inline_metric>{"label":"Madeni wazi","value":"…",',
  '    "tone":"warning"}</inline_metric> (tone: positive | neutral | warning).',
  '  - Maliza kwa hadi mapendekezo manne ya hatua zinazofuata, kila moja kwenye',
  '    mstari wake kama: ACTION: <amri fupi>',
  'Panga mapendekezo kama inayofuata / kwa kina / kwa upana ili mmiliki aone',
  'ipi ni ngazi inayofuata, ipi inaenda kwa kina, na ipi inaenda kwa upana.',
].join('\n');

// ─── UI-block + inline-metric extraction (self-contained) ──────────────────

const ALLOWED_BLOCK_TYPES = new Set([
  'concept_card',
  'metric_strip',
  'decision_card',
  'step_progress',
  // Surface picker emitted on the first turn of a fresh session so the owner
  // can self-classify their literacy level.
  'level_select',
]);

const ALLOWED_INLINE_TONES = new Set(['positive', 'neutral', 'warning']);

interface ParsedUiBlock {
  readonly type: string;
  readonly [key: string]: unknown;
}

interface ParsedInlineMetric {
  readonly label: string;
  readonly value: string;
  readonly tone: 'positive' | 'neutral' | 'warning';
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Find and remove a single primary <ui_block>{...}</ui_block> from the model's
 * text. Only the first valid block is honoured; extras are dropped to keep the
 * renderer deterministic. Returns the parsed block plus the stripped body.
 */
function extractUiBlock(text: string): {
  readonly body: string;
  readonly block: ParsedUiBlock | null;
} {
  let block: ParsedUiBlock | null = null;
  const body = text.replace(
    /<ui_block>\s*(\{[\s\S]*?\})\s*<\/ui_block>/i,
    (_m, json: string) => {
      if (block) return '';
      const parsed = safeParseJson(json);
      if (
        isRecord(parsed) &&
        typeof parsed.type === 'string' &&
        ALLOWED_BLOCK_TYPES.has(parsed.type)
      ) {
        block = parsed as ParsedUiBlock;
      }
      return '';
    },
  );
  return { body, block };
}

/**
 * Strip and capture up to TWO <inline_metric>{...}</inline_metric> tags.
 * Extras dropped quietly. Each metric requires label + value; tone defaults to
 * "neutral".
 */
function extractInlineMetrics(text: string): {
  readonly body: string;
  readonly metrics: ReadonlyArray<ParsedInlineMetric>;
} {
  const found: ParsedInlineMetric[] = [];
  const body = text.replace(
    /<inline_metric>\s*(\{[\s\S]*?\})\s*<\/inline_metric>/gi,
    (_m, json: string) => {
      if (found.length >= 2) return '';
      const parsed = safeParseJson(json);
      if (!isRecord(parsed)) return '';
      const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
      const value = typeof parsed.value === 'string' ? parsed.value.trim() : '';
      const rawTone =
        typeof parsed.tone === 'string' ? parsed.tone.toLowerCase() : 'neutral';
      const tone: 'positive' | 'neutral' | 'warning' = ALLOWED_INLINE_TONES.has(
        rawTone,
      )
        ? (rawTone as 'positive' | 'neutral' | 'warning')
        : 'neutral';
      if (!label || !value) return '';
      found.push({ label, value, tone });
      return '';
    },
  );
  return { body, metrics: found };
}

/**
 * Strip and capture `ACTION: <text>` suggestion lines from the model output.
 * Each line becomes a next-step chip. Caps at four to match the prompt.
 */
function extractActions(text: string): {
  readonly body: string;
  readonly actions: ReadonlyArray<string>;
} {
  const actions: string[] = [];
  const body = text.replace(/^\s*ACTION:\s*(.+?)\s*$/gim, (_m, label: string) => {
    if (actions.length >= 4) return '';
    const trimmed = label.trim();
    if (trimmed) actions.push(trimmed);
    return '';
  });
  return { body: body.trimEnd(), actions };
}

/** Concatenate text content blocks from a BrainLLMResponse. */
function extractText(response: BrainLLMResponse): string {
  return response.content
    .filter(
      (b): b is { readonly type: 'text'; readonly text: string } =>
        b.type === 'text' && typeof (b as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Split cleaned text into words for the adaptive stream controller. */
function chunkText(text: string): ReadonlyArray<string> {
  return text.split(/(\s+)/).filter((piece) => piece.length > 0);
}

// ─── Hono app ────────────────────────────────────────────────────────────

const teachApp = new Hono();

teachApp.post('/teach', zValidator('json', TeachChatSchema), async (c) => {
  const body = c.req.valid('json');
  const message = (body.message ?? body.query ?? '').trim();
  const language = body.language ?? 'en';
  const history = body.history ?? [];
  const sessionId = body.sessionId ?? null;
  const clientStep = body.step ?? 1;
  const startedAt = Date.now();

  let auth;
  try {
    auth = await authenticate(c);
  } catch (err) {
    if (err instanceof SupabaseAuthError) {
      return c.json({ error: err.message, code: 'AUTH' }, err.status);
    }
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'brain-teach: auth failed',
    );
    return c.json({ error: 'authentication_failed', code: 'AUTH' }, 401);
  }

  // Gap-5 wiring: resolve the mode-switched estate-manager persona for THIS
  // message so the teaching register matches the active estate mode. The mode
  // is deterministic (no LLM cost); we surface it in turn.accepted and fold
  // the mode mandate into the system prompt below.
  let estateMode: EstateManagerModeId = 'operations';
  let estateModePrompt = '';
  try {
    const resolved = resolveEstateManagerWithMode(message);
    estateMode = resolved.mode;
    estateModePrompt = resolved.persona.systemPrompt;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'brain-teach: estate-mode resolution failed (continuing with base prompt)',
    );
  }

  const { anthropic, openai } = providers();

  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => abort.abort());

    await stream.writeSSE({
      event: 'turn.accepted',
      data: JSON.stringify({
        mode: 'teach',
        step: clientStep,
        estateMode,
        language,
        sessionId,
        tenantId: auth.tenant.tenantId,
        at: new Date().toISOString(),
      }),
    });

    if (!anthropic && !openai) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          kind: 'no_provider_configured',
          message:
            'No LLM provider configured (ANTHROPIC_API_KEY / OPENAI_API_KEY).',
          retryable: false,
        }),
      });
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ at: new Date().toISOString(), error: true }),
      });
      return;
    }

    const basePrompt =
      language === 'sw'
        ? BOSSNYUMBA_TEACHING_SYSTEM_PROMPT_SW
        : BOSSNYUMBA_TEACHING_SYSTEM_PROMPT_EN;

    // Inject the owner's tenant context BEFORE the teaching prompt so the
    // model can ground its teaching in the owner's real portfolio. The mode
    // mandate (gap 5) rides between the context and the base teaching prompt.
    const ownerCtx = {
      tenantId: auth.tenant.tenantId,
      tenantName: auth.tenant.tenantName,
      role: auth.actor.roles[0] ?? 'owner',
      country: process.env.DEFAULT_TENANT_COUNTRY?.trim() || 'TZ',
      language,
      step: clientStep,
      estateMode,
    };

    const systemPromptParts: string[] = [
      `<owner_context>${JSON.stringify(ownerCtx)}</owner_context>`,
      '',
    ];
    if (estateModePrompt) {
      systemPromptParts.push('## ACTIVE ESTATE MODE');
      systemPromptParts.push(estateModePrompt);
      systemPromptParts.push('');
    }
    systemPromptParts.push(basePrompt);
    const systemPrompt = systemPromptParts.join('\n');

    const messages: BrainLLMMessage[] = [
      ...history.map((h) => ({
        role: h.role,
        content: [{ type: 'text' as const, text: h.text }],
      })),
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: message }],
      },
    ];

    // 2-rung provider ladder. Every entry tried regardless of error class.
    interface LadderEntry {
      readonly model: string;
      readonly client: BrainLLMClient;
      readonly providerName: 'anthropic' | 'openai';
    }
    const ladder: LadderEntry[] = [];
    const anthropicModel =
      process.env.BOSSNYUMBA_HOME_ANTHROPIC_MODEL?.trim() ||
      process.env.BOSSNYUMBA_CHAT_ANTHROPIC_MODEL?.trim() ||
      process.env.ANTHROPIC_MODEL_DEFAULT?.trim() ||
      'claude-sonnet-4-5-20250929';
    const openaiModel =
      process.env.BOSSNYUMBA_HOME_OPENAI_MODEL?.trim() ||
      process.env.BOSSNYUMBA_CHAT_OPENAI_MODEL?.trim() ||
      'gpt-4o-2024-11-20';
    if (anthropic) {
      ladder.push({ model: anthropicModel, client: anthropic, providerName: 'anthropic' });
    }
    if (openai) {
      ladder.push({ model: openaiModel, client: openai, providerName: 'openai' });
    }

    interface Attempt {
      readonly provider: string;
      readonly model: string;
      readonly error?: string;
      readonly latencyMs: number;
    }
    const attempts: Attempt[] = [];
    let response: BrainLLMResponse | null = null;
    let winningProvider: string | null = null;
    let depth = -1;

    for (let i = 0; response === null && i < ladder.length; i++) {
      const entry = ladder[i]!;
      const t0 = Date.now();
      try {
        response = await entry.client.invoke({
          model: entry.model,
          messages,
          system: systemPrompt,
          maxTokens: 1200,
          // Higher temperature so the opener varies turn-to-turn — owners
          // should never see the same boilerplate twice.
          temperature: 0.85,
        });
        attempts.push({
          provider: entry.providerName,
          model: entry.model,
          latencyMs: Date.now() - t0,
        });
        winningProvider = entry.providerName;
        depth = i;
        break;
      } catch (err) {
        const attempt: Attempt = {
          provider: entry.providerName,
          model: entry.model,
          latencyMs: Date.now() - t0,
        };
        attempts.push({
          ...attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        logger.warn(
          {
            provider: entry.providerName,
            model: entry.model,
            err: (err instanceof Error ? err.message : String(err)).slice(0, 600),
          },
          'brain-teach: provider attempt failed',
        );
      }
    }

    if (!response) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          kind: 'all_providers_failed',
          message: `All ${ladder.length} provider(s) failed`,
          attempts,
          retryable: true,
        }),
      });
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({
          at: new Date().toISOString(),
          error: true,
          latencyMs: Date.now() - startedAt,
        }),
      });
      return;
    }

    const rawText = extractText(response);
    if (!rawText) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          kind: 'empty_response',
          message: 'Model returned no text content.',
          retryable: true,
          attempts,
        }),
      });
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ at: new Date().toISOString(), error: true }),
      });
      return;
    }

    // Order of stripping: primary ui_block first, then inline metrics, then
    // the ACTION suggestion lines, leaving clean prose for the chunk stream.
    const uiResult = extractUiBlock(rawText);
    const metricsResult = extractInlineMetrics(uiResult.body);
    const actionsResult = extractActions(metricsResult.body);
    const clean = actionsResult.body.trim();

    // Stream the cleaned text first so the renderer paints progressively
    // before the ui_block lands at the end of the bubble. The adaptive
    // controller batches for slow clients (who ACK via ?lastChunk=N) and
    // micro-streams for fast ones.
    const chunks = chunkText(clean);
    const lastChunkParam = c.req.query('lastChunk');
    const initialAck =
      lastChunkParam !== undefined && /^\d+$/.test(lastChunkParam)
        ? Number.parseInt(lastChunkParam, 10)
        : 0;
    const adaptive = createAdaptiveStreamController();
    if (initialAck > 0) adaptive.ack(initialAck);
    for (const piece of chunks) adaptive.push(piece);
    let emitted = 0;
    const total = chunks.length;
    while (!abort.signal.aborted) {
      const next = adaptive.pull();
      if (next === null) break;
      emitted += 1;
      const isLast = emitted === total;
      await stream.writeSSE({
        event: 'message_chunk',
        data: JSON.stringify({
          text: next.text,
          chunkNo: next.chunkNo,
          batched: next.batched,
          evidence_ids: [],
          confidence: isLast ? 0.9 : null,
          done: false,
        }),
      });
      const delay = adaptive.recommendedDelayMs();
      if (delay > 0) await new Promise<void>((r) => setTimeout(r, delay));
    }

    // Inline metrics — one SSE event each so the renderer attaches them as
    // chips inside the assistant bubble.
    for (const metric of metricsResult.metrics) {
      if (abort.signal.aborted) break;
      await stream.writeSSE({
        event: 'inline_metric',
        data: JSON.stringify({ metric, at: new Date().toISOString() }),
      });
    }

    // Primary ui_block (teaching) — after text so the renderer places it
    // directly under the assistant bubble.
    if (uiResult.block) {
      await stream.writeSSE({
        event: 'ui_block',
        data: JSON.stringify({
          block: uiResult.block,
          at: new Date().toISOString(),
        }),
      });
    }

    // Suggested next-step actions — framed next / deeper / wider by the prompt.
    if (actionsResult.actions.length > 0) {
      await stream.writeSSE({
        event: 'suggested_actions',
        data: JSON.stringify({
          actions: actionsResult.actions,
          at: new Date().toISOString(),
        }),
      });
    }

    await stream.writeSSE({
      event: 'done',
      data: JSON.stringify({
        at: new Date().toISOString(),
        provider: winningProvider,
        depth,
        latencyMs: Date.now() - startedAt,
        attempts: attempts.length,
        estateMode,
        actions_count: actionsResult.actions.length,
        ui_block: uiResult.block ? uiResult.block.type : null,
        inline_metrics: metricsResult.metrics.length,
      }),
    });
  });
});

export { teachApp as brainTeachRouter };
export default teachApp;
