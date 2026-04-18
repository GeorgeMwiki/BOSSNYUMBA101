/**
 * Nano Banana Imagery Renderer (STUB)
 *
 * IMPORTANT — SCOPE GUARDRAIL:
 *   Per Docs/analysis/RESEARCH_ANSWERS.md Q8, Nano Banana is reserved for
 *   MARKETING IMAGERY ONLY (announcement covers, promo visuals).
 *   It MUST NOT be used to generate legal, financial, or tenant-facing
 *   documents — use docxtemplater/Typst/react-pdf for those.
 *
 * This renderer deliberately emits `image/png` / `image/jpeg` ONLY and
 * does not register for any document mime type.
 *
 * TODO: wire up Nano Banana HTTP client + credentials (env var
 *   `NANO_BANANA_API_KEY`). Output should be a PNG buffer.
 */

import type {
  IDocumentRenderer,
  RenderResult,
  RenderTemplate,
  RenderedMimeType,
} from './renderer-interface.js';
import { RendererError } from './renderer-interface.js';

export interface NanoBananaImageryTemplateInput {
  readonly prompt: string;
  readonly style?: 'photo' | 'illustration' | 'poster' | 'flyer';
  readonly width?: number;
  readonly height?: number;
  readonly brandPalette?: readonly string[];
}

export class NanoBananaImageryRenderer implements IDocumentRenderer {
  readonly kind = 'nano-banana' as const;
  readonly supportedMimeTypes: readonly RenderedMimeType[] = ['image/png', 'image/jpeg'];
  /** Hard flag enforced at the factory layer so it's never selected for docs. */
  readonly isImageryOnly = true;

  async render<TInput = Record<string, unknown>>(
    _template: RenderTemplate<TInput>,
    _inputs: TInput
  ): Promise<RenderResult> {
    // TODO: call Nano Banana image-gen API; return a PNG buffer.
    throw new RendererError(
      'NOT_IMPLEMENTED',
      'NanoBananaImageryRenderer is a stub; wire HTTP client + NANO_BANANA_API_KEY.'
    );
  }
}
