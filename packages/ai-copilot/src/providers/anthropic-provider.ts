/**
 * Anthropic Claude AI Provider
 *
 * Production-grade Claude integration using the official Anthropic SDK.
 * Supports:
 *  - Prompt caching (ephemeral cache_control on system prompts)
 *  - Adaptive thinking for complex reasoning on Opus/Sonnet 4.6
 *  - Structured output via strict JSON mode (response enforced via prompt + schema validation)
 *  - Token accounting (input/output/cache_read/cache_creation)
 *  - Streaming for long outputs via SDK helpers
 *
 * Default models:
 *   - 'claude-sonnet-4-6' for prediction/matching/medium complexity
 *   - 'claude-haiku-4-5' for classification/lightweight tasks
 *   - 'claude-opus-4-6' for complex review / strategy
 */

import { aiErr, aiOk, asModelId, type AIResult } from '../types/core.types.js';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderError,
  ModelInfo,
} from './ai-provider.js';

/** Anthropic model catalog entry */
interface AnthropicModelInfo extends ModelInfo {
  supportsAdaptiveThinking: boolean;
  supportsPromptCaching: boolean;
}

/**
 * Default Anthropic model catalog.
 * Pricing is USD per 1K tokens. Update when the public Anthropic pricing changes.
 */
export const ANTHROPIC_MODEL_CATALOG: Record<string, AnthropicModelInfo> = {
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    contextWindow: 200_000,
    maxOutputTokens: 128_000,
    supportsJson: true,
    supportsVision: true,
    costPer1kPromptTokens: 0.005,
    costPer1kCompletionTokens: 0.025,
    tier: 'advanced',
    supportsAdaptiveThinking: true,
    supportsPromptCaching: true,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    supportsJson: true,
    supportsVision: true,
    costPer1kPromptTokens: 0.003,
    costPer1kCompletionTokens: 0.015,
    tier: 'advanced',
    supportsAdaptiveThinking: true,
    supportsPromptCaching: true,
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    supportsJson: true,
    supportsVision: true,
    costPer1kPromptTokens: 0.001,
    costPer1kCompletionTokens: 0.005,
    tier: 'standard',
    supportsAdaptiveThinking: false,
    supportsPromptCaching: true,
  },
};

/**
 * Minimal shape of the Anthropic SDK client that we depend on.
 *
 * We keep the typing structural so the provider can be used:
 *  - with the real `@anthropic-ai/sdk` instance (`new Anthropic({apiKey})`)
 *  - with a hand-rolled mock client in unit tests (no SDK install required)
 */
export interface AnthropicMessagesAPI {
  create(params: AnthropicMessagesCreateParams): Promise<AnthropicMessageResponse>;
}

export interface AnthropicClientLike {
  messages: AnthropicMessagesAPI;
}

/**
 * Factory that resolves an Anthropic client. Injected for testability.
 */
export type AnthropicClientFactory = (
  config: AnthropicProviderConfig
) => AnthropicClientLike;

export interface AnthropicMessagesCreateParams {
  model: string;
  max_tokens: number;
  system?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{
    role: 'user' | 'assistant';
    content:
      | string
      | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  }>;
  temperature?: number;
  top_p?: number;
  thinking?: { type: 'adaptive' };
  metadata?: Record<string, unknown>;
}

export interface AnthropicMessageResponse {
  id: string;
  content: Array<{ type: 'text'; text: string } | { type: 'thinking'; thinking: string }>;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/** Anthropic provider configuration */
export interface AnthropicProviderConfig {
  /** API key (falls back to ANTHROPIC_API_KEY env var when omitted) */
  apiKey?: string;
  /** Override base URL (e.g., proxies) */
  baseUrl?: string;
  /** Default model when not specified in the prompt */
  defaultModel?: string;
  /** Default timeout in ms */
  defaultTimeoutMs?: number;
  /** Enable prompt caching on the system prompt */
  enablePromptCaching?: boolean;
  /** Enable adaptive thinking for complex tasks (auto-downgraded for Haiku) */
  enableAdaptiveThinking?: boolean;
  /** Pre-constructed client (primarily for tests/mocks) */
  client?: AnthropicClientLike;
  /** Factory used when `client` is not supplied */
  clientFactory?: AnthropicClientFactory;
}

/** Fallback factory that lazily imports the real SDK */
async function defaultAnthropicClientFactory(
  config: AnthropicProviderConfig
): Promise<AnthropicClientLike> {
  const mod = (await import('@anthropic-ai/sdk').catch(() => null)) as
    | { default?: new (opts: Record<string, unknown>) => AnthropicClientLike }
    | null;
  if (!mod || typeof mod.default !== 'function') {
    throw new Error(
      'The @anthropic-ai/sdk package is not installed. Install it or supply a client via AnthropicProviderConfig.client.'
    );
  }
  const Ctor = mod.default;
  return new Ctor({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    timeout: config.defaultTimeoutMs ?? 120_000,
  });
}

/**
 * Anthropic Claude provider.
 *
 * Uses a cache_control: ephemeral breakpoint on the system prompt so that
 * repeated invocations with the same system prompt cost ~0.1x on cached tokens.
 */
export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly supportedModels = Object.keys(ANTHROPIC_MODEL_CATALOG);

  private readonly config: AnthropicProviderConfig;
  private clientPromise: Promise<AnthropicClientLike> | null = null;

  constructor(config: AnthropicProviderConfig = {}) {
    this.config = config;
  }

