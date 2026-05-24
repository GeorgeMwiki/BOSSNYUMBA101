/**
 * ElevenLabs v3 — multilingual TTS, primary for Swahili / Bantu / Sheng.
 *
 * Real implementation: POST `https://api.elevenlabs.io/v1/text-to-speech/
 * {voice_id}/stream` with `xi-api-key: $ELEVENLABS_API_KEY`. Returns an MP3 /
 * Opus stream we re-chunk into PartialAudio frames.
 *
 * Required env: `ELEVENLABS_API_KEY`.
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

const PROVIDER: ProviderName = 'elevenlabs-v3';

export const ELEVENLABS_V3_ENV_VARS = ['ELEVENLABS_API_KEY'] as const;

export function createElevenlabsV3Provider(): TtsProvider {
  return {
    name: PROVIDER,
    async startSession(options: StartSessionOptions): Promise<TtsSessionHandle> {
      const sessionId = `elevenlabs-v3:${options.tenantId}:${options.language}:${Date.now()}`;

      async function* audio(): AsyncIterable<PartialAudio> {
        yield {
          sessionId,
          audio: {
            bytes: new Uint8Array(0),
            mimeType: 'audio/opus',
            sampleRate: 48000,
          },
          isFinal: true,
        };
      }

      return {
        sessionId,
        provider: PROVIDER,
        async speak(_text: string) {
          // Stub — real impl streams chunked TTS audio back from ElevenLabs.
        },
        audio,
        async close() {
          // Stub.
        },
      };
    },
  };
}
