/**
 * Format-aware parser dispatcher with real-estate-tailored hints
 * (lease, condition report, rent roll, title deed, utility bill).
 * Ported from Borjie parser.ts.
 */
import { parseCsv, parseExcel } from '@bossnyumba/file-ingest/schema-sniff';
import type { IncomingDoc, ParsedDoc, ExtractedFact } from './types.js';

function detectLanguage(text: string): 'en' | 'sw' | 'unknown' {
  if (!text) return 'unknown';
  const lower = text.toLowerCase();
  const swMarkers = [
    /\bna\b/g, /\bya\b/g, /\bwa\b/g, /\bni\b/g, /\bkwa\b/g,
    /\bnyumba\b/g, /\bpango\b/g, /\bkodi\b/g, /\bmpangaji\b/g, /\bmwenye\b/g,
  ];
  let swHits = 0;
  for (const re of swMarkers) {
    const m = lower.match(re);
    if (m) swHits += m.length;
  }
  const ratio = swHits / Math.max(1, lower.length / 200);
  if (ratio > 1) return 'sw';
  return /[a-z]/.test(lower) ? 'en' : 'unknown';
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function tableToText(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
  const lines: string[] = [];
  lines.push(headers.join(' | '));
  lines.push(headers.map(() => '---').join(' | '));
  for (const row of rows) lines.push(row.join(' | '));
  return lines.join('\n');
}

function detectRealEstateTableKind(headers: ReadonlyArray<string>): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  const has = (...needles: string[]) =>
    needles.every((n) => lower.some((h) => h.includes(n)));
  if (has('unit') && (has('tenant') || has('mpangaji'))) {
    if (has('rent') || has('kodi')) return 'rent_roll';
    return 'occupancy_register';
  }
  if (has('amount') && has('date') && (has('payer') || has('tenant'))) return 'payment_register';
  if (has('meter') && (has('water') || has('luku') || has('electric'))) return 'utility_register';
  if (has('vacancy') || has('listing')) return 'vacancy_listing';
  return null;
}

function extractCsvFacts(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<ExtractedFact> {
  const facts: ExtractedFact[] = [
    { kind: 'table.row_count', value: String(rows.length), confidence: 1 },
    { kind: 'table.column_count', value: String(headers.length), confidence: 1 },
  ];
  if (headers.length > 0) {
    facts.push({ kind: 'table.headers', value: headers.slice(0, 32).join(','), confidence: 1 });
  }
  const reKind = detectRealEstateTableKind(headers);
  if (reKind) {
    facts.push({ kind: 'realestate.table_kind', value: reKind, confidence: 0.85 });
  }
  return Object.freeze(facts);
}

function detectRealEstateDocKind(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(lease agreement|tenancy agreement|mkataba wa kodi)\b/.test(lower)) return 'lease_agreement';
  if (/\b(condition report|inspection report|hali ya nyumba)\b/.test(lower)) return 'condition_report';
  if (/\b(eviction|notice to quit|notisi ya kuondoka)\b/.test(lower)) return 'eviction_notice';
  if (/\b(title deed|hati ya nyumba|hati ya umiliki)\b/.test(lower)) return 'title_deed';
  if (/\b(utility bill|water bill|electric bill|luku|maji)\b/.test(lower)) return 'utility_bill';
  if (/\b(rent receipt|risiti ya kodi)\b/.test(lower)) return 'rent_receipt';
  if (/\b(maintenance request|matengenezo)\b/.test(lower)) return 'maintenance_request';
  return null;
}

function parseCsvDoc(doc: IncomingDoc): ParsedDoc {
  const text = doc.text ?? (doc.bytes ? bytesToText(doc.bytes) : '');
  const parsed = parseCsv(text, { hasHeader: true });
  const body = tableToText(parsed.headers, parsed.rows);
  return Object.freeze({
    text: body,
    table: { headers: parsed.headers, rows: parsed.rows },
    warnings: parsed.ingest_warnings,
    detectedLanguage: detectLanguage(body),
    extractedFacts: extractCsvFacts(parsed.headers, parsed.rows),
  });
}