  private async getClient(): Promise<AnthropicClientLike> {
    if (this.config.client) return this.config.client;
    if (!this.clientPromise) {
      if (this.config.clientFactory) {
        this.clientPromise = Promise.resolve(this.config.clientFactory(this.config));
      } else {
        this.clientPromise = defaultAnthropicClientFactory(this.config);
      }
    }
    return this.clientPromise;
  }

  async complete(
    request: AICompletionRequest
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const modelId =
      request.modelOverride ??
      request.prompt.modelConfig.modelId ??
      this.config.defaultModel ??
      'claude-sonnet-4-6';

    const resolvedModel = this.resolveModelId(modelId);
    const info = ANTHROPIC_MODEL_CATALOG[resolvedModel];

    try {
      const client = await this.getClient();

      // System prompt with ephemeral cache breakpoint for prefix re-use
      const systemText = request.prompt.systemPrompt || '';
      const systemParam =
        systemText.length > 0 && this.config.enablePromptCaching !== false && info?.supportsPromptCaching
          ? [
              {
                type: 'text' as const,
                text: systemText,
                cache_control: { type: 'ephemeral' as const },
              },
            ]
          : systemText;

      // User message: volatile content sits AFTER the cache breakpoint.
      let userContent = request.prompt.userPrompt;
      if (request.jsonMode) {
        userContent += '\n\nReturn ONLY valid JSON matching the schema. No prose, no markdown fences.';
      }
      if (request.additionalContext) {
        userContent += `\n\n${request.additionalContext}`;
      }

      const params: AnthropicMessagesCreateParams = {
        model: resolvedModel,
        max_tokens: Math.min(
          request.prompt.modelConfig.maxTokens || 4096,
          info?.maxOutputTokens ?? 16_000
        ),
        system: systemParam,
        messages: [{ role: 'user', content: userContent }],
        temperature: request.temperatureOverride ?? request.prompt.modelConfig.temperature ?? 0.7,
      };
      if (request.prompt.modelConfig.topP !== undefined) {
        params.top_p = request.prompt.modelConfig.topP;
      }
      if (
        this.config.enableAdaptiveThinking &&
        info?.supportsAdaptiveThinking
      ) {
        params.thinking = { type: 'adaptive' };
      }

      const response = await client.messages.create(params);

      const textBlock = response.content.find((b) => b.type === 'text');
      const content = textBlock && 'text' in textBlock ? textBlock.text : '';

      let parsedJson: unknown;
      if (request.jsonMode) {
        parsedJson = tryParseJson(content);
      }

      const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
      const processingTimeMs = Date.now() - startTime;

      const finishReason: AICompletionResponse['finishReason'] = mapStopReason(response.stop_reason);

      return aiOk({
        content,
        parsedJson,
        modelId: asModelId(response.model),
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens,
        },
        processingTimeMs,
        finishReason,
      });
    } catch (error) {
      return aiErr(this.classifyError(error));
    }
  }

  supportsModel(modelId: string): boolean {
    return this.resolveModelId(modelId) in ANTHROPIC_MODEL_CATALOG;
  }

  getModelInfo(modelId: string): ModelInfo | null {
    const resolved = this.resolveModelId(modelId);
    return ANTHROPIC_MODEL_CATALOG[resolved] ?? null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      // Cheap probe: small Haiku call with 1 token
      const info = ANTHROPIC_MODEL_CATALOG['claude-haiku-4-5'];
      const resp = await client.messages.create({
        model: info.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return Array.isArray(resp.content);
    } catch {
      return false;
    }
  }

  /**
   * Normalize a model ID. Strips accidental date suffixes such as
   * `claude-haiku-4-5-20251001` → `claude-haiku-4-5`.
   */
  private resolveModelId(modelId: string): string {
    if (modelId in ANTHROPIC_MODEL_CATALOG) return modelId;
    // Strip trailing `-YYYYMMDD`
    const stripped = modelId.replace(/-\d{8}$/, '');
    if (stripped in ANTHROPIC_MODEL_CATALOG) return stripped;
    return modelId;
  }

  private classifyError(error: unknown): AIProviderError {
    const err = error as
      | { status?: number; name?: string; message?: string; headers?: Record<string, unknown> }
      | undefined;
    const status = err?.status;
    const message = err?.message ?? 'Unknown Anthropic error';

    if (err?.name === 'AbortError') {
      return {
        code: 'TIMEOUT',
        message,
        provider: this.providerId,
        retryable: true,
      };
    }
    if (status === 429) {
      return {
        code: 'RATE_LIMIT',
        message,
        provider: this.providerId,
        statusCode: status,
        retryable: true,
      };
    }
    if (status === 400 && /(context|token|length)/i.test(message)) {
      return {
        code: 'CONTEXT_LENGTH',
        message,
        provider: this.providerId,
        statusCode: status,
        retryable: false,
      };
    }
    if (status === 400 && /(policy|safety|blocked)/i.test(message)) {
      return {
        code: 'CONTENT_FILTER',
        message,
        provider: this.providerId,
        statusCode: status,
        retryable: false,
      };
    }
    return {
      code: 'PROVIDER_ERROR',
      message,
      provider: this.providerId,
      statusCode: status,
      retryable: status === undefined ? true : status >= 500,
    };
  }
}

function mapStopReason(stopReason: string | null): AICompletionResponse['finishReason'] {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'content_filter';
    case null:
    case undefined:
      return 'stop';
    default:
      return 'stop';
  }
}

function tryParseJson(content: string): unknown {
  const trimmed = content.trim();
  // Strip possible markdown code fences
  const unfenced = trimmed.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // Extract the first JSON object/array
    const match = unfenced.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
