/**
 * /api/v1/ai/chat — streaming chat router.
 *
 * This is the transport the chat UIs (`useChatStream`) consume. It wraps
 * Brain's `streamTurn` orchestrator generator in an SSE response frame so
 * the browser can render typing deltas, tool calls, tool results, and
 * proposed actions incrementally.
 *
 * Endpoints:
 *   POST /api/v1/ai/chat          — authenticated, persona-aware streaming
 *
 * The public/marketing variant lives in `public-marketing.router.ts` and
 * re-uses `buildSseStream` to stream Mr. Mwikila's responses unauthenticated.
 *
 * SSE contract (matches packages/ai-copilot StreamTurnEvent):
 *   event: turn_start\ndata: {...}\n\n
 *   event: delta\ndata: {"content":"..."}\n\n
 *   event: tool_call\ndata: {...}\n\n
 *   event: tool_result\ndata: {...}\n\n
 *   event: proposed_action\ndata: {...}\n\n
 *   event: turn_end\ndata: {...}\n\n
 */


import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import {
  BrainRegistry,
  createBrain,
  PostgresThreadStoreBackend,
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
  streamTurn,
  type StreamTurnEvent,
} from '@bossnyumba/ai-copilot';
import {
  createDatabaseClient,
  BrainThreadRepository,
} from '@bossnyumba/database';
import {
  createNeo4jClient,
  createGraphQueryService,
  createGraphAgentToolkit,
} from '@bossnyumba/graph-sync';
import { getBrainExtraSkills } from '../composition/brain-extensions';
import { auditChatResponse, cleanChatResponse } from '../composition/chat-response-gate';
import { rateLimiter as sharedRateLimiter } from '../middleware/rate-limiter';
import { bridgeTabTags } from '../lib/chat-tab-bridge';
import { v4 as uuid } from 'uuid';

import { withSecurityEvents } from '@bossnyumba/observability';
// ---------------------------------------------------------------------------
// Lazy boot — the brain registry is constructed on first request so the
// gateway continues to boot for unrelated routes when ANTHROPIC_API_KEY is
// absent (dev + test paths).
// ---------------------------------------------------------------------------

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
let dbCache: ReturnType<typeof createDatabaseClient> | null = null;
let registryCache: BrainRegistry | null = null;

function env() {
  if (!envCache) envCache = loadBrainEnv(process.env);
  return envCache;
}

function db() {
  if (!dbCache) dbCache = createDatabaseClient(env().DATABASE_URL);
  return dbCache;
}

function registry() {
  if (registryCache) return registryCache;
  const e = env();
  const graphToolkit = (() => {
    if (!process.env.NEO4J_URI?.trim()) return undefined;
    try {
      const neo4j = createNeo4jClient();
      return createGraphAgentToolkit(createGraphQueryService(neo4j));
    } catch (err) {
      console.error('ai-chat.router: failed to construct graph toolkit', err);
      return undefined;
    }
  })();
  registryCache = new BrainRegistry((tenantId) => {
    const repo = new BrainThreadRepository(db());
    const backend = new PostgresThreadStoreBackend(repo, () => tenantId);
    return createBrain({
      anthropic: {
        apiKey: e.ANTHROPIC_API_KEY,
        baseUrl: e.ANTHROPIC_BASE_URL,
        defaultModel: e.ANTHROPIC_MODEL_DEFAULT,
      },
      threadStoreBackend: backend,
      graphToolkit,
      extraSkills: getBrainExtraSkills(),
    });
  });
  return registryCache;
}

async function authenticate(c) {
  const token = extractBearer(c.req.header('authorization'));
  if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
  // Modern Supabase projects sign user access tokens with ES256 via the
  // JWKS endpoint; the legacy HS256 secret is no longer issued. Prefer the
  // JWKS path (the verifier makes `jwksUrl` win when both are present) and
  // keep the HS256 secret as a self-hosted/legacy fallback. This mirrors
  // the JWKS handling already in `middleware/auth.middleware.ts` so the
  // brain chat routes accept the same login token as the rest of the API.
  const e = env();
  const supabaseUrl = e.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const principal = await verifySupabaseJwt(token, {
    jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    jwtSecret: e.SUPABASE_JWT_SECRET,
    defaultEnvironment: 'production',
  });
  return { principal, ...principalToBrainContexts(principal) };
}

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const ChatBodySchema = z.object({
  personaId: z.string().min(1).max(80),
  subPersonaId: z.string().max(80).optional(),
  forcePersonaId: z.string().max(80).optional(),
  threadId: z.string().uuid().optional(),
  message: z.string().min(1).max(10_000),
  // Active owner/admin language for this turn. English default per CLAUDE.md;
  // the SW toggle is ABSOLUTE. Threaded into the orchestrator's estate-mode
  // overlay so the streaming estate-manager persona renders single-language
  // per the active locale. Any value other than 'sw' falls back to 'en'.
  language: z.enum(['en', 'sw']).optional(),
});

