/**
 * Recraft V3 — only mainstream tool that produces native SVG vectors.
 *
 * Used for per-tenant logos / wordmarks / icon sets / vector PDF covers.
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§1.3)
 *   - Recraft: https://www.recraft.ai/
 *   - fal.ai: https://fal.ai/models/fal-ai/recraft/v3/text-to-image
 *
 * Env vars (for real wiring; unused in this stub):
 *   - RECRAFT_API_KEY  — direct Recraft API
 *   - FAL_KEY          — fal.ai relay (preferred for low latency)
 */

import { buildC2paManifest } from '../../c2pa/attestation.js';
import { deterministicHash } from '../shared.js';
import type {
  ContentResult,
  ImageProvider,
  ImageRequest,
  ImageTask,
} from '../../types.js';

const SUPPORTED: ReadonlyArray<ImageTask> = ['vector_brand'];
const PROVIDER_ID = 'recraft';
const MODEL_ID = 'recraft-v3';

export function createRecraftProvider(): ImageProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    async generate(req: ImageRequest): Promise<ContentResult> {
      const styleId = req.brand?.recraftStyleId ?? 'no-style';
      const hash = deterministicHash(`${PROVIDER_ID}|${req.prompt}|${styleId}`);
      const url = `https://stub.bossnyumba.local/recraft/${hash}.svg`;
      const createdAtIso = new Date(0).toISOString();
      return {
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        modality: 'image',
        assets: [
          {
            url,
            mimeType: 'image/svg+xml',
            widthPx: 1024,
            heightPx: 1024,
          },
        ],
        costMicrousd: 40_000,
        c2paManifest: buildC2paManifest({
          title: 'Recraft vector asset',
          format: 'image/svg+xml',
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
