/**
 * Document Chat API Routes (NEW 15)
 *
 *   GET  /                           — list all sessions for the tenant
 *   GET  /sessions                   — alias for GET /
 *   POST /sessions                   — start a new session (DB-backed; 201)
 *   POST /sessions/:id/ask           — append a user question + deterministic
 *                                       assistant answer. Uses a top-K
 *                                       fallback against `document_embeddings`
 *                                       when the real LLM is not wired.
 *   POST /sessions/:id/messages      — group-chat peer message (DB-backed)
 *   GET  /sessions/:id/messages      — listMessages (DB-backed)
 *   GET  /sessions/:id               — load session (DB-backed)
 *
 * Graceful degradation: when ANTHROPIC_API_KEY is not configured we still
 * persist the user + assistant messages, we just use a deterministic
 * citation-first fallback so clients can continue the flow. The response
 * is 200 for the sync path and 201 for creation.
 *
 * Tenant isolation: every read + write is scoped by `tenantId` taken from
 * the auth context so cross-tenant leakage is prevented at the query
 * boundary.
 */


import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import pino from 'pino';
import {
  docChatSessions,
  docChatMessages,
  documentEmbeddings,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch } from '../utils/safe-error';
import {
  createBrainLlmClient,
  withLlmOrHeuristic,
  BRAIN_LLM_MODELS,
} from '../services/brain/llm-call';

import { withSecurityEvents } from '@bossnyumba/observability';

// Pino logger scoped to this route (matches brain-dispatch.hono.ts). The
// brain LLM facade redacts via the caller's logger, so we pass a real
// pino instance rather than the custom api-gateway logger interface.
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'doc-chat',
});

const app = new Hono();
app.use('*', authMiddleware);

// Max prior turns to surface to the model as conversation context. Kept
// small so the grounded answer stays anchored to the retrieved chunks
// rather than drifting on older dialogue.
const HISTORY_TURN_LIMIT = 6;

// Per-answer generation caps. The model must answer strictly from the
// numbered CONTEXT block, so a modest token ceiling is sufficient.
const ANSWER_MAX_TOKENS = 1024;
const ANSWER_TEMPERATURE = 0.2;

type RetrievedChunk = {
  documentId: string;
  chunkIndex: number;
  text: string;
  score: number;
  page?: number;
};

/**
 * Grounding system prompt. The model may ONLY use the numbered CONTEXT
 * chunks supplied in the user turn; it must refuse (and say so) when the
 * answer is not present, and it must never invent citations.
 */
const ANSWER_SYSTEM_PROMPT = [
  'You are Mr. Mwikila, the AI Managing Director for BossNyumba, answering',
  'questions about a tenant-uploaded document set.',
  '',
  'Hard rules (do not break):',
  '- Answer ONLY from the numbered CONTEXT chunks supplied in the user',
  '  message. Treat them as the sole source of truth.',
  '- Ground EVERY factual claim in those chunks. When you state a fact,',
  '  reference the chunk number it came from, e.g. "(chunk 2)".',
  '- If the answer is NOT contained in the CONTEXT, say plainly that the',
  '  indexed documents do not cover it. Do NOT guess, infer beyond the',
  '  text, or use outside knowledge.',
  '- Never cite a chunk number that was not provided.',
  '- Be concise and factual. No marketing copy. No emojis.',
  '- Reply in the same language the question is written in.',
].join('\n');

/**
 * Build the numbered CONTEXT + question payload. Chunk numbers are
 * 1-based and align with the citation order returned to the client so a
 * reader can map "(chunk N)" back to the citation list.
 */
function buildAnswerUserPrompt(
  question: string,
  chunks: readonly RetrievedChunk[],
  history: ReadonlyArray<{ role: string; content: string }>,
): string {
  const contextBlock = chunks.length
    ? chunks
        .map((chunk, idx) => {
          const where =
            typeof chunk.page === 'number'
              ? `document ${chunk.documentId}, page ${chunk.page}`
              : `document ${chunk.documentId}, chunk ${chunk.chunkIndex}`;
          return `[chunk ${idx + 1}] (${where})\n${chunk.text}`;
        })
        .join('\n\n')
    : '(no relevant context was retrieved for this question)';

  const historyBlock = history.length
    ? `\n\nCONVERSATION SO FAR (most recent last, for reference only — do not treat as source of truth):\n${history
        .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join('\n')}`
    : '';

  return [
    'CONTEXT:',
    contextBlock,
    historyBlock,
    '',
    `QUESTION: ${question}`,
    '',
    'Answer the question using only the CONTEXT above, citing chunk numbers.',
  ].join('\n');
}

