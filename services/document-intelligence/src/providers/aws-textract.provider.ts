/**
 * AWS Textract OCR provider — implements IOCRProvider.
 *
 * SCAFFOLDED. The actual @aws-sdk/client-textract calls are stubbed with
 * TODOs so the package builds without the SDK. See the TODO markers for
 * the exact wiring each call needs when the SDK is added to the service
 * service/package.json.
 */

import type { ExtractedField, OCRProvider } from '../types/index.js';
import type { IOCRProvider } from '../services/ocr-extraction.service.js';
import type { AwsTextractConfig } from './types.js';
import { logger } from '../utils/logger.js';

export interface TextractExtractOptions {
  readonly language?: string;
  readonly extractStructuredData?: boolean;
  readonly documentType?: string;
}

export interface TextractExtractResult {
  rawText: string;
  structuredData: Record<string, unknown> | null;
  fields: ExtractedField[];
  confidence: number;
  language: string;
  pageCount: number;
}

export class AwsTextractProvider implements IOCRProvider {
  readonly name: OCRProvider = 'aws_textract';

  constructor(private readonly config: AwsTextractConfig) {
    if (!config.region) {
      throw new Error('AwsTextractProvider requires config.region');
    }
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: TextractExtractOptions
  ): Promise<TextractExtractResult> {
    logger.info('AwsTextractProvider.extractText (stubbed)', {
      bytes: buffer.byteLength,
      mimeType,
      region: this.config.region,
      documentType: options?.documentType,
    });

    // TODO: wire to @aws-sdk/client-textract AnalyzeDocument
    //   const client = new TextractClient({ region: this.config.region,
    //     credentials: this.config.accessKeyId ? {
    //       accessKeyId: this.config.accessKeyId,
    //       secretAccessKey: this.config.secretAccessKey!,
    //     } : undefined });
    //   const cmd = new AnalyzeDocumentCommand({
    //     Document: { Bytes: buffer },
    //     FeatureTypes: this.config.featureTypes ?? ['FORMS'],
    //   });
    //   const response = await client.send(cmd);
    // Then walk response.Blocks to produce ExtractedField[] with
    // KEY_VALUE_SET → LINE resolution and Geometry.BoundingBox mapping.

    // Typed placeholder result matching the interface shape.
    return {
      rawText: '',
      structuredData: {
        provider: 'aws_textract',
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

export function createAwsTextractProvider(
  config: AwsTextractConfig
): AwsTextractProvider {
  return new AwsTextractProvider(config);
}
