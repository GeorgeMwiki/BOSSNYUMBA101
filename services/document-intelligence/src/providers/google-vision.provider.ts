/**
 * Google Vision OCR provider — implements IOCRProvider.
 *
 * SCAFFOLDED. @google-cloud/vision wiring is stubbed with TODOs. The
 * provider returns a typed placeholder matching the interface so the rest
 * of the pipeline type-checks.
 */

import type { ExtractedField, OCRProvider } from '../types/index.js';
import type { IOCRProvider } from '../services/ocr-extraction.service.js';
import type { GoogleVisionConfig } from './types.js';
import { logger } from '../utils/logger.js';

export class GoogleVisionProvider implements IOCRProvider {
  readonly name: OCRProvider = 'google_vision';

  constructor(private readonly config: GoogleVisionConfig) {
    if (!config.projectId) {
      throw new Error('GoogleVisionProvider requires config.projectId');
    }
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: {
      language?: string;
      extractStructuredData?: boolean;
      documentType?: string;
    }
  ): Promise<{
    rawText: string;
    structuredData: Record<string, unknown> | null;
    fields: ExtractedField[];
    confidence: number;
    language: string;
    pageCount: number;
  }> {
    logger.info('GoogleVisionProvider.extractText (stubbed)', {
      bytes: buffer.byteLength,
      mimeType,
      projectId: this.config.projectId,
      documentType: options?.documentType,
      useDocumentDetection: this.config.useDocumentDetection ?? true,
    });

    // TODO: wire to @google-cloud/vision ImageAnnotatorClient
    //   const client = new ImageAnnotatorClient({
    //     projectId: this.config.projectId,
    //     keyFilename: this.config.keyFilename,
    //     credentials: this.config.credentials,
    //   });
    //   const feature = this.config.useDocumentDetection !== false
    //     ? 'DOCUMENT_TEXT_DETECTION'
    //     : 'TEXT_DETECTION';
    //   const [result] = await client.annotateImage({
    //     image: { content: buffer.toString('base64') },
    //     features: [{ type: feature }],
    //     imageContext: options?.language ? { languageHints: [options.language] } : undefined,
    //   });
    // Then walk result.fullTextAnnotation.pages → blocks → paragraphs →
    // words, grouping by page and mapping confidence + boundingBox into
    // ExtractedField[].

    return {
      rawText: '',
      structuredData: {
        provider: 'google_vision',
        stubbed: true,
        documentType: options?.documentType ?? null,
      },
      fields: [] as ExtractedField[],
      confidence: 0,
      language: options?.language ?? this.config.defaultLanguage ?? 'en',
      pageCount: 0,
    };
  }
}

export function createGoogleVisionProvider(
  config: GoogleVisionConfig
): GoogleVisionProvider {
  return new GoogleVisionProvider(config);
}
