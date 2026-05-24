/**
 * Spitch — Nigerian-language STT/TTS, primary for Yoruba / Igbo / Hausa
 * inbound transcription on the Mr. Mwikila pipeline.
 *
 * Real implementation: POST `https://api.spi-tch.com/v1/transcribe` with
 * `Authorization: Bearer $SPITCH_API_KEY`. Spitch also offers TTS but the
 * tts-router prefers ElevenLabs v3 for these languages — see
 * `src/router/tts-router.ts` for the policy rationale.
 *
 * Required env: `SPITCH_API_KEY`.
 *
 * This is the STUB used in tests.
 */

import type {
  AudioChunk,
  PartialTranscript,
  ProviderName,
  StartSessionOptions,
  SttProvider,
  SttSessionHandle,
} from './types.js';

const PROVIDER: ProviderName = 'spitch';

export const SPITCH_ENV_VARS = ['SPITCH_API_KEY'] as const;

export function createSpitchProvider(): SttProvider {
  return {
    name: PROVIDER,
    async startSession(options: StartSessionOptions): Promise<SttSessionHandle> {
      const sessionId = `spitch:${options.tenantId}:${options.language}:${Date.now()}`;

      async function* transcripts(): AsyncIterable<PartialTranscript> {
        yield {
          sessionId,
          text: '[stub] partial',
          isFinal: false,
          confidence: 0.55,
          language: options.language,
        };
        yield {
          sessionId,
          text: '[stub] final transcript',
          isFinal: true,
          confidence: 0.95,
          language: options.language,
        };
      }

      return {
        sessionId,
        provider: PROVIDER,
        async pushAudio(_chunk: AudioChunk) {
          // Stub.
        },
        transcripts,
        async close() {
          // Stub.
        },
      };
    },
  };
}
