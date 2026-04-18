/**
 * OCR factory — returns an IOCRProvider implementation based on config.
 *
 * Used by the OCRExtractionService constructor callers so the service
 * itself stays provider-agnostic.
 */

import type { IOCRProvider } from '../services/ocr-extraction.service.js';
import type { OcrProviderConfig } from './types.js';
import { createAwsTextractProvider } from './aws-textract.provider.js';
import { createGoogleVisionProvider } from './google-vision.provider.js';
import { createMockProvider } from './mock.provider.js';

export function getOcrProvider(config: OcrProviderConfig): IOCRProvider {
  switch (config.provider) {
    case 'aws_textract':
      return createAwsTextractProvider(config);
    case 'google_vision':
      return createGoogleVisionProvider(config);
    case 'mock':
      return createMockProvider(config);
    default: {
      const exhaustive: never = config;
      throw new Error(
        `Unknown OCR provider: ${(exhaustive as { provider: string }).provider}`
      );
    }
  }
}
