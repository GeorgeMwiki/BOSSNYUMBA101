/**
 * Production OCR Provider Implementations
 *
 * Provides concrete adapters for:
 *   - AWS Textract  (primary, structured document analysis)
 *   - Google Cloud Vision (secondary, strong general text + entity extraction)
 *   - Tesseract  (on-prem fallback, via child-process or node-tesseract binding)
 *
 * Also exposes a CompositeOCRProvider that tries providers in order and
 * fails over on low confidence or upstream errors — this is the provider
 * the application should wire in production so we always have a fallback
 * and degrade gracefully if a cloud provider is unavailable.
 *
 * Provider packages are imported lazily so that deployments which only
 * need one vendor don't need to install the others.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExtractedField, OCRProvider } from '../types/index.js';
import { logger } from '../utils/logger.js';
import type { IOCRProvider } from './ocr-extraction.service.js';

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------

export interface OCRInvocationOptions {
  language?: string;
  extractStructuredData?: boolean;
  documentType?: string;
}

export interface OCRInvocationResult {
  rawText: string;
  structuredData: Record<string, unknown> | null;
  fields: ExtractedField[];
  confidence: number;
  language: string;
  pageCount: number;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Normalize the confidence value returned by vendor APIs (typically 0-100)
 * into the domain's 0-1 scale.
 */
function normalizeConfidence(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  if (value <= 1) return Math.max(0, Math.min(1, value));
  return Math.max(0, Math.min(1, value / 100));
}

function toValidationStatus(confidence: number): ExtractedField['validationStatus'] {
  if (confidence >= 0.85) return 'valid';
  if (confidence >= 0.6) return 'uncertain';
  return 'invalid';
}

/**
 * Known identity document fields we try to extract structurally when the
 * caller hints at a documentType. Any extra fields returned by the vendor
 * pass through unchanged.
 */
const IDENTITY_FIELD_NAMES = new Set([
  'full_name',
  'given_names',
  'surname',
  'id_number',
  'passport_number',
  'document_number',
  'date_of_birth',
  'date_of_issue',
  'date_of_expiry',
  'nationality',
  'gender',
  'address',
  'address_line1',
  'address_line2',
  'city',
  'region',
  'postal_code',
  'country',
  'issuing_authority',
  'mrz',
]);

/**
 * Try a light-weight regex extraction over the raw text for common
 * identity fields. This ensures downstream validation has something to
 * work with even when the vendor doesn't emit structured KV pairs.
 */
