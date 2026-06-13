/**
 * Anthropic Provider — production implementation.
 *
 * Provides access to Claude Opus, Sonnet, and Haiku models — the reasoning
 * substrate for the BossNyumba Brain.
 *
 * Production capabilities:
 *  - Tool-use (Anthropic Messages API `tools` + `tool_use` content blocks)
 *  - Multi-turn (caller passes `priorMessages` so we can iterate the
 *    tool-call loop with `tool_result` blocks)
 *  - Retry with exponential backoff on 429 / 5xx
 *  - Honest error surfacing (no silent fallbacks)
 *
 * Pairs with `advisor.ts` to implement the Anthropic Advisor Pattern (2026).
 */

import { AIResult, aiOk, aiErr, asModelId } from '../types/core.types.js';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  ModelInfo,
  AIContentBlock,
  AIMessage,
  StreamTokenSink,
} from './ai-provider.js';
import { applyPrefixCache } from './anthropic-prefix-cache.js';

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
  /** Anthropic API version (anthropic-version header) */
  apiVersion?: string;
  /** Max retry attempts on 429 / 5xx. Default 4. */
  maxRetries?: number;
  /** Base backoff (ms). Each retry: base * 2^attempt + jitter. Default 500. */
  retryBaseMs?: number;
}

/**
 * Anthropic model identifiers (2026 Messages API).
 */
// Undated aliases that track the latest minor build per family (matches the
// brain-llm-router registry baselines). De-dated `HAIKU_4_5` so this constant —
// used both as a dispatch default AND as a pricing-book key in `router.ts` —
// matches the id the kernel resolves via `getModelLatest('haiku')`; a dated
// alias would miss the cost lookup and mis-bill. Dynamic call sites should
// prefer `getModelLatest(...)`; these remain for typed defaults + price keys.
export const ANTHROPIC_MODELS = {
  FABLE_5: 'claude-fable-5',
  OPUS_4_8: 'claude-opus-4-8',
  OPUS_4_7: 'claude-opus-4-7',
  OPUS_4_6: 'claude-opus-4-6',
  SONNET_4_6: 'claude-sonnet-4-6',
  HAIKU_4_5: 'claude-haiku-4-5',
} as const;

export type AnthropicModelId =
  (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];

const DEFAULT_API_VERSION = '2023-06-01';

