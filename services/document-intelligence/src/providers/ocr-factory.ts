/**
 * OCR factory — returns an IOCRProvider implementation based on config.
 *
 * Also exposes env-based selection + a fallback wrapper so callers can keep
 * mock as a safety net in dev/test while raising in production.
 */

import type { IOCRProvider } from '../services/ocr-extraction.service.js';
import type {
  AwsTextractConfig,
  GoogleVisionConfig,
  MockProviderConfig,
  OcrProviderConfig,
} from './types.js';
import { createAwsTextractProvider } from './aws-textract.provider.js';
import { createGoogleVisionProvider } from './google-vision.provider.js';
import { createMockProvider } from './mock.provider.js';
import { logger } from '../utils/logger.js';
import type { ExtractedField, OCRProvider } from '../types/index.js';

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

export interface EnvProviderOptions {
  /** Override for process.env — useful for tests. */
  readonly env?: NodeJS.ProcessEnv;
  /** When true, fall back to mock provider on auth/network/sdk errors. */
  readonly fallbackToMock?: boolean;
}

/**
 * Build an OCR provider from environment variables.
 * Reads OCR_PROVIDER (textract | google | mock). Defaults to mock so dev/test
 * don't accidentally hit a paid API.
 */
export function getOcrProviderFromEnv(
  options: EnvProviderOptions = {}
): IOCRProvider {
  const env = options.env ?? process.env;
  const raw = (env.OCR_PROVIDER ?? 'mock').toLowerCase();

  let primaryConfig: OcrProviderConfig;
  switch (raw) {
    case 'textract':
    case 'aws_textract':
    case 'aws': {
      const textractConfig: AwsTextractConfig = {
        provider: 'aws_textract',
        region: env.AWS_REGION ?? 'us-east-1',
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        defaultLanguage: env.OCR_DEFAULT_LANGUAGE,
      };
      primaryConfig = textractConfig;
      break;
    }
    case 'google':
    case 'google_vision':
    case 'gcv': {
      const projectId = env.GOOGLE_PROJECT_ID ?? env.GCLOUD_PROJECT;
      if (!projectId) {
        throw new Error(
          'OCR_PROVIDER=google requires GOOGLE_PROJECT_ID or GCLOUD_PROJECT'
        );
      }
      const googleConfig: GoogleVisionConfig = {
        provider: 'google_vision',
        projectId,
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
        defaultLanguage: env.OCR_DEFAULT_LANGUAGE,
      };
      primaryConfig = googleConfig;
      break;
    }
    case 'mock':
    default: {
      const mockConfig: MockProviderConfig = {
        provider: 'mock',
        defaultLanguage: env.OCR_DEFAULT_LANGUAGE,
      };
      primaryConfig = mockConfig;
      break;
    }
  }

  const primary = getOcrProvider(primaryConfig);
  const fallbackToMock =
    options.fallbackToMock ??
    (env.OCR_FALLBACK_TO_MOCK === 'true' || env.NODE_ENV !== 'production');

  if (primary.name === 'mock' || !fallbackToMock) {
    return primary;
  }

  const fallback = createMockProvider({ provider: 'mock' });
  return new FallbackOcrProvider(primary, fallback);
}

/**
 * Provider wrapper — runs the primary, falls back to secondary on auth /
 * network / SDK-missing errors. In production, fallbackToMock should be false
 * so errors surface rather than being masked by fixture data.
 */
export class FallbackOcrProvider implements IOCRProvider {
  readonly name: OCRProvider;

  constructor(
    private readonly primary: IOCRProvider,
    private readonly secondary: IOCRProvider
  ) {
    this.name = primary.name;
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
    try {
      return await this.primary.extractText(buffer, mimeType, options);
    } catch (err) {
      if (!isRecoverable(err)) throw err;
      logger.warn('OCR primary provider failed, falling back', {
        primary: this.primary.name,
        secondary: this.secondary.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.secondary.extractText(buffer, mimeType, options);
    }
  }
}

function isRecoverable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (typeof code !== 'string') return false;
  return [
    'TEXTRACT_AUTH',
    'TEXTRACT_NETWORK',
    'TEXTRACT_SDK_MISSING',
    'VISION_AUTH',
    'VISION_NETWORK',
    'VISION_SDK_MISSING',
  ].includes(code);
}
