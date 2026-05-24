/**
 * Cartesia Sonic-2 — sub-40ms TTFB TTS, low-latency fallback for English /
 * en-KE legs of the conversation.
 *
 * Real implementation: WebSocket against `wss://api.cartesia.ai/tts/websocket`
 * with `X-API-Key: $CARTESIA_API_KEY`. Emits MP3 / PCM frames we surface as
 * PartialAudio.
 *
 * Required env: `CARTESIA_API_KEY`.
 *
 * This is the STUB used in tests.
 */

import type {
  PartialAudio,
  ProviderName,
  StartSessionOptions,
  TtsProvider,
  TtsSessionHandle,
} from './types.js';

const PROVIDER: ProviderName = 'cartesia-sonic-2';

export const CARTESIA_ENV_VARS = ['CARTESIA_API_KEY'] as const;

export function createCartesiaProvider(): TtsProvider {
  return {
    name: PROVIDER,
    async startSession(options: StartSessionOptions): Promise<TtsSessionHandle> {
      const sessionId = `cartesia-sonic-2:${options.tenantId}:${options.language}:${Date.now()}`;

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

      return {
        sessionId,
        provider: PROVIDER,
        async speak(_text: string) {
          // Stub — real impl streams Sonic-2 frames.
        },
        audio,
        async close() {
          // Stub.
        },
      };
    },
  };
}