function extractIdentityFieldsFromText(rawText: string): ExtractedField[] {
  const out: ExtractedField[] = [];
  const tryMatch = (fieldName: string, regex: RegExp, confidence = 0.75): void => {
    const m = rawText.match(regex);
    if (m && m[1]) {
      out.push({
        fieldName,
        value: m[1].trim(),
        confidence,
        boundingBox: null,
        normalized: false,
        validationStatus: toValidationStatus(confidence),
      });
    }
  };

  tryMatch('id_number', /\b(?:ID|IDNO|ID\s*Number)[:\s]*([A-Z0-9]{6,20})/i);
  tryMatch('passport_number', /\bPassport\s*(?:No\.?|Number)?[:\s]*([A-Z0-9]{6,12})/i);
  tryMatch('date_of_birth', /\bDOB[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i);
  tryMatch('date_of_expiry', /\bExpiry[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i);
  tryMatch('nationality', /\bNationality[:\s]*([A-Za-z]{3,})/i, 0.7);
  tryMatch('mrz', /\b([A-Z0-9<]{30,88})\b/);

  return out;
}

// ----------------------------------------------------------------------------
// AWS Textract
// ----------------------------------------------------------------------------

export interface TextractOCRProviderOptions {
  region?: string;
  /** Optional pre-constructed Textract client; useful for tests and shared AWS configs. */
  client?: unknown;
  /** Minimum confidence (0-1) a field must meet to be kept. */
  minFieldConfidence?: number;
}

/**
 * AWS Textract provider. Uses AnalyzeID for identity documents and
 * AnalyzeDocument (FORMS + TABLES) for general documents.
 */
export class TextractOCRProvider implements IOCRProvider {
  public readonly name: OCRProvider = 'aws_textract';
  private readonly minFieldConfidence: number;
  private clientPromise: Promise<unknown> | null = null;

  constructor(private readonly options: TextractOCRProviderOptions = {}) {
    this.minFieldConfidence = options.minFieldConfidence ?? 0.5;
  }

  private async getClient(): Promise<any> {
    if (this.options.client) return this.options.client as any;
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        // Lazy import so the dependency is optional at runtime.
        const mod = await import('@aws-sdk/client-textract');
        const region = this.options.region ?? process.env.AWS_REGION ?? 'us-east-1';
        return new (mod as any).TextractClient({ region });
      })();
    }
    return this.clientPromise;
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: OCRInvocationOptions,
  ): Promise<OCRInvocationResult> {
    const client = await this.getClient();
    const mod = await import('@aws-sdk/client-textract');
    const isIdentity =
      options?.documentType === 'national_id' ||
      options?.documentType === 'passport' ||
      options?.documentType === 'drivers_license';

    if (isIdentity) {
      const cmd = new (mod as any).AnalyzeIDCommand({
        DocumentPages: [{ Bytes: buffer }],
      });
      const resp: any = await client.send(cmd);
      const doc = resp?.IdentityDocuments?.[0];
      const rawBlocks = resp?.DocumentMetadata ?? {};
      const rawText = (doc?.IdentityDocumentFields ?? [])
        .map((f: any) => `${f?.Type?.Text ?? ''}: ${f?.ValueDetection?.Text ?? ''}`)
        .join('\n');

      const fields: ExtractedField[] = (doc?.IdentityDocumentFields ?? [])
        .map((f: any) => {
          const fieldName = String(f?.Type?.Text ?? '').toLowerCase().replace(/\s+/g, '_');
          const value = f?.ValueDetection?.Text ?? null;
          const confidence = normalizeConfidence(f?.ValueDetection?.Confidence);
          return {
            fieldName,
            value,
            confidence,
            boundingBox: null,
            normalized: false,
            validationStatus: toValidationStatus(confidence),
          } satisfies ExtractedField;
        })
        .filter((f: ExtractedField) => f.confidence >= this.minFieldConfidence);

      return {
        rawText,
        structuredData: {
          documentType: options?.documentType ?? 'identity',
          vendorMetadata: rawBlocks,
        },
        fields,
        confidence:
          fields.length === 0 ? 0 : fields.reduce((s, f) => s + f.confidence, 0) / fields.length,
        language: options?.language ?? 'en',
        pageCount: 1,
      };
    }

    const cmd = new (mod as any).AnalyzeDocumentCommand({
      Document: { Bytes: buffer },
      FeatureTypes: ['FORMS', 'TABLES'],
    });
    const resp: any = await client.send(cmd);
    const blocks: any[] = resp?.Blocks ?? [];

    const lineBlocks = blocks.filter((b) => b.BlockType === 'LINE');
    const rawText = lineBlocks.map((b) => b.Text ?? '').join('\n');
    const pageCount = resp?.DocumentMetadata?.Pages ?? 1;

    // Build KV pairs from KEY_VALUE_SET blocks.
    const blockMap = new Map<string, any>(blocks.map((b) => [b.Id, b]));
    const getChildText = (block: any): string => {
      const childIds: string[] = (block?.Relationships ?? [])
        .filter((r: any) => r.Type === 'CHILD')
        .flatMap((r: any) => r.Ids);
      return childIds
        .map((id) => blockMap.get(id))
        .filter(Boolean)
        .map((b) => b.Text ?? '')
        .join(' ')
        .trim();
    };

    const fields: ExtractedField[] = [];
    for (const b of blocks) {
      if (b.BlockType !== 'KEY_VALUE_SET') continue;
      if (!b.EntityTypes?.includes('KEY')) continue;
      const valRel = (b.Relationships ?? []).find((r: any) => r.Type === 'VALUE');
      const valBlock = valRel?.Ids?.map((id: string) => blockMap.get(id))?.find(Boolean);
      const key = getChildText(b);
      const value = valBlock ? getChildText(valBlock) : '';
      if (!key) continue;
      const confidence = normalizeConfidence(b.Confidence);
      if (confidence < this.minFieldConfidence) continue;
      fields.push({
        fieldName: key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        value: value || null,
        confidence,
        boundingBox: b.Geometry?.BoundingBox
          ? {
              left: b.Geometry.BoundingBox.Left,
              top: b.Geometry.BoundingBox.Top,
              width: b.Geometry.BoundingBox.Width,
              height: b.Geometry.BoundingBox.Height,
            }
          : null,
        normalized: false,
        validationStatus: toValidationStatus(confidence),
      });
    }

    // Augment with regex-based identity fallbacks if the document looked identity-like.
    if (options?.documentType) {
      for (const extra of extractIdentityFieldsFromText(rawText)) {
        if (!fields.some((f) => f.fieldName === extra.fieldName)) fields.push(extra);
      }
    }

    const avgConfidence =
      lineBlocks.length === 0
        ? 0
        : lineBlocks.reduce((s, b) => s + normalizeConfidence(b.Confidence), 0) /
          lineBlocks.length;

    return {
      rawText,
      structuredData: {
        documentType: options?.documentType ?? 'generic',
        mimeType,
      },
      fields,
      confidence: avgConfidence,
      language: options?.language ?? 'en',
      pageCount,
    };
  }
}

