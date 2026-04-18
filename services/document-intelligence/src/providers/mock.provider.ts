/**
 * Mock OCR provider for dev/test fallback.
 *
 * Returns fixture data from __fixtures__/ids so downstream code
 * (identity profile builder, badge issuance) can be exercised without a
 * real OCR vendor.
 */

import type { ExtractedField, OCRProvider } from '../types/index.js';
import type { IOCRProvider } from '../services/ocr-extraction.service.js';
import type { MockProviderConfig } from './types.js';
import { tanzaniaNidaFixture } from '../../__fixtures__/ids/tanzania-nida.fixture.js';
import { kenyaIdFixture } from '../../__fixtures__/ids/kenya-id.fixture.js';
import { drivingLicenceFixture } from '../../__fixtures__/ids/driving-licence.fixture.js';
import { utilityBillFixture } from '../../__fixtures__/ids/utility-bill.fixture.js';
import { bankStatementFixture } from '../../__fixtures__/ids/bank-statement.fixture.js';

const FIXTURES = {
  tanzania_nida: tanzaniaNidaFixture,
  kenya_id: kenyaIdFixture,
  driving_licence: drivingLicenceFixture,
  utility_bill: utilityBillFixture,
  bank_statement: bankStatementFixture,
} as const;

export class FixtureMockProvider implements IOCRProvider {
  readonly name: OCRProvider = 'mock';

  constructor(private readonly config: MockProviderConfig = { provider: 'mock' }) {}

  async extractText(
    _buffer: Buffer,
    _mimeType: string,
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
    const fixtureKey =
      this.config.fixtureKey ??
      inferFixtureKeyFromDocumentType(options?.documentType) ??
      'tanzania_nida';

    const fixture = FIXTURES[fixtureKey];

    return {
      rawText: fixture.rawText,
      structuredData: fixture.structuredData,
      fields: [...fixture.fields],
      confidence: fixture.averageConfidence,
      language: options?.language ?? this.config.defaultLanguage ?? 'en',
      pageCount: fixture.pageCount,
    };
  }
}

function inferFixtureKeyFromDocumentType(
  documentType: string | undefined
): keyof typeof FIXTURES | null {
  switch (documentType) {
    case 'national_id':
      return 'tanzania_nida';
    case 'drivers_license':
      return 'driving_licence';
    case 'utility_bill':
      return 'utility_bill';
    case 'bank_statement':
      return 'bank_statement';
    default:
      return null;
  }
}

export function createMockProvider(
  config?: MockProviderConfig
): FixtureMockProvider {
  return new FixtureMockProvider(config ?? { provider: 'mock' });
}