export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly supportedModels: string[] = [
    ANTHROPIC_MODELS.FABLE_5,
    ANTHROPIC_MODELS.OPUS_4_8,
    ANTHROPIC_MODELS.OPUS_4_7,
    ANTHROPIC_MODELS.OPUS_4_6,
    ANTHROPIC_MODELS.SONNET_4_6,
    ANTHROPIC_MODELS.HAIKU_4_5,
  ];

  private config: Required<
    Pick<AnthropicProviderConfig, 'apiKey'>
  > &
    Omit<AnthropicProviderConfig, 'apiKey'>;
  private modelInfoMap: Map<string, ModelInfo>;

  constructor(config: AnthropicProviderConfig) {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new Error(
        'AnthropicProvider: apiKey is required (set ANTHROPIC_API_KEY).'
      );
    }
    this.config = config;
    this.modelInfoMap = new Map([
      [
        ANTHROPIC_MODELS.FABLE_5,
        {
          id: ANTHROPIC_MODELS.FABLE_5,
          displayName: 'Claude Fable 5',
          contextWindow: 1_000_000,
          maxOutputTokens: 128_000,
          supportsJson: true,
          supportsVision: true,
          // $10 / $50 per Mtok input/output → per-1k.
          costPer1kPromptTokens: 0.01,
          costPer1kCompletionTokens: 0.05,
          tier: 'advanced',
        },
      ],
      [
        ANTHROPIC_MODELS.OPUS_4_8,
        {
          id: ANTHROPIC_MODELS.OPUS_4_8,
          displayName: 'Claude Opus 4.8',
          contextWindow: 1_000_000,
          maxOutputTokens: 128_000,
          supportsJson: true,
          supportsVision: true,
          // $5 / $25 per Mtok input/output → per-1k.
          costPer1kPromptTokens: 0.005,
          costPer1kCompletionTokens: 0.025,
          tier: 'advanced',
        },
      ],
      [
        ANTHROPIC_MODELS.OPUS_4_7,
        {
          id: ANTHROPIC_MODELS.OPUS_4_7,
          displayName: 'Claude Opus 4.7',
          contextWindow: 1_000_000,
          maxOutputTokens: 128_000,
          supportsJson: true,
          supportsVision: true,
          // $5 / $25 per Mtok input/output → per-1k.
          costPer1kPromptTokens: 0.005,
          costPer1kCompletionTokens: 0.025,
          tier: 'advanced',
        },
      ],
      [
        ANTHROPIC_MODELS.OPUS_4_6,
        {
          id: ANTHROPIC_MODELS.OPUS_4_6,
          displayName: 'Claude Opus 4.6',
          contextWindow: 1_000_000,
          maxOutputTokens: 64_000,
          supportsJson: true,
          supportsVision: true,
          costPer1kPromptTokens: 0.015,
          costPer1kCompletionTokens: 0.075,
          tier: 'advanced',
        },
      ],
      [
        ANTHROPIC_MODELS.SONNET_4_6,
        {
          id: ANTHROPIC_MODELS.SONNET_4_6,
          displayName: 'Claude Sonnet 4.6',
          contextWindow: 1_000_000,
          maxOutputTokens: 64_000,
          supportsJson: true,
          supportsVision: true,
          costPer1kPromptTokens: 0.003,
          costPer1kCompletionTokens: 0.015,
          tier: 'standard',
        },
      ],
      [
        ANTHROPIC_MODELS.HAIKU_4_5,
        {
          id: ANTHROPIC_MODELS.HAIKU_4_5,
          displayName: 'Claude Haiku 4.5',
          contextWindow: 200_000,
          maxOutputTokens: 32_000,
          supportsJson: true,
          supportsVision: true,
          costPer1kPromptTokens: 0.0008,
          costPer1kCompletionTokens: 0.004,
          tier: 'basic',
        },
      ],
    ]);
  }

  /**
   * Resolve the dispatch model + per-request timeout (shared by streaming and
   * non-streaming paths).
   */
  private resolveModel(request: AICompletionRequest): {
    modelId: string;
    timeoutMs: number;
  } {
    return {
      modelId:
        request.modelOverride ??
        request.prompt.modelConfig.modelId ??
        this.config.defaultModel ??
        ANTHROPIC_MODELS.SONNET_4_6,
      timeoutMs: request.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000,
    };
  }

  /**
   * Build the Anthropic Messages API request body from an
   * `AICompletionRequest`. Single-sourced so `complete` and `completeStream`
   * send byte-identical requests (only the `stream` flag differs). Returns the
   * prefix-cached body — never mutates the input.
   */
  private buildRequestBody(
    request: AICompletionRequest,
    modelId: string,
  ): Record<string, unknown> {
    // Build messages — either use priorMessages (multi-turn / tool loop) or
    // construct a single-shot user message from the prompt.
    const messages: Array<{
      role: 'user' | 'assistant';
      content: string | AIContentBlock[];
    }> = request.priorMessages
      ? request.priorMessages.map((m) => ({ role: m.role, content: m.content }))
      : [
          {
            role: 'user',
            content: request.additionalContext
              ? `${request.prompt.userPrompt}\n\n${request.additionalContext}`
              : request.prompt.userPrompt,
          },
        ];

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: request.prompt.modelConfig.maxTokens ?? 4096,
      temperature:
        request.temperatureOverride ??
        request.prompt.modelConfig.temperature ??
        0.7,
      messages,
    };
    if (request.prompt.systemPrompt) body.system = request.prompt.systemPrompt;
    if (request.prompt.modelConfig.topP !== undefined)
      body.top_p = request.prompt.modelConfig.topP;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: sanitizeToolName(t.name),
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    // A2b-2 wire #10a — Anthropic prompt-cache breakpoints. Marks the
    // system prompt + tools array as `cache_control: ephemeral` so
    // repeat turns reuse the same prefix at ~80% cost reduction. The
    // policy honours the 1-2 breakpoint recommendation (max 4) and
    // never mutates the input — `applyPrefixCache` returns a fresh body.
    const prefixCacheResult = applyPrefixCache(
      body as Parameters<typeof applyPrefixCache>[0],
      {},
    );
    return prefixCacheResult.body as Record<string, unknown>;
  }

  /**
   * Map a settled Anthropic Messages response (whether assembled from a stream
   * or returned whole) into our `AICompletionResponse`. Shared so streaming and
   * non-streaming paths produce identical shapes.
   */
  private toCompletionResponse(
    data: {
      content?: Array<Record<string, unknown>>;
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    },
    request: AICompletionRequest,
    modelId: string,
    startTime: number,
  ): AICompletionResponse {
    const rawContent: AIContentBlock[] = Array.isArray(data.content)
      ? data.content.map((b) => normalizeContentBlock(b))
      : [];

    const content = rawContent
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const toolCalls = rawContent.filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use'
    );

    let parsedJson: unknown = undefined;
    if (request.jsonMode) parsedJson = safeJsonParse(content);

    const finishReason = mapStopReason(data.stop_reason);
    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    // A2b-2 wire #10a — surface prompt-cache telemetry. Anthropic returns
    // `cache_creation_input_tokens` (one-time write cost) and
    // `cache_read_input_tokens` (cache hits billed at ~10% rate) on every
    // response when at least one `cache_control` marker was sent. The fields
    // are absent for non-cached turns — only populate `cacheStats` when at
    // least one counter is present so callers can distinguish "no cache"
    // from "cache miss".
    const cacheCreation = data.usage?.cache_creation_input_tokens;
    const cacheRead = data.usage?.cache_read_input_tokens;
    const cacheStats =
      cacheCreation !== undefined || cacheRead !== undefined
        ? {
            cacheCreationInputTokens: cacheCreation ?? 0,
            cacheReadInputTokens: cacheRead ?? 0,
          }
        : undefined;

    return {
      content,
      parsedJson,
      modelId: asModelId(modelId),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        ...(cacheStats ? { cacheStats } : {}),
      },
      processingTimeMs: Date.now() - startTime,
      finishReason,
      toolCalls: toolCalls.length
        ? toolCalls.map((c) => ({
            id: c.id,
            name: restoreToolName(c.name),
            input: c.input,
          }))
        : undefined,
      rawContent,
    };
  }

  async complete(
    request: AICompletionRequest
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const { modelId, timeoutMs } = this.resolveModel(request);
    const cachedBody = this.buildRequestBody(request, modelId);
    const result = await this.requestWithRetry(cachedBody, timeoutMs);
    if (!result.success) {
      const e = (result as { success: false; error: AIProviderError }).error;
      return aiErr(e);
    }
    return aiOk(
      this.toCompletionResponse(result.data, request, modelId, startTime),
    );
  }

  /**
   * Genuine token streaming over the Anthropic Messages SSE API.
   *
   * Opens `/v1/messages` with `stream: true`, forwards every `text_delta`
   * fragment to `onToken` AS IT ARRIVES (no buffering, no replay), and
   * assembles the full content/tool_use blocks + usage from the SSE events so
   * the resolved `AICompletionResponse` is byte-identical to `complete()`.
   * This keeps the orchestrator's tool-loop, governance and review plumbing
   * unchanged while delivering real-time output to the user.
   *
   * Streaming responses are NOT retried mid-flight (a partial stream cannot be
   * safely replayed); transport-level failures surface as a structured error.
   */
  async completeStream(
    request: AICompletionRequest,
    onToken: StreamTokenSink,
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const { modelId, timeoutMs } = this.resolveModel(request);
    const body = { ...this.buildRequestBody(request, modelId), stream: true };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.apiVersion ?? DEFAULT_API_VERSION,
            accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!response.ok || !response.body) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as Record<string, unknown>;
        clearTimeout(timeoutId);
        return this.handleApiError(response.status, errorBody);
      }

      const assembled = await consumeMessageStream(response.body, onToken);
      clearTimeout(timeoutId);
      return aiOk(
        this.toCompletionResponse(assembled, request, modelId, startTime),
      );
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return aiErr({
          code: 'TIMEOUT',
          message: `Anthropic stream timed out after ${timeoutMs}ms`,
          provider: this.providerId,
          retryable: true,
        });
      }
      return aiErr({
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        provider: this.providerId,
        retryable: true,
      });
    }
  }

  /**
   * Single fetch with timeout. Caller wraps in retry loop.
   */
  private async requestOnce(
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<
    AIResult<
      {
        content?: Array<Record<string, unknown>>;
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      },
      AIProviderError
    >
  > {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.apiVersion ?? DEFAULT_API_VERSION,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as Record<string, unknown>;
        return this.handleApiError(response.status, errorBody);
      }
      const data = (await response.json()) as {
        content?: Array<Record<string, unknown>>;
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };
      return aiOk(data);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return aiErr({
          code: 'TIMEOUT',
          message: `Anthropic request timed out after ${timeoutMs}ms`,
          provider: this.providerId,
          retryable: true,
        });
      }
      return aiErr({
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        provider: this.providerId,
        retryable: true,
      });
    }
  }

  /**
   * Retry wrapper. Exponential backoff on retryable errors only.
   */
  private async requestWithRetry(
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<
    AIResult<
      {
        content?: Array<Record<string, unknown>>;
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      },
      AIProviderError
    >
  > {
    const maxRetries = this.config.maxRetries ?? 4;
    const baseMs = this.config.retryBaseMs ?? 500;
    let lastErr: AIProviderError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.requestOnce(body, timeoutMs);
      if (result.success) return result;
      const err = (result as { success: false; error: AIProviderError }).error;
      lastErr = err;
      if (!err.retryable || attempt === maxRetries) return aiErr(err);
      // Exponential backoff with jitter
      // eslint-disable-next-line no-restricted-syntax -- retry-jitter timing, not an ID/secret; unguessability is irrelevant here
      const wait = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
      await new Promise((r) => setTimeout(r, wait));
    }
    return aiErr(
      lastErr ?? {
        code: 'PROVIDER_ERROR',
        message: 'unknown anthropic failure',
        provider: this.providerId,
        retryable: false,
      }
    );
  }

  private handleApiError(
    statusCode: number,
    errorBody: Record<string, unknown>
  ): AIResult<never, AIProviderError> {
    const errorObj = (errorBody.error as Record<string, unknown>) ?? {};
    const errorMessage = String(errorObj.message ?? 'API error');

    if (statusCode === 429) {
      return aiErr({
        code: 'RATE_LIMIT',
        message: `Anthropic rate limited: ${errorMessage}`,
        provider: this.providerId,
        statusCode,
        retryable: true,
      });
    }
    if (statusCode === 400 && /context|token|length/i.test(errorMessage)) {
      return aiErr({
        code: 'CONTEXT_LENGTH',
        message: `Anthropic context length exceeded: ${errorMessage}`,
        provider: this.providerId,
        statusCode,
        retryable: false,
      });
    }
    return aiErr({
      code: 'PROVIDER_ERROR',
      message: errorMessage,
      provider: this.providerId,
      statusCode,
      retryable: statusCode >= 500,
    });
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId);
  }

  getModelInfo(modelId: string): ModelInfo | null {
    return this.modelInfoMap.get(modelId) ?? null;
  }

  /**
   * Honest health check — issues a tiny `messages` call. Returns false on
   * any non-2xx so callers can route around an outage. Costs ~5 tokens.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    const probe = await this.requestOnce(
      {
        model:
          this.config.defaultModel ?? ANTHROPIC_MODELS.HAIKU_4_5,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      },
      this.config.defaultTimeoutMs ?? 5_000
    );
    return probe.success;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Anthropic enforces `^[a-zA-Z0-9_-]{1,128}$` on every tool name. Our internal
// skill names use dotted segments (e.g. `skill.maintenance.triage`) so we
// sanitize on the way out and reverse the mapping when a `tool_use` block
// references the sanitized name. The mapping is deterministic (dot → `__`,
// colon → `___`) so it round-trips 1:1.
function sanitizeToolName(name: string): string {
  return name.replace(/\./g, '__').replace(/:/g, '___');
}
function restoreToolName(name: string): string {
  return name.replace(/___/g, ':').replace(/__/g, '.');
}

interface AssembledMessage {
  content: Array<Record<string, unknown>>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * Consume an Anthropic Messages SSE stream from a `ReadableStream`, forwarding
 * each `text_delta` to `onToken` as it arrives and assembling the final message
 * (text + tool_use blocks + usage) the same shape `requestOnce` returns.
 *
 * Anthropic stream event sequence (anthropic-version 2023-06-01):
 *   message_start            → usage.input_tokens, empty content
 *   content_block_start      → opens a text|tool_use block at `index`
 *   content_block_delta      → text_delta (text) | input_json_delta (tool args)
 *   content_block_stop       → closes the block at `index`
 *   message_delta            → stop_reason + usage.output_tokens
 *   message_stop             → terminal
 */
