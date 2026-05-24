/**
 * Flux 1.2 Pro Ultra — Black Forest Labs (BFL).
 *
 * Photoreal property hero shots. ~1 s at 4 MP in Ultra mode.
 *
 * Reference:
 *   - Research: .audit/litfin-sota-2026-05-23/14-multimodal-generative.md (§1.1)
 *   - BFL docs: https://bfl.ai/models/flux-pro-ultra
 *   - Replicate: https://replicate.com/black-forest-labs/flux-1.1-pro
 *
 * Env vars (for real wiring; unused in this stub):
 *   - BFL_API_KEY     — primary BFL hosted endpoint
 *   - REPLICATE_TOKEN — fallback path via Replicate
 *
 * Stub behaviour: deterministic placeholder URL derived from prompt hash so
 * tests can assert routing without network calls.
 */

import { buildC2paManifest } from '../../c2pa/attestation.js';
import { deterministicHash } from '../shared.js';
import type {
  ContentResult,
  ImageProvider,
  ImageRequest,
  ImageTask,
} from '../../types.js';

const SUPPORTED: ReadonlyArray<ImageTask> = ['hero_photoreal'];
const PROVIDER_ID = 'flux';
const MODEL_ID = 'flux-1.2-pro-ultra';

export function createFluxProvider(): ImageProvider {
  return {
    providerId: PROVIDER_ID,
    supportedTasks: SUPPORTED,

    async generate(req: ImageRequest): Promise<ContentResult> {
      const seed = req.seed ?? 0;
      const hash = deterministicHash(`${PROVIDER_ID}|${req.prompt}|${seed}`);
      const url = `https://stub.bossnyumba.local/flux/${hash}.png`;
      const createdAtIso = new Date(0).toISOString();
      return {
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        modality: 'image',
        assets: [
          {
            url,
            mimeType: 'image/png',
            widthPx: 2048,
            heightPx: 2048,
          },
        ],
        costMicrousd: 60_000, // ~$0.06/img reference price
        c2paManifest: buildC2paManifest({
          title: 'Flux generated image',
          format: 'image/png',
          providerId: PROVIDER_ID,
          modelId: MODEL_ID,
          prompt: req.prompt,
          tenantId: req.tenantId,
          seed,
          loraIds: req.brand?.loraIds ?? [],
          createdAtIso,
        }),
        createdAtIso,
      };
    },
  };
}
