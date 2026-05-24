/**
 * ElevenLabs v3 — multilingual + emotional TTS.
 *
 * 70+ languages with explicit Swahili, Hausa, Lingala, Chichewa, Somali
 * coverage. Audio tags ([laughs] [whispers]), Text-to-Dialogue API.
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§3.1)
 *   - ElevenLabs v3: https://elevenlabs.io/v3
 *   - Swahili TTS:    https://elevenlabs.io/text-to-speech/swahili
 *
 * Env vars (for real wiring; unused in this stub):
 *   - ELEVENLABS_API_KEY  — primary
 *   - ELEVENLABS_DEFAULT_VOICE_ID — fallback voice when tenant has no clone
 */

import { buildC2paManifest } from '../../c2pa/attestation.js';
import { deterministicHash } from '../shared.js';
import type {
  ContentResult,
  LanguageTag,
  VoiceProvider,
  VoiceRequest,
  VoiceTask,
} from '../../types.js';

const SUPPORTED: ReadonlyArray<VoiceTask> = ['narration', 'agent_realtime'];
const PROVIDER_ID = 'elevenlabs';
const MODEL_ID = 'eleven-v3';

// Subset relevant to BossNyumba's footprint; real provider exposes 70+.
const SUPPORTED_LANGS: ReadonlySet<string> = new Set([
  'en', 'sw', 'ha', 'ln', 'ny', 'so', 'fr', 'pt', 'ar',
]);

export function createElevenLabsProvider(): VoiceProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    supportsLanguage(lang: LanguageTag): boolean {
      const base = lang.toLowerCase().split('-')[0] ?? '';
      return SUPPORTED_LANGS.has(base);
    },

    async synthesize(req: VoiceRequest): Promise<ContentResult> {
      const voiceId = req.voiceId ?? req.brand?.elevenLabsVoiceId ?? 'default';
      const hash = deterministicHash(`${PROVIDER_ID}|${voiceId}|${req.language}|${req.text}`);
      const url = `https://stub.bossnyumba.local/elevenlabs/${hash}.mp3`;
      const createdAtIso = new Date(0).toISOString();
      // $0.05 per 1k chars reference price.
      const cost = Math.max(1, Math.ceil(req.text.length / 1000)) * 50_000;
      return {
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        modality: 'voice',
        assets: [
          {
            url,
            mimeType: 'audio/mpeg',
            durationSeconds: Math.max(1, Math.ceil(req.text.length / 18)),
          },
        ],
        costMicrousd: cost,
        c2paManifest: buildC2paManifest({
          title: 'ElevenLabs synthesized audio',
          format: 'audio/mpeg',
          providerId: PROVIDER_ID,
          modelId: MODEL_ID,
          prompt: req.text,
          tenantId: req.tenantId,
          seed: 0,
          loraIds: [voiceId],
          createdAtIso,
        }),
        createdAtIso,
      };
    },
  };
}