// ---------------------------------------------------------------------------
// Rate limiter — backed by the shared `rateLimiter` (same store as
// `perUserRateLimit` in `memory-declare.router.ts`). Bug fix
// A-BUG-DEEP #2: removes a per-router in-memory Map that drifted from the
// canonical limiter and could be swapped to Redis in one place later.
// ---------------------------------------------------------------------------

const CHAT_RATE_CONFIG = {
  maxRequests: 30,
  windowSizeSeconds: 60,
} as const;

function checkRate(key: string): boolean {
  return sharedRateLimiter.check(`perUser:chat:${key}`, CHAT_RATE_CONFIG).allowed;
}

// ---------------------------------------------------------------------------
// Shared SSE serializer
// ---------------------------------------------------------------------------

/**
 * Pipe an `AsyncGenerator<StreamTurnEvent>` into a Hono `streamSSE` response.
 *
 * Exported so `public-marketing.router` can re-use exactly the same event
 * framing for the unauthenticated Mr. Mwikila chat.
 */
export async function pipeStreamTurnToSSE(
  stream,
  // Accepts any event with a `type` discriminator, so the tab-bridge
  // wrapper (which yields `StreamTurnEvent | TabBridgeEvent`) composes
  // without needing a wider union baked into the @bossnyumba/ai-copilot
  // package surface.
  iter: AsyncGenerator<StreamTurnEvent | { type: string; [k: string]: unknown }>
): Promise<void> {
  try {
    for await (const evt of iter) {
      await stream.writeSSE({
        event: evt.type,
        data: JSON.stringify(evt),
      });
    }
  } catch (err) {
    // Wave-26 Agent Z4 — surface `AiBudgetExceededError` from `withBudgetGuard`
    // (and from `MultiLLMRouter.complete` via `ledger.assertWithinBudget`) as a
    // structured SSE error so the chat UI can render a friendly
    // "monthly AI budget reached" banner. Everything else maps to INTERNAL.
    const isBudgetExceeded =
      err instanceof Error &&
      ((err as { code?: string }).code === 'AI_BUDGET_EXCEEDED' ||
        err.name === 'AiBudgetExceededError');
    await stream.writeSSE({
      event: 'error',
      data: JSON.stringify({
        type: 'error',
        code: isBudgetExceeded ? 'BUDGET_EXCEEDED' : 'INTERNAL',
        message: err instanceof Error ? err.message : String(err),
        retryable: false,
      }),
    });
  }
}

// ---------------------------------------------------------------------------
// Conversation-feel streaming wrapper
//
// The anti-call-center guards (`stripChatbotFeel` / `stripTheatreFromUncertainty`,
// exposed through `cleanChatResponse`) anchor to the START (filler openers /
// verbose preambles) and END (filler closers) of the WHOLE reply, plus strip
// theatrical apologies anywhere. They therefore cannot be applied token-by-token
// — a leading "Sure! " or trailing "Hope this helps!" only becomes strippable
// once the surrounding text exists.
//
// Until now the SSE chat path streamed raw deltas to the wire and ran the guards
// only in the POST-stream audit tap, so the cleaned text was computed and then
// discarded — the guards were a NO-OP on the user-visible streaming surface.
//
// This wrapper makes them LAND: it buffers the bridged prose deltas, and right
// before the first non-text event (tool_call / tool_result / handoff /
// proposed_action / turn_end) — or at stream end — it cleans the accumulated
// text once and emits it as a single cleaned `delta`. Event ordering with the
// chat-ui `useChatStream` contract is preserved (all text precedes tool/handoff/
// turn_end). The tradeoff mirrors the public/marketing surface (full reply then
// chunk): the body settles slightly later but is FILLER-FREE when it lands.
//
// `onAccumulated` reports the RAW prose so the post-stream audit re-derives the
// same cleaned text deterministically and logs the canonical evidence verdict.
// ---------------------------------------------------------------------------