const StartSessionSchema = z.object({
  scope: z
    .enum(['single_document', 'multi_document', 'group_chat'])
    .default('single_document'),
  documentIds: z.array(z.string().min(1)).min(1),
  participants: z.array(z.string()).optional(),
  title: z.string().max(200).optional(),
});

const AskSchema = z.object({
  question: z.string().min(1).max(4000),
});

const PostMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

function notConfigured(c: any) {
  return c.json(
    {
      success: false,
      error: 'DocChat database not configured — DATABASE_URL unset',
    },
    503
  );
}

function newId(prefix: string): string {
  // crypto.randomUUID() is always available on supported Node versions; the
  // prefix keeps ids readable in logs + grep-ability across the codebase.
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Deterministic fallback retriever: pulls recent chunks for the session's
 * documents and ranks them by shared-token overlap with the question.
 * Intentionally small & local so we don't take a dependency on the real
 * embedding service here — the service can override this retrieval later
 * via the document-chat service without changing the API shape.
 */
async function fallbackRetrieve(
  db: any,
  tenantId: string,
  documentIds: readonly string[],
  question: string,
  topK: number
): Promise<Array<RetrievedChunk>> {
  if (!documentIds.length) return [];
  const rows = await db
    .select()
    .from(documentEmbeddings)
    .where(
      and(
        eq(documentEmbeddings.tenantId, tenantId),
        inArray(documentEmbeddings.documentId, [...documentIds])
      )
    )
    .limit(200);

  const qTokens = new Set(tokenize(question));
  if (!qTokens.size || !rows.length) return [];

  type DocChunkRow = {
    documentId: string;
    chunkIndex: number;
    chunkText?: string;
    text?: string;
    chunkMeta?: unknown;
  };
  const scored = (rows as DocChunkRow[])
    .map((r) => {
      const text = r.chunkText ?? r.text ?? '';
      const tokens = tokenize(text);
      let overlap = 0;
      for (const t of tokens) if (qTokens.has(t)) overlap += 1;
      const score = tokens.length ? overlap / Math.sqrt(tokens.length) : 0;
      const page =
        r.chunkMeta && typeof r.chunkMeta === 'object' && 'page' in r.chunkMeta
          ? (r.chunkMeta as { page?: unknown }).page
          : undefined;
      return {
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        text,
        score,
        page: typeof page === 'number' ? page : undefined,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

async function listSessions(c: any) {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(docChatSessions)
    .where(eq(docChatSessions.tenantId, tenantId))
    .orderBy(desc(docChatSessions.createdAt))
    .limit(100);
  return c.json({ success: true, data: rows });
}

app.get('/', listSessions);
app.get('/sessions', listSessions);

app.get('/sessions/:id', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(docChatSessions)
    .where(
      and(eq(docChatSessions.id, id), eq(docChatSessions.tenantId, tenantId))
    )
    .limit(1);
  if (!rows[0]) {
    return c.json(
      { success: false, error: 'Session not found' },
      404
    );
  }
  return c.json({ success: true, data: rows[0] });
});

app.get('/sessions/:id/messages', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('id');
  const rows = await db
    .select()
    .from(docChatMessages)
    .where(
      and(
        eq(docChatMessages.sessionId, sessionId),
        eq(docChatMessages.tenantId, tenantId)
      )
    )
    .orderBy(docChatMessages.createdAt);
  return c.json({ success: true, data: rows });
});

// ---------------------------------------------------------------------------
// POST /sessions — create a new chat session (persists, does not call the LLM)
// ---------------------------------------------------------------------------
app.post('/sessions', zValidator('json', StartSessionSchema), withSecurityEvents({ action: 'doc-chat.create', resource: 'doc-chat', severity: 'info' }, async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const now = new Date();
  const row = {
    id: newId('dcs'),
    tenantId,
    scope: body.scope,
    title: body.title ?? null,
    documentIds: body.documentIds,
    participants: body.participants ?? [userId],
    createdBy: userId,
    createdAt: now,
    lastMessageAt: null,
  } as const;

  try {
    const [inserted] = await db
      .insert(docChatSessions)
      .values(row)
      .returning();

    // Fire-and-forget event so subscribers can react (e.g. audit log).
    try {
      await services.eventBus?.publish({
        event: {
          eventId: newId('evt'),
          eventType: 'DocChatSessionStarted',
          timestamp: now.toISOString(),
          tenantId,
          correlationId: newId('cor'),
          causationId: null,
          metadata: {},
          payload: { sessionId: row.id, scope: body.scope },
        } as any,
        version: 1,
        aggregateId: row.id,
        aggregateType: 'DocChatSession',
      });
    } catch (_e) {
      // Event-bus publish failures must never break the create path.
    }

    return c.json({ success: true, data: inserted ?? row }, 201);
  } catch (error) {
    return routeCatch(c, error, {
      code: 'CREATE_FAILED',
      status: 500,
      fallback: 'Create failed',
    });
  }
}));

// ---------------------------------------------------------------------------
// POST /sessions/:id/ask — ask a question. Persists user + assistant message
// via a deterministic top-K fallback when the real LLM is not wired.
// ---------------------------------------------------------------------------
app.post(
  '/sessions/:id/ask',
  zValidator('json', AskSchema),
  withSecurityEvents({ action: 'doc-chat.create', resource: 'doc-chat', severity: 'info' }, async (c: any) => {
    const services = c.get('services');
    const db = services?.db;
    if (!db) return notConfigured(c);
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const sessionId = c.req.param('id');
    const body = c.req.valid('json');

    // Load session, enforce tenant isolation.
    const [session] = await db
      .select()
      .from(docChatSessions)
      .where(
        and(
          eq(docChatSessions.id, sessionId),
          eq(docChatSessions.tenantId, tenantId)
        )
      )
      .limit(1);
    if (!session) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
        404
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Persist the user message FIRST (always, even if retrieval fails).
    const userMessage = {
      id: newId('dcm'),
      tenantId,
      sessionId: session.id,
      role: 'user' as const,
      authorUserId: userId,
      content: body.question,
      citations: [],
      retrievedChunkIds: [],
      createdAt: now,
    };
    await db.insert(docChatMessages).values(userMessage);

    // 2) Retrieve top-K chunks (fallback; safe when embedding svc is absent).
    const documentIds = Array.isArray(session.documentIds)
      ? session.documentIds
      : [];
    let retrieved: Array<RetrievedChunk> = [];
    try {
      retrieved = await fallbackRetrieve(db, tenantId, documentIds, body.question, 5);
    } catch (_e) {
      retrieved = [];
    }

    // 2b) Citations are derived from the ACTUAL retrieved chunks for THIS
    // turn — the answer may only ever cite what we retrieved here.
    const citations = retrieved.slice(0, 3).map((r) => ({
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      quote: r.text.slice(0, 240),
      score: r.score,
      page: r.page,
    }));

    // 2c) Load the last few prior turns for conversational context (cheap:
    // one indexed select, scoped to this session + tenant). We exclude the
    // user message we just inserted so it is not duplicated in the prompt.
    let priorHistory: Array<{ role: string; content: string }> = [];
    try {
      const historyRows = await db
        .select({
          role: docChatMessages.role,
          content: docChatMessages.content,
          createdAt: docChatMessages.createdAt,
        })
        .from(docChatMessages)
        .where(
          and(
            eq(docChatMessages.sessionId, session.id),
            eq(docChatMessages.tenantId, tenantId)
          )
        )
        .orderBy(desc(docChatMessages.createdAt))
        .limit(HISTORY_TURN_LIMIT + 1);
      priorHistory = (historyRows as Array<{ role: string; content: string }>)
        .filter((row) => row.content !== body.question)
        .slice(0, HISTORY_TURN_LIMIT)
        .reverse();
    } catch (_e) {
      priorHistory = [];
    }

    // 3) Generate a real, retrieval-grounded answer via the api-gateway's
    // own brain LLM facade. The facade returns null when ANTHROPIC_API_KEY
    // is absent, so `withLlmOrHeuristic` degrades to the deterministic echo.
    const llmClient = createBrainLlmClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: BRAIN_LLM_MODELS.SONNET,
      logger,
    });

    const top = retrieved[0];
    const deterministicContent = top
      ? `Based on the indexed documents, the most relevant passage reads: "${top.text.slice(0, 240)}". (See citations for more.)`
      : `I could not find any relevant context for: "${body.question}".`;

    type GeneratedAnswer = {
      readonly content: string;
      readonly model: string;
      readonly tokensUsed: { readonly input: number; readonly output: number };
      readonly grounded: boolean;
    };

    const deterministicAnswer = (): GeneratedAnswer => ({
      content: deterministicContent,
      model: 'deterministic-fallback-v0',
      tokensUsed: {
        input: body.question.length,
        output: deterministicContent.length,
      },
      grounded: Boolean(top),
    });

    const generated: GeneratedAnswer = await withLlmOrHeuristic<GeneratedAnswer>({
      pathName: 'doc-chat-ask',
      logger,
      heuristic: async () => deterministicAnswer(),
      // The answer is grounded when we either produced text from retrieved
      // chunks, or correctly refused because nothing was retrieved. An empty
      // answer with chunks present means the model added no value -> heuristic.
      hasEvidence: (out) =>
        out.content.trim().length > 0 &&
        (retrieved.length > 0 || out.grounded === false),
      llmAttempt: async () => {
        if (!llmClient) {
          // No key -> let the wrapper fall through to the heuristic.
          throw new Error('brain LLM client unavailable');
        }
        const response = await llmClient.sdk.messages.create({
          model: llmClient.model,
          max_tokens: ANSWER_MAX_TOKENS,
          temperature: ANSWER_TEMPERATURE,
          system: ANSWER_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: buildAnswerUserPrompt(
                body.question,
                retrieved,
                priorHistory
              ),
            },
          ],
        });
        const text = Array.isArray(response.content)
          ? response.content
              .filter((b) => b.type === 'text' && typeof b.text === 'string')
              .map((b) => b.text as string)
              .join('')
              .trim()
          : '';
        if (!text) {
          throw new Error('brain LLM returned empty answer');
        }
        return {
          content: text,
          model: llmClient.model,
          tokensUsed: {
            input: response.usage?.input_tokens ?? body.question.length,
            output: response.usage?.output_tokens ?? text.length,
          },
          grounded: retrieved.length > 0,
        };
      },
    });

    const assistantMessage = {
      id: newId('dcm'),
      tenantId,
      sessionId: session.id,
      role: 'assistant' as const,
      authorUserId: null,
      content: generated.content,
      citations,
      retrievedChunkIds: retrieved.map((_r, idx) => `local-${idx}`),
      model: generated.model,
      tokensUsed: generated.tokensUsed,
      createdAt: new Date(),
    };
    await db.insert(docChatMessages).values(assistantMessage);

    // Whether we served the deterministic fallback (no key / LLM error /
    // empty-or-ungrounded LLM output). Derived from the stamped model so it
    // stays the single source of truth for the event + response payloads.
    const usedFallback = generated.model === 'deterministic-fallback-v0';

    // 4) Touch the session.
    await db
      .update(docChatSessions)
      .set({ lastMessageAt: new Date() })
      .where(
        and(
          eq(docChatSessions.id, session.id),
          eq(docChatSessions.tenantId, tenantId)
        )
      );

    // 5) Emit domain event.
    try {
      await services.eventBus?.publish({
        event: {
          eventId: newId('evt'),
          eventType: 'DocChatQuestionAnswered',
          timestamp: nowIso,
          tenantId,
          correlationId: newId('cor'),
          causationId: null,
          metadata: { fallback: usedFallback },
          payload: {
            sessionId: session.id,
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
            citationCount: citations.length,
          },
        } as any,
        version: 1,
        aggregateId: session.id,
        aggregateType: 'DocChatSession',
      });
    } catch (_e) {
      // non-fatal
    }

    return c.json(
      {
        success: true,
        data: {
          userMessage,
          assistantMessage,
          fallback: usedFallback,
        },
      },
      200
    );
  })
);