// ----------------------------------------------------------------------------
// Google Cloud Vision
// ----------------------------------------------------------------------------

export interface GoogleVisionOCRProviderOptions {
  /** Optional pre-constructed ImageAnnotatorClient. */
  client?: unknown;
  /** Minimum confidence (0-1) a field must meet to be kept. */
  minFieldConfidence?: number;
}

export class GoogleVisionOCRProvider implements IOCRProvider {
  public readonly name: OCRProvider = 'google_vision';
  private readonly minFieldConfidence: number;
  private clientPromise: Promise<unknown> | null = null;

  constructor(private readonly options: GoogleVisionOCRProviderOptions = {}) {
    this.minFieldConfidence = options.minFieldConfidence ?? 0.5;
  }

  private async getClient(): Promise<any> {
    if (this.options.client) return this.options.client as any;
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await import('@google-cloud/vision');
        return new (mod as any).ImageAnnotatorClient();
      })();
    }
    return this.clientPromise;
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: OCRInvocationOptions,
  ): Promise<OCRInvocationResult> {
    const client = await this.getClient();

    const [result] = await client.documentTextDetection({
      image: { content: buffer },
      imageContext: options?.language ? { languageHints: [options.language] } : undefined,
    });

    const fullTextAnnotation = result?.fullTextAnnotation;
    const rawText: string = fullTextAnnotation?.text ?? '';
    const pages = fullTextAnnotation?.pages ?? [];

    const fields: ExtractedField[] = [];
    for (const page of pages) {
      for (const block of page.blocks ?? []) {
        const confidence = normalizeConfidence(block.confidence);
        if (confidence < this.minFieldConfidence) continue;
        const text = (block.paragraphs ?? [])
          .map((p: any) =>
            (p.words ?? [])
              .map((w: any) => (w.symbols ?? []).map((s: any) => s.text).join(''))
              .join(' '),
          )
          .join('\n')
          .trim();
        if (!text) continue;
        fields.push({
          fieldName: 'text_block',
          value: text,
          confidence,
          boundingBox: block.boundingBox?.vertices?.length
            ? {
                left: block.boundingBox.vertices[0].x ?? 0,
                top: block.boundingBox.vertices[0].y ?? 0,
                width:
                  (block.boundingBox.vertices[1]?.x ?? 0) -
                  (block.boundingBox.vertices[0]?.x ?? 0),
                height:
                  (block.boundingBox.vertices[2]?.y ?? 0) -
                  (block.boundingBox.vertices[0]?.y ?? 0),
              }
            : null,
          normalized: false,
          validationStatus: toValidationStatus(confidence),
        });
      }
    }

    for (const extra of extractIdentityFieldsFromText(rawText)) {
      if (!fields.some((f) => f.fieldName === extra.fieldName && f.value === extra.value)) {
        fields.push(extra);
      }
    }

    const avgConfidence =
      fields.length === 0 ? 0 : fields.reduce((s, f) => s + f.confidence, 0) / fields.length;

    return {
      rawText,
      structuredData: {
        documentType: options?.documentType ?? 'generic',
        mimeType,
      },
      fields: fields.filter((f) => IDENTITY_FIELD_NAMES.has(f.fieldName) || f.fieldName === 'text_block'),
      confidence: avgConfidence,
      language:
        (pages[0]?.property?.detectedLanguages?.[0]?.languageCode as string | undefined) ??
        options?.language ??
        'en',
      pageCount: pages.length || 1,
    };
  }
}

