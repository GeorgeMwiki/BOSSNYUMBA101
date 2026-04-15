/**
 * Anthropic (Claude) Provider
 *
 * Lightweight adapter over Anthropic's Messages API. Supports both non-streaming
 * JSON responses (via `complete`) and SSE streaming (via `stream`).
 *
 * API key must be provided via config (sourced from ANTHROPIC_API_KEY env var).
 * No hardcoded keys.
 */

import { AIResult, aiOk, aiErr, asModelId } from '../types/core.types.js';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  ModelInfo,
} from './ai-provider.js';

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
}

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

const MODEL_INFO: Record<string, ModelInfo> = {
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsJson: true,
    supportsVision: true,
    costPer1kPromptTokens: 0.003,
    costPer1kCompletionTokens: 0.015,
    tier: 'advanced',
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsJson: true,
    supportsVision: false,
    costPer1kPromptTokens: 0.0008,
    costPer1kCompletionTokens: 0.004,
    tier: 'standard',
  },
};

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly supportedModels = Object.keys(MODEL_INFO);

  private config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    if (!config.apiKey) {
      throw new Error(
        'AnthropicProvider: missing apiKey. Set ANTHROPIC_API_KEY in the environment.'
      );
    }
    this.config = config;
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.anthropic.com';
  }

  private buildMessages(req: AICompletionRequest): {
    system: string | undefined;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let userContent = req.prompt.userPrompt;
    if (req.additionalContext) {
      userContent += `\n\n${req.additionalContext}`;
    }
    messages.push({ role: 'user', content: userContent });
    return { system: req.prompt.systemPrompt, messages };
  }

  async complete(
    req: AICompletionRequest
  ): Promise<AIResult<AICompletionResponse, AIProviderError>> {
    const startTime = Date.now();
    const modelId =
      req.modelOverride ??
      req.prompt.modelConfig.modelId ??
      this.config.defaultModel ??
      DEFAULT_MODEL;
    const timeoutMs = req.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;

    try {
      const { system, messages } = this.buildMessages(req);
      const body: Record<string, unknown> = {
        model: modelId,
        max_tokens: req.prompt.modelConfig.maxTokens ?? 1024,
        temperature: req.temperatureOverride ?? req.prompt.modelConfig.temperature ?? 0.7,
        messages,
      };
      if (system) body.system = system;
      if (req.prompt.modelConfig.topP !== undefined) body.top_p = req.prompt.modelConfig.topP;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return aiErr({
          code: response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR',
          message: `Anthropic API error ${response.status}: ${text.slice(0, 500)}`,
          provider: this.providerId,
          statusCode: response.status,
          retryable: response.status >= 500 || response.status === 429,
        });
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const content = (data.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('');

      let parsedJson: unknown;
      if (req.jsonMode) {
        try {
          parsedJson = JSON.parse(content);
        } catch {
          /* leave undefined */
        }
      }

      return aiOk({
        content,
        parsedJson,
        modelId: asModelId(modelId),
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens:
            (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        processingTimeMs: Date.now() - startTime,
        finishReason:
          data.stop_reason === 'max_tokens'
            ? 'length'
            : data.stop_reason === 'end_turn'
              ? 'stop'
              : 'stop',
      });
    } catch (error) {
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
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerId,
        retryable: true,
      });
    }
  }

  /**
   * Stream a completion. Yields text deltas as they arrive.
   * Consumers should flush each delta to their SSE connection.
   */
  async *stream(req: AICompletionRequest): AsyncGenerator<StreamChunk, void, void> {
    const modelId =
      req.modelOverride ??
      req.prompt.modelConfig.modelId ??
      this.config.defaultModel ??
      DEFAULT_MODEL;

    const { system, messages } = this.buildMessages(req);
    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: req.prompt.modelConfig.maxTokens ?? 1024,
      temperature: req.temperatureOverride ?? req.prompt.modelConfig.temperature ?? 0.7,
      messages,
      stream: true,
    };
    if (system) body.system = system;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`Anthropic stream failed ${response.status}: ${text.slice(0, 500)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;
          if (eventType === 'content_block_delta') {
            try {
              const parsed = JSON.parse(dataLine) as {
                delta?: { type?: string; text?: string };
              };
              const text = parsed.delta?.text;
              if (text) yield { delta: text, done: false };
            } catch {
              /* ignore malformed */
            }
          } else if (eventType === 'message_stop') {
            yield { delta: '', done: true };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { delta: '', done: true };
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId);
  }

  getModelInfo(modelId: string): ModelInfo | null {
    return MODEL_INFO[modelId] ?? null;
  }

  async healthCheck(): Promise<boolean> {
    // Anthropic has no public health endpoint; assume reachable if we have a key.
    return Boolean(this.config.apiKey);
  }
}
