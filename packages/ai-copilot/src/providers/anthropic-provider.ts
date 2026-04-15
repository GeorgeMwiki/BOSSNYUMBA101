/**
 * Anthropic Provider
 *
 * Concrete AIProvider implementation that talks to the Claude API via the
 * official @anthropic-ai/sdk. Supports:
 *   - Prompt caching via `cache_control: { type: 'ephemeral' }` on the
 *     system block, so long static instruction text only gets billed/
 *     processed once per cache TTL.
 *   - Tool use (structured JSON output) via a single forced tool when
 *     `jsonMode` is requested.
 *   - Injectable client for tests.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIResult,
  aiOk,
  aiErr,
  asModelId,
} from '../types/core.types.js';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  ModelInfo,
} from './ai-provider.js';
import {
  ANTHROPIC_MODEL_DEFAULTS,
  DEFAULT_ANTHROPIC_MODEL,
  getDefaultMaxTokens,
} from './model-defaults.js';

/**
 * Minimal structural interface for the parts of the Anthropic client we use.
 * Tests can satisfy this without pulling the real SDK.
 */
export interface AnthropicClientLike {
  messages: {
    create: (params: Record<string, unknown>) => Promise<AnthropicMessageResponse>;
  };
}

export interface AnthropicMessageResponse {
  id: string;
  model: string;
  stop_reason?: string | null;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; name: string; input: unknown; id?: string }
    | { type: string; [k: string]: unknown }
  >;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * Anthropic provider configuration.
 */
export interface AnthropicProviderConfig {
  /** Anthropic API key. Required unless `client` is provided. */
  apiKey?: string;
  /** Override base URL (e.g. for proxies). */
  baseURL?: string;
  /** Default model id. Falls back to DEFAULT_ANTHROPIC_MODEL. */
  defaultModel?: string;
  /** Default timeout in ms. */
  defaultTimeoutMs?: number;
  /**
   * When true (the default), long static system prompts are sent with
   * `cache_control: { type: 'ephemeral' }` so the Anthropic API caches
   * the prefix and re-uses it across requests. Disable for debugging.
   */
  enablePromptCaching?: boolean;
  /**
   * Minimum character length of a system prompt before we attach a
   * cache_control hint. Caching has overhead, so very short prompts
   * aren't worth caching.
   */
  cacheMinChars?: number;
  /** Inject a pre-built client (for tests / custom transports). */
  client?: AnthropicClientLike;
}

/**
 * Anthropic Provider — implements AIProvider.
 */
