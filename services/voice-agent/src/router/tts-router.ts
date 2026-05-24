/**
 * TTS router — picks the text-to-speech provider for a given language tag
 * and latency tier.
 *
 * Policy (per `.audit/litfin-sota-2026-05-23/14-multimodal-generative.md`):
 *
 *   sw / sw-TZ / sheng → ElevenLabs v3 (best Swahili emotional intonation)
 *   lug / lg           → ElevenLabs v3 (general African coverage)
 *   yo / ig / ha       → ElevenLabs v3 (chosen over Spitch TTS for prosody;
 *                                       Spitch keeps the STT slot — see
 *                                       stt-router.ts)
 *   en / en-KE         → Cartesia Sonic-2 (40ms TTFB low-latency fallback)
 *   default            → Cartesia Sonic-2
 *
 * `tier` lets the caller bias toward latency over voice quality (e.g. for
 * back-channel acks). `'low-latency'` forces Cartesia when the language allows
 * it; `'best-quality'` (default) follows the table above.
 */

import type { LanguageTag, ProviderName } from '../providers/types.js';
import {
  isEnglish,
  isLuganda,
  isNigerianLanguage,
  isSwahiliFamily,
} from './language-router.js';

export type LatencyTier = 'best-quality' | 'low-latency';

export interface TtsRoutingDecision {
  readonly provider: ProviderName;
  readonly rationale: string;
}

export function routeTts(
  language: LanguageTag,
  tier: LatencyTier = 'best-quality',
): TtsRoutingDecision {
  // Caller explicitly wants the lowest possible TTFB — Cartesia regardless of
  // language. Quality on African languages is lower but it's the operator's
  // call (e.g. for short ack tokens).
  if (tier === 'low-latency') {
    return {
      provider: 'cartesia-sonic-2',
      rationale: 'Low-latency tier requested — Cartesia Sonic-2 (40ms TTFB).',
    };
  }

  if (isSwahiliFamily(language)) {
    return {
      provider: 'elevenlabs-v3',
      rationale: 'ElevenLabs v3 — best Swahili emotional intonation.',
    };
  }
  if (isLuganda(language)) {
    return {
      provider: 'elevenlabs-v3',
      rationale: 'ElevenLabs v3 — general Luganda coverage.',
    };
  }
  if (isNigerianLanguage(language)) {
    return {
      provider: 'elevenlabs-v3',
      rationale: 'ElevenLabs v3 — Yo / Ig / Ha prosody; Spitch keeps STT slot.',
    };
  }
  if (isEnglish(language)) {
    return {
      provider: 'cartesia-sonic-2',
      rationale: 'Cartesia Sonic-2 — sub-40ms TTFB for en / en-KE.',
    };
  }
  return {
    provider: 'cartesia-sonic-2',
    rationale: 'Default fallback — Cartesia Sonic-2.',
  };
}
