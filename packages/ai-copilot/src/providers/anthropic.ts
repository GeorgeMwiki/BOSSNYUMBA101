/**
 * Anthropic Provider
 *
 * Provides access to Claude Opus, Sonnet, and Haiku models — the reasoning
 * substrate for the BossNyumba Brain. The Brain's "soul" is Opus for hard
 * reasoning, Sonnet as the default executor, Haiku for high-volume low-cost
 * coworker turns.
 *
 * Pairs with `advisor.ts` to implement the Anthropic Advisor Pattern (2026):
 * cheap executor + occasional Opus consultation mid-turn.
 *
 * Note: uses plain fetch against the Anthropic Messages API to avoid adding
 * a new SDK dependency. Conforms to the AIProvider contract so it is a drop-in
 * peer of OpenAIProvider / MockAIProvider.
 */

import { AIResult, aiOk, aiErr, ModelId, asModelId } from '../types/core.types.js';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  ModelInfo,
} from './ai-provider.js';

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
  /** Anthropic API version (x-api-version header) */
  apiVersion?: string;
}

/**
 * Anthropic model identifiers.
 *
 * These match the model IDs documented in the 2026 Anthropic Messages API.
 * `claude-opus-4-6` is the flagship reasoning model — the "soul" of the Brain.
 * `claude-sonnet-4-6` is the default executor for Juniors and Estate Manager.
 * `claude-haiku-4-5` is the low-cost executor for Coworker and high-volume paths.
 */
export const ANTHROPIC_MODELS = {
  OPUS_4_6: 'claude-opus-4-6',
  SONNET_4_6: 'claude-sonnet-4-6',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
} as const;

export type AnthropicModelId =
  (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];

/**
 * Anthropic Provider Implementation
 */
export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly supportedModels: string[] = [
    ANTHROPIC_MODELS.OPUS_4_6,
    ANTHROPIC_MODELS.SONNET_4_6,
    ANTHROPIC_MODELS.HAIKU_4_5,
  ];

  private config: AnthropicProviderConfig;
  private modelInfoMap: Map<string, ModelInfo>;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    // Pricing approximations (USD per 1k tokens) as of 2026. These drive
    // governance-service cost tracking; they are conservative upper bounds and
    // should be overridden by the central billing config when available.
    this.modelInfoMap = new Map([
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
   * Execute a completion against the Anthropic Messages API.
   *
   * The API expects `system` as a top-level field (not a role-prefixed message)
   * and a `messages` array of `{ role, content }`. We translate our internal
   * CompiledPrompt shape accordingly.
   */
  async complete(
    request: AICompletionRequest
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const modelId =
      request.modelOverride ??
      request.prompt.modelConfig.modelId ??
      this.config.defaultModel ??
      ANTHROPIC_MODELS.SONNET_4_6;
    const timeoutMs = request.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;

    const userContent = request.additionalContext
      ? `${request.prompt.userPrompt}\n\n${request.additionalContext}`
      : request.prompt.userPrompt;

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: request.prompt.modelConfig.maxTokens ?? 4096,
      temperature:
        request.temperatureOverride ?? request.prompt.modelConfig.temperature ?? 0.7,
      messages: [{ role: 'user', content: userContent }],
    };

    if (request.prompt.systemPrompt) {
      body.system = request.prompt.systemPrompt;
    }
    if (request.prompt.modelConfig.topP !== undefined) {
      body.top_p = request.prompt.modelConfig.topP;
    }
    // Anthropic does not have an OpenAI-style json_object mode; callers that
    // need strict JSON should instruct the model in the system prompt and we
    // will attempt JSON.parse on the response.

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
            'anthropic-version': this.config.apiVersion ?? '2023-06-01',
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
        content?: Array<{ type: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content =
        data.content
          ?.filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('') ?? '';

      let parsedJson: unknown = undefined;
      if (request.jsonMode) {
        parsedJson = safeJsonParse(content);
      }

      const finishReason = mapStopReason(data.stop_reason);
      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;

      return aiOk({
        content,
        parsedJson,
        modelId: asModelId(modelId),
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        processingTimeMs: Date.now() - startTime,
        finishReason,
      });
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
    if (
      statusCode === 400 &&
      /context|token|length/i.test(errorMessage)
    ) {
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

  async healthCheck(): Promise<boolean> {
    // Anthropic has no cheap GET; a lightweight well-formed messages call is
    // the canonical health probe, but we avoid billing on health checks by
    // returning true when config is present. Real liveness is observed via
    // completion success/failure in the governance service.
    return Boolean(this.config.apiKey);
  }
}

function mapStopReason(
  raw: string | undefined
): 'stop' | 'length' | 'content_filter' | 'error' {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    default:
      return 'stop';
  }
}

function safeJsonParse(content: string): unknown {
  // Tolerate fenced code blocks like ```json ... ```
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : content;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return undefined;
  }
}
