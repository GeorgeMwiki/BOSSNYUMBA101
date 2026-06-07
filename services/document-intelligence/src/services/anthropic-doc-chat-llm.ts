/**
 * Anthropic-backed DocChat LLM adapter (KI-009).
 *
 * Replaces the deterministic-echo `StubAnthropicDocChatLlm` with a real
 * Anthropic Messages call that grounds every answer in the retrieved
 * chunks and emits `<citations>` tags — one per claim — which we parse
 * back into `DocChatCitation[]`.
 *
 * Design constraints (CLAUDE.md + KI-009 fix brief):
 *   - REUSE the shared Anthropic client surface from
 *     `packages/ai-copilot/src/providers/anthropic-client.ts`. We accept a
 *     structurally-typed SDK client at the composition seam rather than
 *     importing/instantiating `@anthropic-ai/sdk` here — this package does
 *     NOT take a new SDK dependency, and never reads `process.env`. The
 *     api-gateway composition root builds the client via
 *     `createAnthropicClient({ apiKey }).sdk` and injects it.
 *   - GATED on `ANTHROPIC_API_KEY` presence at the composition root. When
 *     the key is absent, `selectDocChatLlm` returns the EXISTING
 *     `StubAnthropicDocChatLlm` so key-less dev/CI keeps working.
 *   - POST-LLM safety re-check: a parsed citation only survives if it maps
 *     to a chunk that was actually retrieved for this turn. Hallucinated or
 *     out-of-range chunk references are dropped. The visible answer has the
 *     `<citations>` tags stripped so users never see raw markup.
 *   - Pino / injected logger only — no `console.log`.
 *   - Immutability + zod at the boundary; functions < 50 lines.
 */

import { z } from 'zod';

import type {
  DocChatCitation,
  IDocChatLlmPort,
  RetrievedChunk,
} from './document-chat.service.js';
import { StubAnthropicDocChatLlm } from './document-chat.service.js';

// ---------------------------------------------------------------------------
// Injected client surface — structurally identical to `AnthropicSdkLike` in
// `ai-copilot/src/providers/anthropic-client.ts`. Declared locally so this
// package neither depends on the SDK nor on ai-copilot at build time; the
// composition root passes `createAnthropicClient(...).sdk` which satisfies
// this shape (the same decoupling used by api-gateway's brain `llm-call.ts`).
// ---------------------------------------------------------------------------

export interface DocChatLlmMessageRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly temperature?: number;
  readonly system?: string;
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
}

export interface DocChatLlmMessageResponse {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
  readonly stop_reason?: string;
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
}

export interface DocChatLlmSdkLike {
  readonly messages: {
    create(request: DocChatLlmMessageRequest): Promise<DocChatLlmMessageResponse>;
  };
}

/** Minimal logger surface — satisfied by Pino, Winston, or an injected stub. */
export interface DocChatLlmLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

// ---------------------------------------------------------------------------
// Config + prompt
// ---------------------------------------------------------------------------

/**
 * In-package fallback model IDs (undated aliases that track the latest minor).
 *
 * These are only the LAST-RESORT default for `config.model`. This package is
 * deliberately decoupled from the brain-llm-router and never reads
 * `process.env` (see file header), so it cannot call the dynamic registry
 * itself. The PRODUCTION composition root MUST inject the resolved id —
 * `config.model = getModelLatest('sonnet')` from
 * `@bossnyumba/brain-llm-router/dynamic-registry` — so the live path always
 * dispatches the latest model. The aliases below mirror the registry
 * baselines (undated, so the provider serves the newest build).
 */
export const DOC_CHAT_MODELS = {
  HAIKU: 'claude-haiku-4-5',
  SONNET: 'claude-sonnet-4-6',
  OPUS: 'claude-opus-4-6',
} as const;

export type DocChatModelId = (typeof DOC_CHAT_MODELS)[keyof typeof DOC_CHAT_MODELS];