// ----------------------------------------------------------------------------
// Tesseract (on-prem fallback)
// ----------------------------------------------------------------------------

export interface TesseractOCRProviderOptions {
  /** Path to the `tesseract` binary. Defaults to `tesseract` on PATH. */
  binary?: string;
  /** Default tessdata languages, e.g. 'eng', 'eng+swa'. */
  languages?: string;
  /** Minimum confidence (0-1) a field must meet to be kept. */
  minFieldConfidence?: number;
}

/**
 * Tesseract OCR provider that shells out to the `tesseract` CLI. It is
 * deliberately dependency-free: the binary is the only requirement and is
 * broadly available in Linux base images used by our deployment targets.
 */
export class TesseractOCRProvider implements IOCRProvider {
  public readonly name: OCRProvider = 'tesseract';
  private readonly binary: string;
  private readonly languages: string;
  private readonly minFieldConfidence: number;

  constructor(options: TesseractOCRProviderOptions = {}) {
    this.binary = options.binary ?? process.env.TESSERACT_BIN ?? 'tesseract';
    this.languages = options.languages ?? process.env.TESSERACT_LANGS ?? 'eng+swa';
    this.minFieldConfidence = options.minFieldConfidence ?? 0.4;
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: OCRInvocationOptions,
  ): Promise<OCRInvocationResult> {
    const dir = await mkdtemp(join(tmpdir(), 'bossnyumba-ocr-'));
    const ext = mimeType.includes('png')
      ? '.png'
      : mimeType.includes('pdf')
      ? '.pdf'
      : mimeType.includes('tiff')
      ? '.tiff'
      : '.jpg';
    const inputPath = join(dir, `input${ext}`);
    const outputBase = join(dir, 'output');

    try {
      await writeFile(inputPath, buffer);

      const args = [
        inputPath,
        outputBase,
        '-l',
        options?.language ? this.mapLanguage(options.language) : this.languages,
        '--psm',
        '6',
        'tsv',
      ];

      await this.run(args);

      const tsvContent = await readFile(`${outputBase}.tsv`, 'utf8');
      const { rawText, fields, confidence } = this.parseTsv(tsvContent);

      const enriched = [...fields];
      for (const extra of extractIdentityFieldsFromText(rawText)) {
        if (!enriched.some((f) => f.fieldName === extra.fieldName)) enriched.push(extra);
      }

      return {
        rawText,
        structuredData: {
          documentType: options?.documentType ?? 'generic',
          mimeType,
          engine: 'tesseract',
        },
        fields: enriched.filter((f) => f.confidence >= this.minFieldConfidence),
        confidence,
        language: options?.language ?? this.languages.split('+')[0] ?? 'en',
        pageCount: 1,
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private mapLanguage(lang: string): string {
    // Map ISO short codes to tesseract traineddata codes
    const map: Record<string, string> = { en: 'eng', sw: 'swa', fr: 'fra', es: 'spa' };
    return map[lang] ?? lang;
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tesseract exited with code ${code}: ${stderr}`));
      });
    });
  }

  private parseTsv(tsv: string): { rawText: string; fields: ExtractedField[]; confidence: number } {
    const lines = tsv.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1 || !lines[0]) return { rawText: '', fields: [], confidence: 0 };
    const header = lines[0].split('\t');
    const idx = (name: string) => header.indexOf(name);
    const iText = idx('text');
    const iConf = idx('conf');
    const iLeft = idx('left');
    const iTop = idx('top');
    const iWidth = idx('width');
    const iHeight = idx('height');

    const words: ExtractedField[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split('\t');
      const text = cols[iText]?.trim();
      const conf = Number.parseInt(cols[iConf] ?? '-1', 10);
      if (!text || Number.isNaN(conf) || conf < 0) continue;
      words.push({
        fieldName: 'text_word',
        value: text,
        confidence: normalizeConfidence(conf),
        boundingBox: {
          left: Number.parseInt(cols[iLeft] ?? '0', 10),
          top: Number.parseInt(cols[iTop] ?? '0', 10),
          width: Number.parseInt(cols[iWidth] ?? '0', 10),
          height: Number.parseInt(cols[iHeight] ?? '0', 10),
        },
        normalized: false,
        validationStatus: toValidationStatus(normalizeConfidence(conf)),
      });
    }

    const rawText = words.map((w) => w.value).filter(Boolean).join(' ');
    const confidence =
      words.length === 0 ? 0 : words.reduce((s, w) => s + w.confidence, 0) / words.length;

    return { rawText, fields: words, confidence };
  }
}

// ----------------------------------------------------------------------------
// Composite provider (primary + fallback chain)
// ----------------------------------------------------------------------------

export interface CompositeOCRProviderOptions {
  /**
   * Minimum acceptable confidence. Results below this will trigger a
   * fallback to the next provider in the chain.
   */
  minConfidence?: number;
  /**
   * If `true` and all providers fail or return low confidence, the best
   * result seen is returned rather than throwing. Default `true`.
   */
  returnBestEffort?: boolean;
}

/**
 * Runs OCR providers in order and returns the first result meeting the
 * configured confidence threshold. If none meet the threshold, the best
 * result by confidence is returned (when `returnBestEffort` is true) or
 * an error is thrown. Low-confidence results should be routed to
 * human-in-the-loop review by the caller.
 */
export class CompositeOCRProvider implements IOCRProvider {
  public readonly name: OCRProvider = 'composite';
  private readonly minConfidence: number;
  private readonly returnBestEffort: boolean;

  constructor(
    private readonly providers: readonly IOCRProvider[],
    options: CompositeOCRProviderOptions = {},
  ) {
    if (providers.length === 0) {
      throw new Error('CompositeOCRProvider requires at least one provider');
    }
    this.minConfidence = options.minConfidence ?? 0.75;
    this.returnBestEffort = options.returnBestEffort ?? true;
  }

  async extractText(
    buffer: Buffer,
    mimeType: string,
    options?: OCRInvocationOptions,
  ): Promise<OCRInvocationResult> {
    let best: OCRInvocationResult | null = null;
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.extractText(buffer, mimeType, options);
        if (result.confidence >= this.minConfidence) {
          return result;
        }
        if (!best || result.confidence > best.confidence) best = result;
        logger.warn('OCR provider returned low confidence result, trying next', {
          provider: provider.name,
          confidence: result.confidence,
          threshold: this.minConfidence,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ provider: provider.name, error: message });
        logger.warn('OCR provider failed, trying next', {
          provider: provider.name,
          error: message,
        });
      }
    }

    if (best && this.returnBestEffort) {
      logger.warn?.('All OCR providers returned low confidence; returning best-effort result', {
        bestConfidence: best.confidence,
        threshold: this.minConfidence,
      });
      return best;
    }

    throw new Error(
      `All OCR providers failed: ${errors.map((e) => `${e.provider}=${e.error}`).join('; ')}`,
    );
  }
}
