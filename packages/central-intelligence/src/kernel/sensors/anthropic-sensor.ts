/**
 * Anthropic Sensor — wraps the @anthropic-ai/sdk Messages API as a
 * kernel Sensor. Provider-agnostic kernel + provider-specific adapter
 * pattern; downstream callers compose multiple sensors into a
 * SensorRouter for failover.
 *
 * The adapter exposes "thinking" and "fast" capabilities so the
 * router can pick the right model for the current call (Opus 4.7 for
 * extended thinking, Sonnet 4.6 for everyday work, Haiku 4.5 for
 * fast / batch).
 *
 * No streaming here — the kernel's `think()` is a single-shot RPC.
 * Streaming tool-use is owned by the agent-loop transport.
 *
 * The @anthropic-ai/sdk dependency is a peer-dep; consumers bring
 * their own version.
 */

import type { Sensor, SensorCallArgs, SensorCallResult } from '../kernel-types.js';

// ---------------------------------------------------------------------------
// Minimal duck-typed surface of Anthropic's Messages API. We avoid a
// hard import of the SDK so this module's *types* are buildable in a
// workspace that has not yet installed @anthropic-ai/sdk; consumers
// pass in a real client at runtime.
// ---------------------------------------------------------------------------

export interface AnthropicMessageBlock {
  readonly type: 'text' | 'thinking' | 'tool_use';
  readonly text?: string;
  readonly thinking?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
}

export interface AnthropicMessageResponse {
  readonly id: string;
  readonly model: string;
  readonly stop_reason: string | null;
  readonly content: ReadonlyArray<AnthropicMessageBlock>;
}

export interface AnthropicMessagesClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
      thinking?: { type: 'enabled'; budget_tokens: number };
      // any other passthrough fields are ignored
    }): Promise<AnthropicMessageResponse>;
  };
}

export interface AnthropicSensorConfig {
  readonly id: string;
  readonly modelId: string;
  readonly priority: number;
  readonly capabilities: ReadonlyArray<Sensor['capabilities'][number]>;
  /** Max output tokens. Default 1024. */
  readonly maxTokens?: number;
  /** When true (and stakes high/critical), enable extended thinking. */
  readonly extendedThinkingBudget?: number;
}

export function createAnthropicSensor(
  client: AnthropicMessagesClient,
  config: AnthropicSensorConfig,
): Sensor {
  const maxTokens = config.maxTokens ?? 1024;
  const thinkingBudget = config.extendedThinkingBudget ?? 4096;

  return {
    id: config.id,
    modelId: config.modelId,
    priority: config.priority,
    capabilities: config.capabilities,

    async call(args: SensorCallArgs): Promise<SensorCallResult> {
      const start = Date.now();
      const useThinking =
        args.extendedThinking &&
        config.capabilities.includes('thinking');

      const messages = [
        ...args.priorTurns.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: args.userMessage },
      ];

      const response = await client.messages.create({
        model: config.modelId,
        max_tokens: maxTokens,
        system: args.system,
        messages,
        ...(useThinking
          ? { thinking: { type: 'enabled' as const, budget_tokens: thinkingBudget } }
          : {}),
      });

      let text = '';
      let thought: string | null = null;
      const toolCalls: Array<{ toolName: string; input: unknown; callId: string }> = [];

      for (const block of response.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          thought = (thought ?? '') + block.thinking;
        } else if (block.type === 'tool_use' && block.name) {
          toolCalls.push({
            toolName: block.name,
            input: block.input,
            callId: block.id ?? `tu_${toolCalls.length}`,
          });
        }
      }

      return {
        text,
        thought,
        toolCalls,
        latencyMs: Date.now() - start,
        modelId: response.model || config.modelId,
        sensorId: config.id,
      };
    },
  };
}

/**
 * Suggested presets for the three Claude tiers, with priorities tuned
 * so the router falls Opus → Sonnet → Haiku on failure.
 */
export const ANTHROPIC_SENSOR_PRESETS = {
  opus47: (client: AnthropicMessagesClient): Sensor =>
    createAnthropicSensor(client, {
      id: 'anthropic-opus-4-7',
      modelId: 'claude-opus-4-7',
      priority: 1,
      capabilities: ['thinking', 'fast'],
      maxTokens: 1024,
      extendedThinkingBudget: 4096,
    }),
  sonnet46: (client: AnthropicMessagesClient): Sensor =>
    createAnthropicSensor(client, {
      id: 'anthropic-sonnet-4-6',
      modelId: 'claude-sonnet-4-6',
      priority: 2,
      capabilities: ['fast', 'thinking'],
      maxTokens: 1024,
    }),
  haiku45: (client: AnthropicMessagesClient): Sensor =>
    createAnthropicSensor(client, {
      id: 'anthropic-haiku-4-5',
      modelId: 'claude-haiku-4-5-20251001',
      priority: 3,
      capabilities: ['fast', 'batch'],
      maxTokens: 1024,
    }),
} as const;