async function consumeMessageStream(
  body: ReadableStream<Uint8Array>,
  onToken: StreamTokenSink,
): Promise<AssembledMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Per-index block accumulators. text blocks accumulate `.text`; tool_use
  // blocks accumulate a partial JSON string we parse on content_block_stop.
  const blocks = new Map<
    number,
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; partialJson: string }
  >();
  const assembled: AssembledMessage = { content: [], usage: {} };

  const handleEvent = (raw: string): void => {
    // Each SSE record is one or more `field: value` lines. We only need `data:`.
    const dataLines = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice('data:'.length).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join('');
    if (!payload || payload === '[DONE]') return;

    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return; // ignore malformed keep-alive / partial frames
    }
    const type = String(evt.type ?? '');

    if (type === 'message_start') {
      const msg = evt.message as { usage?: AssembledMessage['usage'] } | undefined;
      if (msg?.usage) assembled.usage = { ...assembled.usage, ...msg.usage };
      return;
    }
    if (type === 'content_block_start') {
      const index = Number(evt.index ?? 0);
      const block = (evt.content_block as Record<string, unknown>) ?? {};
      if (block.type === 'tool_use') {
        blocks.set(index, {
          type: 'tool_use',
          id: String(block.id ?? ''),
          name: String(block.name ?? ''),
          partialJson: '',
        });
      } else {
        blocks.set(index, { type: 'text', text: '' });
      }
      return;
    }
    if (type === 'content_block_delta') {
      const index = Number(evt.index ?? 0);
      const delta = (evt.delta as Record<string, unknown>) ?? {};
      const cur = blocks.get(index);
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        const text = delta.text;
        if (cur && cur.type === 'text') cur.text += text;
        else blocks.set(index, { type: 'text', text });
        // GENUINE streaming — forward the fragment the instant it lands.
        if (text) onToken(text);
      } else if (
        delta.type === 'input_json_delta' &&
        typeof delta.partial_json === 'string' &&
        cur &&
        cur.type === 'tool_use'
      ) {
        cur.partialJson += delta.partial_json;
      }
      return;
    }
    if (type === 'message_delta') {
      const d = (evt.delta as { stop_reason?: string }) ?? {};
      if (d.stop_reason) assembled.stop_reason = d.stop_reason;
      const usage = evt.usage as { output_tokens?: number } | undefined;
      if (usage?.output_tokens !== undefined)
        assembled.usage = { ...assembled.usage, output_tokens: usage.output_tokens };
      return;
    }
    // content_block_stop / message_stop / ping — nothing to accumulate.
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise CRLF → LF so the blank-line record separator is uniform
      // whether the upstream emits `\n\n` or `\r\n\r\n`.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      // SSE records are separated by a blank line.
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const record = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleEvent(record);
        sep = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  // Materialise blocks in index order.
  assembled.content = [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, blk]) => {
      if (blk.type === 'text') return { type: 'text', text: blk.text };
      let input: Record<string, unknown> = {};
      if (blk.partialJson.trim()) {
        try {
          input = JSON.parse(blk.partialJson) as Record<string, unknown>;
        } catch {
          input = {};
        }
      }
      return { type: 'tool_use', id: blk.id, name: blk.name, input };
    });

  return assembled;
}

