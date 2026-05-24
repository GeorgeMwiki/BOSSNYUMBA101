/**
 * Runway Gen-4 / Gen-4 Turbo.
 *
 * Fast-turnaround social cuts; agency-style editing. Used as the Veo
 * quota-exhausted fallback for `fast_social_cut` reels.
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§2.3)
 *   - Runway: https://runwayml.com/research/introducing-runway-gen-4
 *
 * Env vars (for real wiring; unused in this stub):
 *   - RUNWAY_API_KEY  — Runway API access
 */

import { buildC2paManifest } from '../../c2pa/attestation.js';
import { deterministicHash } from '../shared.js';
import type {
  ContentResult,
  VideoProvider,
  VideoRequest,
  VideoTask,
} from '../../types.js';

const SUPPORTED: ReadonlyArray<VideoTask> = ['fast_social_cut', 'i2v_walkthrough'];
const PROVIDER_ID = 'runway';
const MODEL_ID = 'runway-gen-4-turbo';

export function createRunwayProvider(): VideoProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    async generate(req: VideoRequest): Promise<ContentResult> {
      const hash = deterministicHash(
        `${PROVIDER_ID}|${req.prompt}|${req.durationSeconds}|${req.aspectRatio}`,
      );
      const url = `https://stub.bossnyumba.local/runway/${hash}.mp4`;
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
        costMicrousd: req.durationSeconds * 100_000, // ~$0.50–$1.00 per 10 s
        c2paManifest: buildC2paManifest({
          title: 'Runway generated video',
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
