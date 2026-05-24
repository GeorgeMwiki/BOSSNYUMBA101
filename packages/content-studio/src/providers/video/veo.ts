/**
 * Veo 3.1 / Veo 3.1 Lite — Google.
 *
 * The default video backend. Native audio (dialogue, ambient, SFX), Scene
 * Extension for 1 min+ clips, image-to-video, frame-bridge between two
 * stills (perfect for "empty room → staged room" reveals). 720p/1080p,
 * 16:9 + 9:16 (vertical reels), upscaling to 4K.
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§2.2)
 *   - Veo 3.1 Lite: https://blog.google/innovation-and-ai/technology/ai/veo-3-1-lite/
 *   - AI Studio: https://aistudio.google.com/models/veo-3
 *
 * Env vars (for real wiring; unused in this stub):
 *   - GEMINI_API_KEY   — Gemini API (Veo paid tier)
 *   - VERTEX_PROJECT   — Vertex AI alternative
 *   - VERTEX_LOCATION  — usually us-central1
 */

import { buildC2paManifest } from '../../c2pa/attestation.js';
import { deterministicHash } from '../shared.js';
import type {
  ContentResult,
  VideoProvider,
  VideoRequest,
  VideoTask,
} from '../../types.js';

const SUPPORTED: ReadonlyArray<VideoTask> = ['sizzle_reel', 'i2v_walkthrough'];
const PROVIDER_ID = 'veo';
const MODEL_ID = 'veo-3.1-lite';

export function createVeoProvider(): VideoProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    async generate(req: VideoRequest): Promise<ContentResult> {
      const hash = deterministicHash(
        `${PROVIDER_ID}|${req.prompt}|${req.durationSeconds}|${req.aspectRatio}`,
      );
      const url = `https://stub.bossnyumba.local/veo/${hash}.mp4`;
      const createdAtIso = new Date(0).toISOString();
      return {
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        modality: 'video',
        assets: [
          {
            url,
            mimeType: 'video/mp4',
            widthPx: req.aspectRatio === '9:16' ? 1080 : 1920,
            heightPx: req.aspectRatio === '9:16' ? 1920 : 1080,
            durationSeconds: req.durationSeconds,
          },
        ],
        // Per research: Lite is <50% of Veo 3.1 Fast. Rough $0.30/sec assumption.
        costMicrousd: req.durationSeconds * 300_000,
        c2paManifest: buildC2paManifest({
          title: 'Veo generated video',
          format: 'video/mp4',
          providerId: PROVIDER_ID,
          modelId: MODEL_ID,
          prompt: req.prompt,
          tenantId: req.tenantId,
          seed: 0,
          loraIds: req.brand?.loraIds ?? [],
          createdAtIso,
        }),
        createdAtIso,
      };
    },
  };
}
