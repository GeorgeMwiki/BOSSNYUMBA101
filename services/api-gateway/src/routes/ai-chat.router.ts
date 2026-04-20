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

// @ts-nocheck

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
import { v4 as uuid } from 'uuid';

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
      // eslint-disable-next-line no-console
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
  const principal = await verifySupabaseJwt(token, {
    jwtSecret: env().SUPABASE_JWT_SECRET,
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
});

// ---------------------------------------------------------------------------
// Rate limiter — token bucket per tenant+actor
// ---------------------------------------------------------------------------

const RATE_BUCKETS = new Map<string, { tokens: number; updatedAt: number }>();
const RATE_REFILL_PER_SEC = 1;
const RATE_BURST = 30;

function checkRate(key: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key) ?? { tokens: RATE_BURST, updatedAt: now };
  const elapsed = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(RATE_BURST, bucket.tokens + elapsed * RATE_REFILL_PER_SEC);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    RATE_BUCKETS.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  RATE_BUCKETS.set(key, bucket);
  return true;
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
  iter: AsyncGenerator<StreamTurnEvent>
): Promise<void> {
  try {
    for await (const evt of iter) {
      await stream.writeSSE({
        event: evt.type,
        data: JSON.stringify(evt),
      });
    }
  } catch (err) {
    await stream.writeSSE({
      event: 'error',
      data: JSON.stringify({
        type: 'error',
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : String(err),
        retryable: false,
      }),
    });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = new Hono();

router.post('/chat', async (c) => {
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
      signal: abort.signal,
    });

    await pipeStreamTurnToSSE(stream, iter);
  });
});

export default router;
