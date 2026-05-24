/**
 * OpenAI gpt-realtime-2 — primary duplex provider for the voice agent.
 *
 * Real implementation: opens a WebSocket against
 * `wss://api.openai.com/v1/realtime` with `Authorization: Bearer
 * $OPENAI_API_KEY`. The duplex stream emits `response.audio.delta` and
 * `response.transcript.delta` events that we surface as PartialAudio /
 * PartialTranscript.
 *
 * Required env: `OPENAI_API_KEY`.
 *
 * This file is the STUB used in tests — it returns deterministic placeholders
 * and never touches the network. The real wiring will swap the body of
 * `startSession` while keeping the contract intact.
 */

import type {
  AudioChunk,
  DuplexSessionHandle,
  PartialAudio,
  PartialTranscript,
  ProviderName,
  StartSessionOptions,
} from './types.js';

const PROVIDER: ProviderName = 'gpt-realtime-2';

/** Required environment variables documented for ops / CI secret-scan. */
export const GPT_REALTIME_2_ENV_VARS = ['OPENAI_API_KEY'] as const;

export interface GptRealtime2Provider {
  readonly name: ProviderName;
  startSession(options: StartSessionOptions): Promise<DuplexSessionHandle>;
}

export function createGptRealtime2Provider(): GptRealtime2Provider {
  return {
    name: PROVIDER,
    async startSession(options) {
      const sessionId = `gpt-realtime-2:${options.tenantId}:${options.language}:${Date.now()}`;

      async function* transcripts(): AsyncIterable<PartialTranscript> {
        // Deterministic placeholder — first a partial, then a final.
        yield {
          sessionId,
          text: '[stub] partial transcript',
          isFinal: false,
          confidence: 0.5,
          language: options.language,
        };
        yield {
          sessionId,
          text: '[stub] final transcript',
          isFinal: true,
          confidence: 0.99,
          language: options.language,
        };
      }

      async function* audio(): AsyncIterable<PartialAudio> {
        yield {
          sessionId,
          audio: {
            bytes: new Uint8Array(0),
            mimeType: 'audio/pcm',
            sampleRate: 24000,
          },
          isFinal: true,
        };
      }

      const handle: DuplexSessionHandle = {
        sessionId,
        provider: PROVIDER,
        async pushAudio(_chunk: AudioChunk) {
          // Stub — real impl posts to WebSocket as input_audio_buffer.append.
        },
        async speak(_text: string) {
          // Stub — real impl posts response.create with modalities=['audio'].
        },
        transcripts,
        audio,
        async close() {
          // Stub — real impl closes the WS.
        },
      };
      return handle;
    },
  };
}
