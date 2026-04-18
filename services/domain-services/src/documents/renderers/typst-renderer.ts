/**
 * Typst Renderer (STUB)
 *
 * TODO: install the Typst binary and a node wrapper (`@myriaddreamin/typst-ts-node-compiler`)
 * or shell out to the `typst` CLI.
 *
 * When implemented, this should:
 *  1. Treat `template.source` as a `.typ` source string with placeholders
 *  2. Materialize inputs into a data file (YAML / JSON)
 *  3. Invoke Typst compiler to produce a PDF buffer
 *  4. Return with mime `application/pdf`
 */

import type {
  IDocumentRenderer,
  RenderResult,
  RenderTemplate,
  RenderedMimeType,
} from './renderer-interface.js';
import { RendererError } from './renderer-interface.js';

export class TypstRenderer implements IDocumentRenderer {
  readonly kind = 'typst' as const;
  readonly supportedMimeTypes: readonly RenderedMimeType[] = ['application/pdf'];

  async render<TInput = Record<string, unknown>>(
    _template: RenderTemplate<TInput>,
    _inputs: TInput
  ): Promise<RenderResult> {
    // TODO: Implement once Typst binary/bindings are available.
    throw new RendererError(
      'NOT_IMPLEMENTED',
      'TypstRenderer is a stub; install typst binary/bindings and implement render().'
    );
  }
}
