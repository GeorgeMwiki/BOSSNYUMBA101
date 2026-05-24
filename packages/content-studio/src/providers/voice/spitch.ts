/**
 * Spitch — Nigeria-focused TTS (Yoruba, Igbo, Hausa, Nigerian-accented English).
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§4)
 *   - Spitch: https://spitch.app/
 *
 * Env vars (for real wiring; unused in this stub):
 *   - SPITCH_API_KEY  — primary
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
const PROVIDER_ID = 'spitch';
const MODEL_ID = 'spitch-2026-q1';

const SUPPORTED_LANGS: ReadonlySet<string> = new Set(['yo', 'ig', 'ha', 'en-ng']);

export function createSpitchProvider(): VoiceProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    supportsLanguage(lang: LanguageTag): boolean {
      const lower = lang.toLowerCase();
      if (SUPPORTED_LANGS.has(lower)) return true;
      const base = lower.split('-')[0] ?? '';
      return SUPPORTED_LANGS.has(base);
    },

    async synthesize(req: VoiceRequest): Promise<ContentResult> {
      const hash = deterministicHash(`${PROVIDER_ID}|${req.language}|${req.text}`);
      const url = `https://stub.bossnyumba.local/spitch/${hash}.mp3`;
      const createdAtIso = new Date(0).toISOString();
      const cost = Math.max(1, Math.ceil(req.text.length / 1000)) * 45_000;
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
          title: 'Spitch synthesized audio',
          format: 'audio/mpeg',
          providerId: PROVIDER_ID,
          modelId: MODEL_ID,
          prompt: req.text,
          tenantId: req.tenantId,
          seed: 0,
          loraIds: [],
          createdAtIso,
        }),
        createdAtIso,
      };
    },
  };
}
