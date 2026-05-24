/**
 * STT router — picks the speech-to-text provider for a given language tag.
 *
 * Policy (per `.audit/litfin-sota-2026-05-23/14-multimodal-generative.md`):
 *
 *   sw / sw-TZ / sheng → Lelapa Vulavula (best African-language STT)
 *   lug / lg           → Lelapa Vulavula
 *   yo / ig / ha       → Spitch (Nigerian-focused, native phoneme coverage)
 *   en / en-KE         → gpt-realtime-2 (duplex; we just use its STT leg)
 *   default            → gpt-realtime-2
 *
 * The router returns a pure description (provider name) — actually opening
 * the upstream session is the caller's job so the route handler can pool /
 * cache sessions however it wants. This keeps the router itself stateless and
 * trivial to unit-test.
 */

import type { LanguageTag, ProviderName } from '../providers/types.js';
import {
  isEnglish,
  isLuganda,
  isNigerianLanguage,
  isSwahiliFamily,
} from './language-router.js';

export interface SttRoutingDecision {
  readonly provider: ProviderName;
  readonly rationale: string;
}

export function routeStt(language: LanguageTag): SttRoutingDecision {
  if (isSwahiliFamily(language)) {
    return {
      provider: 'lelapa-vulavula',
      rationale: 'Lelapa Vulavula is SOTA for Swahili / Sheng STT.',
    };
  }
  if (isLuganda(language)) {
    return {
      provider: 'lelapa-vulavula',
      rationale: 'Lelapa Vulavula covers Luganda inbound transcription.',
    };
  }
  if (isNigerianLanguage(language)) {
    return {
      provider: 'spitch',
      rationale: 'Spitch is Nigeria-focused with native Yo / Ig / Ha phonemes.',
    };
  }
  if (isEnglish(language)) {
    return {
      provider: 'gpt-realtime-2',
      rationale: 'gpt-realtime-2 duplex covers en / en-KE end-to-end at ~1s e2e.',
    };
  }
  // Default — keep parity with the duplex provider so the conversation
  // pipeline still works even for unmapped tags.
  return {
    provider: 'gpt-realtime-2',
    rationale: 'Default fallback: gpt-realtime-2 duplex STT.',
  };
}
