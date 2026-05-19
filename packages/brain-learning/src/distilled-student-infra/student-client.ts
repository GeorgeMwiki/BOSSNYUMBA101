/**
 * IStudentModelClient — drop-in contract for a self-hosted student
 * model trained externally on the preference pairs produced by
 * Module 3.
 *
 * The brain's `BrainLLMRouter` (Phase N-C) routes 80% of easy turns
 * to a student when one is loaded. When no checkpoint is loaded the
 * router falls back to N-C's `cost-cascade` Haiku tier.
 *
 * Three adapters ship today (§3 R-LEARNING):
 *   - OllamaClient        — local laptop / dev box (no GPU required)
 *   - VLLMClient          — self-hosted GPU server (A10G in production)
 *   - BedrockHaikuClient  — AWS-managed fallback for tenants without
 *                           sovereignty constraints
 *
 * Student model checkpoint path is configurable via env
 * (`STUDENT_MODEL_PATH`) — the resolver reads it but the adapters do
 * not own filesystem state.
 */

export interface StudentInvokeInput {
  readonly prompt: string;
  /** Optional system prompt (prefix-cached, per K-D prefix-caching). */
  readonly system?: string;
  /** Soft cap on response tokens; adapters MAY ignore. */
  readonly maxTokens?: number;
  /** 0-1; defaults set per adapter. */
  readonly temperature?: number;
}

export interface StudentInvokeOutput {
  readonly content: string;
  /** Token cost; 0 for self-hosted, > 0 for Bedrock. */
  readonly costUsdCents: number;
  /** Wall-time in ms; useful for shadow-mode comparisons. */
  readonly latencyMs: number;
  /** Adapter name, for tracing / observability. */
  readonly adapter: 'ollama' | 'vllm' | 'bedrock-haiku' | 'fallback';
}

/**
 * The drop-in contract.
 */
export interface IStudentModelClient {
  invoke(input: StudentInvokeInput): Promise<StudentInvokeOutput>;
  /** Returns true when a checkpoint is loaded and the adapter is ready. */
  isReady(): Promise<boolean>;
  /** Adapter identity. */
  readonly adapter: StudentInvokeOutput['adapter'];
}

/**
 * Ollama adapter (local). Suitable for dev boxes; not for production.
 * Requires an `ollama` HTTP server (default localhost:11434).
 */
export class OllamaClient implements IStudentModelClient {
  readonly adapter = 'ollama' as const;
  constructor(
    private readonly config: {
      readonly endpoint: string;
      readonly modelTag: string;
      readonly fetchImpl?: typeof fetch;
      readonly clock?: () => Date;
    },
  ) {}

  async isReady(): Promise<boolean> {
    const fetchFn = this.config.fetchImpl ?? fetch;
    try {
      const res = await fetchFn(`${this.config.endpoint}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async invoke(input: StudentInvokeInput): Promise<StudentInvokeOutput> {
    const fetchFn = this.config.fetchImpl ?? fetch;
    const clock = this.config.clock ?? (() => new Date());
    const t0 = clock().getTime();
    const res = await fetchFn(`${this.config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.modelTag,
        prompt: input.prompt,
        system: input.system,
        options: {
          temperature: input.temperature ?? 0.2,
          num_predict: input.maxTokens ?? 512,
        },
        stream: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`OllamaClient failed: ${res.status}`);
    }
    const body = (await res.json()) as { response: string };
    const t1 = clock().getTime();
    return Object.freeze({
      content: body.response,
      costUsdCents: 0, // self-hosted
      latencyMs: t1 - t0,
      adapter: 'ollama',
    });
  }
}

/**
 * vLLM adapter (self-hosted GPU, OpenAI-compatible endpoint).
 */
export class VLLMClient implements IStudentModelClient {
  readonly adapter = 'vllm' as const;
  constructor(
    private readonly config: {
      readonly endpoint: string;
      readonly modelName: string;
      readonly apiKey?: string;
      readonly fetchImpl?: typeof fetch;
      readonly clock?: () => Date;
    },
  ) {}

  async isReady(): Promise<boolean> {
    const fetchFn = this.config.fetchImpl ?? fetch;
    try {
      const res = await fetchFn(`${this.config.endpoint}/v1/models`, {
        headers: this.authHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async invoke(input: StudentInvokeInput): Promise<StudentInvokeOutput> {
    const fetchFn = this.config.fetchImpl ?? fetch;
    const clock = this.config.clock ?? (() => new Date());
    const t0 = clock().getTime();
    const res = await fetchFn(`${this.config.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 512,
      }),
    });
    if (!res.ok) {
      throw new Error(`VLLMClient failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const t1 = clock().getTime();
    return Object.freeze({
      content: body.choices[0]?.message.content ?? '',
      costUsdCents: 0, // self-hosted
      latencyMs: t1 - t0,
      adapter: 'vllm',
    });
  }

  private authHeaders(): Record<string, string> {
    return this.config.apiKey
      ? { Authorization: `Bearer ${this.config.apiKey}` }
      : {};
  }
}

/**
 * Bedrock Haiku adapter — managed fallback. NB: costUsdCents non-zero.
 * This is the only adapter that may carry a meaningful per-token cost.
 */
export class BedrockHaikuClient implements IStudentModelClient {
  readonly adapter = 'bedrock-haiku' as const;
  constructor(
    private readonly config: {
      readonly region: string;
      readonly modelId: string;
      readonly invokeFn: (args: {
        modelId: string;
        prompt: string;
        system: string | undefined;
        maxTokens: number;
        temperature: number;
      }) => Promise<{ content: string; costUsdCents: number; latencyMs: number }>;
    },
  ) {}

  async isReady(): Promise<boolean> {
    // Bedrock is always conceptually "ready" — runtime errors signal otherwise.
    return true;
  }

  async invoke(input: StudentInvokeInput): Promise<StudentInvokeOutput> {
    const result = await this.config.invokeFn({
      modelId: this.config.modelId,
      prompt: input.prompt,
      system: input.system,
      maxTokens: input.maxTokens ?? 512,
      temperature: input.temperature ?? 0.2,
    });
    return Object.freeze({
      content: result.content,
      costUsdCents: result.costUsdCents,
      latencyMs: result.latencyMs,
      adapter: 'bedrock-haiku',
    });
  }
}
