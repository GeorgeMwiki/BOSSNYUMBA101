/**
 * Lelapa AI Vulavula — African-language STT/NLU, primary for Swahili and
 * Luganda inbound transcription.
 *
 * Real implementation: POST `https://vulavula-services.lelapa.ai/api/v1/
 * transcribe/sync` (REST short-form) or open the streaming variant with
 * `X-CLIENT-TOKEN: $LELAPA_API_KEY`. Returns transcripts in the requested
 * African language.
 *
 * Required env: `LELAPA_API_KEY`.
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

const PROVIDER: ProviderName = 'lelapa-vulavula';

export const LELAPA_ENV_VARS = ['LELAPA_API_KEY'] as const;

export function createLelapaProvider(): SttProvider {
  return {
    name: PROVIDER,
    async startSession(options: StartSessionOptions): Promise<SttSessionHandle> {
      const sessionId = `lelapa-vulavula:${options.tenantId}:${options.language}:${Date.now()}`;

      async function* transcripts(): AsyncIterable<PartialTranscript> {
        yield {
          sessionId,
          text: '[stub] habari',
          isFinal: false,
          confidence: 0.6,
          language: options.language,
        };
        yield {
          sessionId,
          text: '[stub] habari, nataka kuona nyumba',
          isFinal: true,
          confidence: 0.97,
          language: options.language,
        };
      }

      return {
        sessionId,
        provider: PROVIDER,
        async pushAudio(_chunk: AudioChunk) {
          // Stub — real impl uploads PCM frames to the streaming endpoint.
        },
        transcripts,
        async close() {
          // Stub.
        },
      };
    },
  };
}