export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly supportedModels = [
    ANTHROPIC_MODEL_DEFAULTS.PREDICTIONS,
    ANTHROPIC_MODEL_DEFAULTS.MATCHING,
    ANTHROPIC_MODEL_DEFAULTS.LEGAL_REVIEW,
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-opus-4-latest',
  ];

  private readonly client: AnthropicClientLike;
  private readonly config: AnthropicProviderConfig;
  private readonly modelInfoMap: Map<string, ModelInfo>;

  constructor(config: AnthropicProviderConfig = {}) {
    this.config = {
      enablePromptCaching: true,
      cacheMinChars: 1024,
      defaultTimeoutMs: 60000,
      ...config,
    };

    if (config.client) {
      this.client = config.client;
    } else {
      if (!config.apiKey) {
        throw new Error('AnthropicProvider requires an apiKey or an injected client');
      }
      this.client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      }) as unknown as AnthropicClientLike;
    }

    this.modelInfoMap = new Map<string, ModelInfo>([
      ['claude-3-7-sonnet-latest', {
        id: 'claude-3-7-sonnet-latest',
        displayName: 'Claude 3.7 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsJson: true,
        supportsVision: true,
        costPer1kPromptTokens: 0.003,
        costPer1kCompletionTokens: 0.015,
        tier: 'advanced',
      }],
      ['claude-3-5-sonnet-latest', {
        id: 'claude-3-5-sonnet-latest',
        displayName: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsJson: true,
        supportsVision: true,
        costPer1kPromptTokens: 0.003,
        costPer1kCompletionTokens: 0.015,
        tier: 'advanced',
      }],
      ['claude-3-5-haiku-latest', {
        id: 'claude-3-5-haiku-latest',
        displayName: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsJson: true,
        supportsVision: false,
        costPer1kPromptTokens: 0.0008,
        costPer1kCompletionTokens: 0.004,
        tier: 'standard',
      }],
      ['claude-opus-4-latest', {
        id: 'claude-opus-4-latest',
        displayName: 'Claude Opus 4',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsJson: true,
        supportsVision: true,
        costPer1kPromptTokens: 0.015,
        costPer1kCompletionTokens: 0.075,
        tier: 'advanced',
      }],
    ]);
  }

  async complete(
    request: AICompletionRequest
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const modelId =
      request.modelOverride ??
      request.prompt.modelConfig.modelId ??
      this.config.defaultModel ??
      DEFAULT_ANTHROPIC_MODEL;

    const maxTokens =
      request.prompt.modelConfig.maxTokens ??
      getDefaultMaxTokens();

    const temperature =
      request.temperatureOverride ??
      request.prompt.modelConfig.temperature ??
      0.3;

    // Build system block with optional cache_control hint
    const systemText = request.prompt.systemPrompt ?? '';
    const shouldCacheSystem =
      this.config.enablePromptCaching !== false &&
      systemText.length >= (this.config.cacheMinChars ?? 1024);

    const systemBlocks = systemText
      ? shouldCacheSystem
        ? [
            {
              type: 'text',
              text: systemText,
              cache_control: { type: 'ephemeral' },
            },
          ]
        : [{ type: 'text', text: systemText }]
      : undefined;

    // Build user content
    let userContent = request.prompt.userPrompt;
    if (request.additionalContext) {
      userContent += `\n\n${request.additionalContext}`;
    }

    const params: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userContent }],
        },
      ],
    };

    if (systemBlocks) {
      params.system = systemBlocks;
    }

    if (request.prompt.modelConfig.topP !== undefined) {
      params.top_p = request.prompt.modelConfig.topP;
    }

    // JSON mode via a single forced tool
    if (request.jsonMode) {
      const toolName = 'emit_structured_output';
      params.tools = [
        {
          name: toolName,
          description:
            'Emit the required structured output for this task. You MUST call this tool exactly once.',
          input_schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      ];
      params.tool_choice = { type: 'tool', name: toolName };
    }

    try {
      const timeoutMs = request.timeoutMs ?? this.config.defaultTimeoutMs ?? 60000;
      const response = await this.withTimeout(
        this.client.messages.create(params),
        timeoutMs
      );

      const processingTimeMs = Date.now() - startTime;

      // Extract text + tool_use
      let textContent = '';
      let toolInput: unknown = undefined;
      for (const block of response.content ?? []) {
        if (block.type === 'text' && typeof (block as { text?: unknown }).text === 'string') {
          textContent += (block as { text: string }).text;
        } else if (block.type === 'tool_use') {
          toolInput = (block as { input: unknown }).input;
        }
      }

      const parsedJson = request.jsonMode
        ? toolInput ?? this.tryParseJson(textContent)
        : undefined;

      const finishReason = this.mapStopReason(response.stop_reason);

      return aiOk({
        content: textContent || (parsedJson ? JSON.stringify(parsedJson) : ''),
        parsedJson,
        modelId: asModelId(response.model ?? modelId),
        usage: {
          promptTokens: response.usage?.input_tokens ?? 0,
          completionTokens: response.usage?.output_tokens ?? 0,
          totalTokens:
            (response.usage?.input_tokens ?? 0) +
            (response.usage?.output_tokens ?? 0),
        },
        processingTimeMs,
        finishReason,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId) || modelId.startsWith('claude-');
  }

  getModelInfo(modelId: string): ModelInfo | null {
    return this.modelInfoMap.get(modelId) ?? null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.client.messages.create({
        model: this.config.defaultModel ?? DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return Array.isArray(res.content);
    } catch {
      return false;
    }
  }

  // ---- internals ----

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private mapStopReason(reason: string | null | undefined):
    'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'end_turn':
      case 'tool_use':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AnthropicTimeoutError(ms)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private handleError(
    error: unknown
  ): AIResult<AICompletionResponse, AIProviderError> {
    if (error instanceof AnthropicTimeoutError) {
      return aiErr({
        code: 'TIMEOUT',
        message: error.message,
        provider: this.providerId,
        retryable: true,
      });
    }

    const anyErr = error as {
      status?: number;
      message?: string;
      error?: { type?: string; message?: string };
    };
    const status = anyErr.status;
    const msg =
      anyErr.error?.message ?? anyErr.message ?? 'Anthropic API error';

    if (status === 429) {
      return aiErr({
        code: 'RATE_LIMIT',
        message: msg,
        provider: this.providerId,
        statusCode: status,
        retryable: true,
      });
    }
    if (status === 400 && /context|length|too long/i.test(msg)) {
      return aiErr({
        code: 'CONTEXT_LENGTH',
        message: msg,
        provider: this.providerId,
        statusCode: status,
        retryable: false,
      });
    }
    return aiErr({
      code: 'PROVIDER_ERROR',
      message: msg,
      provider: this.providerId,
      statusCode: status,
      retryable: status === undefined || status >= 500,
    });
  }
}

class AnthropicTimeoutError extends Error {
  constructor(ms: number) {
    super(`Anthropic request timed out after ${ms}ms`);
    this.name = 'AnthropicTimeoutError';
  }
}

/**
 * Factory helper.
 */
export function createAnthropicProvider(
  config: AnthropicProviderConfig
): AnthropicProvider {
  return new AnthropicProvider(config);
}