function normalizeContentBlock(b: Record<string, unknown>): AIContentBlock {
  const type = String(b.type ?? '');
  if (type === 'text') {
    return { type: 'text', text: String(b.text ?? '') };
  }
  if (type === 'tool_use') {
    return {
      type: 'tool_use',
      id: String(b.id ?? ''),
      name: String(b.name ?? ''),
      input: (b.input as Record<string, unknown>) ?? {},
    };
  }
  if (type === 'tool_result') {
    return {
      type: 'tool_result',
      tool_use_id: String(b.tool_use_id ?? ''),
      content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
      is_error: Boolean(b.is_error),
    };
  }
  return { type: 'text', text: '' };
}

function mapStopReason(
  raw: string | undefined
): 'stop' | 'length' | 'content_filter' | 'error' | 'tool_use' {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_use';
    default:
      return 'stop';
  }
}

function safeJsonParse(content: string): unknown {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : content;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return undefined;
  }
}

/**
 * Helper: build a `tool_result` user-message turn to feed back into the model
 * after dispatching tool calls. Used by the orchestrator's tool-call loop.
 */
export function buildToolResultMessage(
  results: Array<{ toolUseId: string; content: string; isError?: boolean }>
): AIMessage {
  return {
    role: 'user',
    content: results.map((r) => ({
      type: 'tool_result',
      tool_use_id: r.toolUseId,
      content: r.content,
      is_error: r.isError,
    })),
  };
}
