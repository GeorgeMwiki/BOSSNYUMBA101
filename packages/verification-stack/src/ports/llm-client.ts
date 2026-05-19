/**
 * LlmClient — duck-typed Anthropic-like SDK abstraction.
 *
 * This port lets the verification-stack avoid a hard dependency on
 * `@anthropic-ai/sdk`. Production wires the real client; tests inject
 * deterministic mocks.
 *
 * The shape mirrors `@anthropic-ai/sdk` `messages.create` so that a
 * single-line adapter `{ messages: { create: (a) => client.messages.create(a) } }`
 * is enough at the wiring layer.
 */

export interface LlmMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface LlmCompletionRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly system?: string;
  readonly messages: ReadonlyArray<LlmMessage>;
  /** Sampling temperature (0..1). Higher = more diverse. */
  readonly temperature?: number;
  /** Optional metadata for sovereign-ledger correlation. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface LlmContentBlock {
  readonly type: string;
  readonly text?: string;
}

export interface LlmCompletionResponse {
  readonly content: ReadonlyArray<LlmContentBlock>;
  readonly model?: string;
  /** Stop reason from the underlying SDK; useful for circuit-breakers. */
  readonly stop_reason?: string;
}

export interface LlmClient {
  readonly messages: {
    create(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  };
}

/**
 * Helper — pulls text content out of a completion response.
 * Joins all text blocks; ignores tool-use, thinking, etc.
 */
export function extractText(response: LlmCompletionResponse): string {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}