// ---------------------------------------------------------------------------
// POST /sessions/:id/messages — group-chat peer message (no LLM call).
// ---------------------------------------------------------------------------
app.post(
  '/sessions/:id/messages',
  zValidator('json', PostMessageSchema),
  withSecurityEvents({ action: 'doc-chat.create', resource: 'doc-chat', severity: 'info' }, async (c: any) => {
    const services = c.get('services');
    const db = services?.db;
    if (!db) return notConfigured(c);
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const sessionId = c.req.param('id');
    const body = c.req.valid('json');

    const [session] = await db
      .select()
      .from(docChatSessions)
      .where(
        and(
          eq(docChatSessions.id, sessionId),
          eq(docChatSessions.tenantId, tenantId)
        )
      )
      .limit(1);
    if (!session) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
        404
      );
    }

    const now = new Date();
    const message = {
      id: newId('dcm'),
      tenantId,
      sessionId: session.id,
      role: 'user' as const,
      authorUserId: userId,
      content: body.content,
      citations: [],
      retrievedChunkIds: [],
      createdAt: now,
    };
    await db.insert(docChatMessages).values(message);
    await db
      .update(docChatSessions)
      .set({ lastMessageAt: now })
      .where(
        and(
          eq(docChatSessions.id, session.id),
          eq(docChatSessions.tenantId, tenantId)
        )
      );

    try {
      await services.eventBus?.publish({
        event: {
          eventId: newId('evt'),
          eventType: 'DocChatMessagePosted',
          timestamp: now.toISOString(),
          tenantId,
          correlationId: newId('cor'),
          causationId: null,
          metadata: {},
          payload: { sessionId: session.id, messageId: message.id },
        } as any,
        version: 1,
        aggregateId: session.id,
        aggregateType: 'DocChatSession',
      });
    } catch (_e) {
      // non-fatal
    }

    return c.json({ success: true, data: message }, 201);
  })
);

export default app;