function parseXlsxDoc(doc: IncomingDoc): ParsedDoc {
  if (!doc.bytes) throw new Error('xlsx ingest requires bytes payload');
  const parsed = parseExcel(doc.bytes);
  const body = tableToText(parsed.headers, parsed.rows);
  return Object.freeze({
    text: body,
    table: { headers: parsed.headers, rows: parsed.rows },
    warnings: parsed.ingest_warnings,
    detectedLanguage: detectLanguage(body),
    extractedFacts: extractCsvFacts(parsed.headers, parsed.rows),
  });
}

function parsePlainText(doc: IncomingDoc): ParsedDoc {
  const text = doc.text ?? (doc.bytes ? bytesToText(doc.bytes) : '');
  const facts: ExtractedFact[] = [{ kind: 'text.chars', value: String(text.length), confidence: 1 }];
  const docKind = detectRealEstateDocKind(text);
  if (docKind) facts.push({ kind: 'realestate.doc_kind', value: docKind, confidence: 0.8 });
  return Object.freeze({
    text,
    warnings: Object.freeze([]),
    detectedLanguage: detectLanguage(text),
    extractedFacts: Object.freeze(facts),
  });
}

function parseJsonDoc(doc: IncomingDoc): ParsedDoc {
  const raw = doc.text ?? (doc.bytes ? bytesToText(doc.bytes) : '');
  let body = raw;
  const warnings: string[] = [];
  const facts: ExtractedFact[] = [];
  try {
    const obj = JSON.parse(raw);
    body = JSON.stringify(obj, null, 2);
    if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>).slice(0, 32);
      facts.push({ kind: 'json.keys', value: keys.join(','), confidence: 1 });
    }
  } catch (err) {
    warnings.push(`json parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return Object.freeze({
    text: body,
    warnings,
    detectedLanguage: 'unknown',
    extractedFacts: Object.freeze(facts),
  });
}

function parsePdfDoc(doc: IncomingDoc): ParsedDoc {
  const bytes = doc.bytes ?? new Uint8Array();
  const sizeKb = Math.round(bytes.byteLength / 1024);
  const hint = `[pdf upload accepted - ${sizeKb}KB. Deep text extraction queued.]`;
  return Object.freeze({
    text: hint,
    warnings: Object.freeze(['pdf_deep_extraction_pending']),
    detectedLanguage: 'unknown',
    extractedFacts: Object.freeze([{ kind: 'pdf.size_kb', value: String(sizeKb), confidence: 1 }]),
  });
}

function parsePhotoDoc(doc: IncomingDoc): ParsedDoc {
  const bytes = doc.bytes ?? new Uint8Array();
  const sizeKb = Math.round(bytes.byteLength / 1024);
  const hint = `[photo upload accepted - ${sizeKb}KB. Vision + EXIF + OCR analysis queued.]`;
  return Object.freeze({
    text: hint,
    warnings: Object.freeze(['photo_vision_pending']),
    detectedLanguage: 'unknown',
    extractedFacts: Object.freeze([{ kind: 'photo.size_kb', value: String(sizeKb), confidence: 1 }]),
  });
}

function parseAudioDoc(doc: IncomingDoc): ParsedDoc {
  const bytes = doc.bytes ?? new Uint8Array();
  const sizeKb = Math.round(bytes.byteLength / 1024);
  const hint = `[audio upload accepted - ${sizeKb}KB. Whisper STT (sw+en) queued.]`;
  return Object.freeze({
    text: hint,
    warnings: Object.freeze(['audio_stt_pending']),
    detectedLanguage: doc.languageHint === 'sw' ? 'sw' : 'unknown',
    extractedFacts: Object.freeze([{ kind: 'audio.size_kb', value: String(sizeKb), confidence: 1 }]),
  });
}

export async function parseIncomingDoc(doc: IncomingDoc): Promise<ParsedDoc> {
  switch (doc.sourceKind) {
    case 'csv': return parseCsvDoc(doc);
    case 'xlsx': return parseXlsxDoc(doc);
    case 'text':
    case 'email':
    case 'webpage': return parsePlainText(doc);
    case 'json': return parseJsonDoc(doc);
    case 'pdf': return parsePdfDoc(doc);
    case 'photo': return parsePhotoDoc(doc);
    case 'audio': return parseAudioDoc(doc);
    default: {
      const _e: never = doc.sourceKind;
      void _e;
      throw new Error(`unsupported source kind: ${String(doc.sourceKind)}`);
    }
  }
}