// Events that may legitimately appear DURING the text phase and must pass
// through WITHOUT triggering a body flush: the turn opener and the five
// owner-portal tab-control events that the brain emits inline (lifted out of
// the deltas by `bridgeTabTags`). These are order-independent relative to the
// cleaned body — the tab store keys by tabId, not text position — so emitting
// them ahead of the flushed body is safe. Every OTHER non-delta event
// (tool_call / tool_result / handoff / proposed_action / turn_end / error)
// marks the end of the text phase and flushes the cleaned body first.
const FEEL_PASSTHROUGH_EVENTS = new Set([
  'turn_start',
  'spawn_tabs',
  'tab_spawn',
  'tab_update',
  'tab_remove',
  'tab_proposal',
]);

export async function* streamWithConversationFeel(
  source: AsyncGenerator<{ type: string; [k: string]: unknown }>,
  onAccumulated: (raw: string) => void,
): AsyncGenerator<{ type: string; [k: string]: unknown }> {
  let buffer = '';
  let flushed = false;

  const flush = (): { type: string; content: string } | null => {
    if (flushed) return null;
    flushed = true;
    onAccumulated(buffer);
    if (buffer.length === 0) return null;
    // FAIL-OPEN: `cleanChatResponse` returns the original text on any guard
    // failure, so the body always survives. Removal-only + locale-pure, so the
    // EN/SW absolute toggle is never mixed by stripping.
    const cleaned = cleanChatResponse(buffer).cleaned;
    return { type: 'delta', content: cleaned };
  };

  for await (const evt of source) {
    const type = typeof evt.type === 'string' ? evt.type : '';
    if (type === 'delta' && typeof evt.content === 'string') {
      buffer += evt.content;
      continue;
    }
    if (FEEL_PASSTHROUGH_EVENTS.has(type)) {
      // turn_start / inline tab-control events — emit without flushing so
      // later deltas keep accumulating into the same buffer.
      yield evt;
      continue;
    }
    // Text-phase terminator — flush the cleaned body, then re-emit `evt`.
    const cleanedDelta = flush();
    if (cleanedDelta) yield cleanedDelta;
    yield evt;
  }
  // Stream ended without a trailing terminator (no turn_end): flush tail.
  const tail = flush();
  if (tail) yield tail;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = new Hono();

router.post('/chat', withSecurityEvents({ action: 'ai-chat.create', resource: 'ai-chat', severity: 'info' }, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  // Active EN/SW locale for this turn. English default per CLAUDE.md; the SW
  // toggle is ABSOLUTE. Anything other than 'sw' falls back to 'en'.
  const userLanguage: 'en' | 'sw' = parsed.data.language === 'sw' ? 'sw' : 'en';

  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    if (err instanceof SupabaseAuthError) {
      return c.json({ error: err.message, code: 'AUTH' }, err.status);
    }
    if (err instanceof BrainConfigError) {
      return c.json({ error: err.message, code: 'BRAIN_NOT_CONFIGURED' }, 503);
    }
    return c.json({ error: 'auth_failed' }, 500);
  }

  const rateKey = `${ctx.tenant.tenantId}:${ctx.actor.id}`;
  if (!checkRate(rateKey)) {
    return c.json({ error: 'rate_limited', code: 'RATE_LIMIT' }, 429);
  }

  // Wave-26 Agent Z4 — per-tenant monthly AI budget enforcement. We invoke
  // `CostLedger.assertWithinBudget` (the same primitive that `withBudgetGuard`
  // and `MultiLLMRouter.complete` call) BEFORE the SSE stream opens so an
  // over-budget tenant gets a clean 429 with `code: BUDGET_EXCEEDED` instead
  // of a half-open stream that errors mid-flight. When the ledger is absent
  // (degraded mode) we skip silently so the rest of the chat surface stays up.
  const services = c.get('services');
  const ledger = services?.aiCostLedger;
  if (ledger) {
    try {
      await ledger.assertWithinBudget(ctx.tenant.tenantId);
    } catch (err) {
      const e = err as { code?: string; name?: string; message?: string };
      if (e?.code === 'AI_BUDGET_EXCEEDED' || e?.name === 'AiBudgetExceededError') {
        return c.json(
          {
            error: e.message ?? 'monthly AI budget exceeded',
            code: 'BUDGET_EXCEEDED',
          },
          429,
        );
      }
      // Ledger-lookup failures must not block the chat — log once and proceed.
      console.warn('ai-chat.router: budget pre-flight check failed (non-fatal)', e?.message ?? e);
    }
  }

  let brain;
  try {
    brain = registry().for(ctx.tenant.tenantId);
  } catch (err) {
    if (err instanceof BrainConfigError) {
      return c.json({ error: err.message, code: 'BRAIN_NOT_CONFIGURED' }, 503);
    }
    throw err;
  }

  // Ensure a thread exists. The authenticated /api/v1/brain/turn endpoint
  // starts a thread on demand, so we mirror that behaviour here.
  let threadId = parsed.data.threadId;
  if (!threadId) {
    const thread = await brain.threads.createThread({
      id: uuid(),
      tenantId: ctx.tenant.tenantId,
      initiatingUserId: ctx.actor.id,
      primaryPersonaId: parsed.data.forcePersonaId ?? parsed.data.personaId,
      title: parsed.data.message.slice(0, 80),
      status: 'open',
    });
    threadId = thread.id;
  }

  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => abort.abort());

    const iter = streamTurn(brain.orchestrator, {
      threadId,
      tenant: ctx.tenant,
      actor: ctx.actor,
      viewer: ctx.viewer,
      userText: parsed.data.message,
      forcePersonaId: parsed.data.forcePersonaId ?? parsed.data.personaId,
      // Thread the active EN/SW locale into the estate-mode overlay so the
      // streaming estate-manager persona answers single-language per the
      // absolute toggle. Defaults to 'en' when the client omits it.
      userLanguage,
      signal: abort.signal,
    });

    // Wrap the raw orchestrator stream so inline `<spawn_tabs>` /
    // `<tab_*>` control tags are lifted out of the visible deltas and
    // re-emitted as their own SSE envelopes the owner-portal tab store
    // can consume. Non-tab events pass through unchanged.
    const bridged = bridgeTabTags(iter);

    // Wave-AC1: SOFT-mode auditor tap — capture final turn metadata
    // (persona + tokens) for the post-stream audit log. The raw reply text
    // is captured separately by `streamWithConversationFeel` below.
    let accumulatedText = '';
    let lastPersonaId: string | null = null;
    let lastTokens = 0;
    const metadataTap = (async function* () {
      for await (const evt of bridged) {
        const e = evt as { type?: unknown; finalPersonaId?: unknown; totalTokens?: unknown };
        if (e.type === 'turn_end') {
          if (typeof e.finalPersonaId === 'string') lastPersonaId = e.finalPersonaId;
          if (typeof e.totalTokens === 'number') lastTokens = e.totalTokens;
        }
        yield evt as { type: string; [k: string]: unknown };
      }
    })();

    // Conversation-feel: buffer the prose deltas and emit the chatbot-feel
    // filler-STRIPPED body to the wire (anti-call-center guards LAND here on
    // the user-visible streaming path). `onAccumulated` hands us the RAW
    // prose so the post-stream audit re-derives the same cleaned text and
    // logs the canonical evidence verdict.
    const feelIter = streamWithConversationFeel(metadataTap, (raw) => {
      accumulatedText = raw;
    });

    await pipeStreamTurnToSSE(stream, feelIter);

    try {
      const verdict = await auditChatResponse({
        tenantId: ctx.tenant.tenantId,
        threadId,
        userId: ctx.viewer.userId,
        personaId: lastPersonaId ?? parsed.data.forcePersonaId ?? parsed.data.personaId,
        responseText: accumulatedText,
        tokensUsed: lastTokens,
      });
      // SOFT MODE — emit observability event so dashboards can chart
      // evidence-chain violations without the front-end having to
      // change behaviour. Best-effort: a closed stream is non-fatal.
      await stream.writeSSE({
        event: 'auditor',
        data: JSON.stringify({
          verdict: verdict.verdict,
          evidenceCount: verdict.evidenceCount,
          auditLogId: verdict.auditLogId,
          evidenceWarning: verdict.evidenceWarning,
        }),
      });
    } catch {
      // Post-stream audit + write are observability-only — never throw
      // back to the client. The structured log inside auditChatResponse
      // is the canonical signal.
    }
  });
}));

export default router;
