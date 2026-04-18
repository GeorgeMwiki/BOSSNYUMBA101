/**
 * React PDF Renderer (STUB)
 *
 * TODO: install `@react-pdf/renderer` and wire up.
 *   npm i @react-pdf/renderer
 *
 * When implemented, this should:
 *  1. Accept `template.source` as a React component (`PdfComponent`)
 *  2. Render via `renderToBuffer(<PdfComponent {...inputs} />)`
 *  3. Return PDF buffer with mime `application/pdf`
 *
 * Node (ESM) must have JSX transform for this to work at runtime.
 */

import type {
  IDocumentRenderer,
  RenderResult,
  RenderTemplate,
  RenderedMimeType,
} from './renderer-interface.js';
import { RendererError } from './renderer-interface.js';

export class ReactPdfRenderer implements IDocumentRenderer {
  readonly kind = 'react-pdf' as const;
  readonly supportedMimeTypes: readonly RenderedMimeType[] = ['application/pdf'];

  async render<TInput = Record<string, unknown>>(
    _template: RenderTemplate<TInput>,
    _inputs: TInput
  ): Promise<RenderResult> {
    // TODO: Implement once @react-pdf/renderer is installed.
    throw new RendererError(
      'NOT_IMPLEMENTED',
      'ReactPdfRenderer is a stub; install @react-pdf/renderer and implement render().'
    );
  }
}
