/**
 * Chat Provider abstraction
 *
 * Conversation-style completions across multiple LLM backends
 * (Anthropic Claude, OpenAI GPT, DeepSeek, mock).
 *
 * Unlike the single-shot AIProvider.complete used by copilots, this
 * abstraction accepts a multi-turn message history and can stream.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  /** System prompt (injected at the top). */
  system?: string;
  /** Multi-turn conversation. System messages here are ignored; use `system`. */
  messages: ChatMessage[];
  /** Sampling temperature (0-2). Default 0.3 */
  temperature?: number;
  /** Max tokens to generate. Default 1024 */
  maxTokens?: number;
  /** Force JSON output if the provider supports it. */
  jsonMode?: boolean;
  /** Override the provider-level model. */
  modelOverride?: string;
  /** Request timeout in ms. Default 60s */
  timeoutMs?: number;
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage: ChatCompletionUsage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  processingTimeMs: number;
}

export interface ChatStreamChunk {
  /** Incremental content delta. */
  delta: string;
  /** True when the stream is finished. */
  done: boolean;
  /** Populated on the final chunk. */
  usage?: ChatCompletionUsage;
  /** Populated on the final chunk. */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * ChatProvider - unified interface for streaming + non-streaming chat LLMs.
 */
export interface ChatProvider {
  readonly providerId: 'anthropic' | 'openai' | 'deepseek' | 'mock';
  readonly defaultModel: string;
  /** Does this provider require a real API key (false for mock) */
  readonly isMock: boolean;
  complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  stream(req: ChatCompletionRequest): AsyncIterable<ChatStreamChunk>;
  healthCheck(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Mock provider - used when no API keys are configured so the feature
// degrades gracefully instead of 500ing.
// ---------------------------------------------------------------------------
export class MockChatProvider implements ChatProvider {
  readonly providerId = 'mock' as const;
  readonly defaultModel = 'mock-disabled';
  readonly isMock = true;

  private readonly message: string;

  constructor(message = 'AI disabled \u2014 set ANTHROPIC_API_KEY') {
    this.message = message;
  }

  async complete(_req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      content: this.message,
      model: this.defaultModel,
      provider: this.providerId,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      processingTimeMs: 0,
    };
  }

  async *stream(_req: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
    yield { delta: this.message, done: false };
    yield {
      delta: '',
      done: true,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Anthropic Claude provider
// ---------------------------------------------------------------------------
export interface AnthropicChatConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicChatProvider implements ChatProvider {
  readonly providerId = 'anthropic' as const;
  readonly defaultModel: string;
  readonly isMock = false;
  private readonly config: AnthropicChatConfig;

  constructor(config: AnthropicChatConfig) {
    this.config = config;
    this.defaultModel = config.defaultModel ?? 'claude-3-5-sonnet-20241022';
  }

  private toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
    // Anthropic does not allow `system` in messages; it is sent separately.
    const out: AnthropicMessage[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    // Anthropic requires the first message to be user.
    if (out.length > 0 && out[0].role !== 'user') {
      out.unshift({ role: 'user', content: '(continue)' });
    }
    return out;
  }

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();
    const model = req.modelOverride ?? this.defaultModel;
    const timeoutMs = req.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        messages: this.toAnthropicMessages(req.messages),
      };
      if (req.system) body.system = req.system;

      const resp = await fetch(`${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Anthropic error ${resp.status}: ${txt}`);
      }

      const data = await resp.json() as {
        content?: { type: string; text: string }[];
        stop_reason?: string;
        model?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');

      return {
        content,
        model: data.model ?? model,
        provider: this.providerId,
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        finishReason: mapStopReason(data.stop_reason),
        processingTimeMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(req: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
    const model = req.modelOverride ?? this.defaultModel;
    const timeoutMs = req.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        messages: this.toAnthropicMessages(req.messages),
        stream: true,
      };
      if (req.system) body.system = req.system;

      const resp = await fetch(`${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Anthropic stream error ${resp.status}: ${txt}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as Record<string, unknown>;
            const t = evt.type as string;
            if (t === 'content_block_delta') {
              const delta = (evt.delta as { text?: string } | undefined)?.text;
              if (delta) yield { delta, done: false };
            } else if (t === 'message_delta') {
              const usage = evt.usage as { output_tokens?: number } | undefined;
              if (usage?.output_tokens) outputTokens = usage.output_tokens;
              const sr = (evt.delta as { stop_reason?: string } | undefined)?.stop_reason;
              if (sr) stopReason = sr;
            } else if (t === 'message_start') {
              const usage = (evt.message as { usage?: { input_tokens?: number } } | undefined)?.usage;
              if (usage?.input_tokens) inputTokens = usage.input_tokens;
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }

      yield {
        delta: '',
        done: true,
        usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens },
        finishReason: mapStopReason(stopReason),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Anthropic has no public ping; treat non-empty key as healthy.
      return Boolean(this.config.apiKey && this.config.apiKey.length > 10);
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI chat provider (chat-completions API)
// ---------------------------------------------------------------------------
export interface OpenAIChatConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
  organization?: string;
}

export class OpenAIChatProvider implements ChatProvider {
  readonly providerId = 'openai' as const;
  readonly defaultModel: string;
  readonly isMock = false;
  private readonly config: OpenAIChatConfig;

  constructor(config: OpenAIChatConfig) {
    this.config = config;
    this.defaultModel = config.defaultModel ?? 'gpt-4o-mini';
  }

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();
    const model = req.modelOverride ?? this.defaultModel;
    const timeoutMs = req.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages: ChatMessage[] = [];
      if (req.system) messages.push({ role: 'system', content: req.system });
      messages.push(...req.messages);

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
      };
      if (req.jsonMode) body.response_format = { type: 'json_object' };

      const resp = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organization ? { 'OpenAI-Organization': this.config.organization } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`OpenAI error ${resp.status}: ${txt}`);
      }
      const data = await resp.json() as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;
      };
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model ?? model,
        provider: this.providerId,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: mapStopReason(data.choices?.[0]?.finish_reason),
        processingTimeMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(req: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
    const model = req.modelOverride ?? this.defaultModel;
    const timeoutMs = req.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages: ChatMessage[] = [];
      if (req.system) messages.push({ role: 'system', content: req.system });
      messages.push(...req.messages);

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        stream: true,
      };
      if (req.jsonMode) body.response_format = { type: 'json_object' };

      const resp = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`OpenAI stream error ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finishReason: string | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload) as {
              choices?: { delta?: { content?: string }; finish_reason?: string }[];
            };
            const delta = evt.choices?.[0]?.delta?.content;
            if (delta) yield { delta, done: false };
            if (evt.choices?.[0]?.finish_reason) finishReason = evt.choices[0].finish_reason;
          } catch {
            // ignore
          }
        }
      }

      yield {
        delta: '',
        done: true,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: mapStopReason(finishReason),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.config.apiKey);
  }
}

// ---------------------------------------------------------------------------
// DeepSeek provider (OpenAI-compatible API)
// ---------------------------------------------------------------------------
export interface DeepSeekChatConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTimeoutMs?: number;
}

export class DeepSeekChatProvider extends OpenAIChatProvider {
  readonly providerId = 'deepseek' as const;

  constructor(config: DeepSeekChatConfig) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com',
      defaultModel: config.defaultModel ?? 'deepseek-chat',
      defaultTimeoutMs: config.defaultTimeoutMs,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapStopReason(raw?: string): 'stop' | 'length' | 'content_filter' | 'error' {
  switch (raw) {
    case 'end_turn':
    case 'stop':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    default:
      return raw ? 'stop' : 'stop';
  }
}