export interface AnthropicDocChatLlmConfig {
  /** Injected Anthropic SDK surface (`createAnthropicClient(...).sdk`). */
  readonly sdk: DocChatLlmSdkLike;
  /** Model id. Defaults to Sonnet — strong grounding at sane cost. */
  readonly model?: DocChatModelId | string;
  /** Sampling temperature. Default 0.2 (favor grounded, deterministic prose). */
  readonly temperature?: number;
  /** Max completion tokens. Default 1024. */
  readonly maxTokens?: number;
  /** Optional injected logger for drop/empty-context diagnostics. */
  readonly logger?: DocChatLlmLogger;
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;
const MAX_QUOTE_LEN = 240;

const SYSTEM_PROMPT = [
  'You are a retrieval-grounded document assistant. You answer ONLY from the',
  'numbered CONTEXT chunks supplied by the user. Never use outside knowledge.',
  '',
  'Hard rules (do not break):',
  '- Ground EVERY factual claim in the provided context.',
  '- After EACH claim, emit a citation tag of the exact form:',
  '    <citation chunk="N" quote="...verbatim snippet..." />',
  '  where N is the 0-based index of the CONTEXT chunk you used and the quote',
  '  is a short verbatim snippet (<= 240 chars) copied from that chunk.',
  '- If the context does not contain the answer, say so plainly and emit no',
  '  citation tags.',
  '- Do not invent chunk indices. Only cite indices that appear in CONTEXT.',
  '- Plain prose only. No markdown headings, no emojis.',
].join('\n');

// ---------------------------------------------------------------------------
// Citation tag parsing (pure, independently testable)
// ---------------------------------------------------------------------------

/** A citation reference parsed out of the raw model output, pre-validation. */
export interface ParsedCitationRef {
  readonly chunk: number;
  readonly quote: string;
}

const CITATION_TAG = /<citation\b[^>]*?\/?>/gi;
const CHUNK_ATTR = /\bchunk\s*=\s*"(\d+)"/i;
const QUOTE_ATTR = /\bquote\s*=\s*"([\s\S]*?)"/i;

/**
 * Extract `<citation chunk="N" quote="..." />` references from raw model
 * text. Tolerant of attribute order and self-closing vs. open tags. Pure.
 */
export function parseCitationTags(raw: string): readonly ParsedCitationRef[] {
  if (!raw) return [];
  const refs: ParsedCitationRef[] = [];
  const matches = raw.match(CITATION_TAG) ?? [];
  for (const tag of matches) {
    const chunkMatch = tag.match(CHUNK_ATTR);
    if (!chunkMatch) continue;
    const chunk = Number.parseInt(chunkMatch[1] as string, 10);
    if (!Number.isInteger(chunk) || chunk < 0) continue;
    const quoteMatch = tag.match(QUOTE_ATTR);
    const quote = (quoteMatch?.[1] ?? '').trim();
    refs.push({ chunk, quote });
  }
  return refs;
}

/** Remove citation tags from the answer so users never see raw markup. */
export function stripCitationTags(raw: string): string {
  return raw.replace(CITATION_TAG, '').replace(/[ \t]{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Post-LLM safety re-check: map parsed refs onto retrieved chunks
// ---------------------------------------------------------------------------

const PARSED_REF_SCHEMA = z.object({
  chunk: z.number().int().min(0),
  quote: z.string(),
});

/**
 * Validate parsed citation refs against the chunks ACTUALLY retrieved this
 * turn. A ref survives only if its `chunk` index addresses a real retrieved
 * chunk — hallucinated / out-of-range indices are dropped. The surviving
 * citation's quote is clamped; we fall back to the chunk text when the model
 * omitted a usable quote. Deduplicates by (documentId, chunkIndex).
 */
export function mapRefsToCitations(
  refs: readonly ParsedCitationRef[],
  context: readonly RetrievedChunk[],
  logger?: DocChatLlmLogger
): readonly DocChatCitation[] {
  const seen = new Set<string>();
  const out: DocChatCitation[] = [];
  for (const candidate of refs) {
    const parsed = PARSED_REF_SCHEMA.safeParse(candidate);
    if (!parsed.success) continue;
    const chunk = context[parsed.data.chunk];
    if (!chunk) {
      logger?.warn(
        { module: 'anthropic-doc-chat-llm', chunkIndex: parsed.data.chunk },
        'dropping citation referencing a non-retrieved chunk'
      );
      continue;
    }
    const key = `${chunk.documentId}#${chunk.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const quote = (parsed.data.quote || chunk.text).slice(0, MAX_QUOTE_LEN);
    out.push({
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      quote,
      score: chunk.score,
      ...(chunk.page !== undefined ? { page: chunk.page } : {}),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildContextBlock(context: readonly RetrievedChunk[]): string {
  if (context.length === 0) return 'CONTEXT: (no chunks retrieved)';
  const lines = context.map(
    (chunk, index) =>
      `[${index}] (doc=${chunk.documentId}, chunk=${chunk.chunkIndex}` +
      `${chunk.page !== undefined ? `, page=${chunk.page}` : ''})\n${chunk.text}`
  );
  return `CONTEXT (cite by the [N] index):\n${lines.join('\n\n')}`;
}

function buildUserPrompt(
  question: string,
  context: readonly RetrievedChunk[]
): string {
  return `${buildContextBlock(context)}\n\nQUESTION:\n${question}`;
}

function extractText(response: DocChatLlmMessageResponse): string {
  if (!Array.isArray(response.content)) return '';
  return response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Real Anthropic-backed implementation of `IDocChatLlmPort`. Emits
 * `<citation>` tags per claim and parses them back into `DocChatCitation[]`,
 * keeping only citations that map to a genuinely retrieved chunk.
 */
export class AnthropicDocChatLlm implements IDocChatLlmPort {
  readonly model: string;
  private readonly sdk: DocChatLlmSdkLike;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly logger: DocChatLlmLogger | undefined;

  constructor(config: AnthropicDocChatLlmConfig) {
    if (!config.sdk || typeof config.sdk.messages?.create !== 'function') {
      throw new Error('AnthropicDocChatLlm: a valid Anthropic sdk client is required.');
    }
    this.sdk = config.sdk;
    this.model = config.model ?? DOC_CHAT_MODELS.SONNET;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.logger = config.logger;
  }

  async answer(input: {
    question: string;
    context: readonly RetrievedChunk[];
    history: readonly { role: 'user' | 'assistant'; content: string }[];
  }): Promise<{
    content: string;
    citations: readonly DocChatCitation[];
    tokensUsed?: { input: number; output: number };
  }> {
    const messages = [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: buildUserPrompt(input.question, input.context) },
    ];

    const response = await this.sdk.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: SYSTEM_PROMPT,
      messages,
    });

    const raw = extractText(response);
    const refs = parseCitationTags(raw);
    const citations = mapRefsToCitations(refs, input.context, this.logger);
    const content = stripCitationTags(raw);

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    return {
      content,
      citations,
      tokensUsed: { input: inputTokens, output: outputTokens },
    };
  }
}

// ---------------------------------------------------------------------------
// Composition-seam selector (the GATE)
// ---------------------------------------------------------------------------

export interface SelectDocChatLlmOptions {
  /**
   * Anthropic SDK surface resolved at the composition root when
   * `ANTHROPIC_API_KEY` is present (e.g. `createAnthropicClient({ apiKey }).sdk`).
   * Pass `null`/`undefined` to force the deterministic stub fallback.
   */
  readonly sdk?: DocChatLlmSdkLike | null;
  readonly model?: DocChatModelId | string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly logger?: DocChatLlmLogger;
}

/**
 * Choose the DocChat LLM port at the composition seam. Returns the real
 * Anthropic adapter when an SDK client is supplied (key present at the root),
 * otherwise the existing `StubAnthropicDocChatLlm`. This function performs NO
 * `process.env` access — gating happens where the SDK client is resolved.
 */
export function selectDocChatLlm(
  options: SelectDocChatLlmOptions = {}
): IDocChatLlmPort {
  if (!options.sdk) {
    return new StubAnthropicDocChatLlm();
  }
  return new AnthropicDocChatLlm({
    sdk: options.sdk,
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
  });
}
