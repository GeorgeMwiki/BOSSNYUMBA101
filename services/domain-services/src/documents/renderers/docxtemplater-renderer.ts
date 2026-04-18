/**
 * DOCX Templater Renderer (STUB)
 *
 * TODO: install `docxtemplater` + `pizzip` and implement.
 *   npm i docxtemplater pizzip
 *
 * Reference: https://docxtemplater.com/
 *
 * When implemented, this should:
 *  1. Load the .docx template buffer from `template.source` (Buffer)
 *  2. Unzip via PizZip
 *  3. Create Docxtemplater instance, setData(inputs), render()
 *  4. Return zipped buffer with mime type
 *     application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */

import type {
  IDocumentRenderer,
  RenderResult,
  RenderTemplate,
  RenderedMimeType,
} from './renderer-interface.js';
import { RendererError } from './renderer-interface.js';

export class DocxtemplaterRenderer implements IDocumentRenderer {
  readonly kind = 'docxtemplater' as const;
  readonly supportedMimeTypes: readonly RenderedMimeType[] = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  async render<TInput = Record<string, unknown>>(
    _template: RenderTemplate<TInput>,
    _inputs: TInput
  ): Promise<RenderResult> {
    // TODO: Implement once docxtemplater + pizzip are installed.
    throw new RendererError(
      'NOT_IMPLEMENTED',
      'DocxtemplaterRenderer is a stub; install docxtemplater + pizzip and implement render().'
    );
  }
}
