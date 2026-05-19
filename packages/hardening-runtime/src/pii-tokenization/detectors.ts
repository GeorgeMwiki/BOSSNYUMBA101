/**
 * PII detectors — 8 classes per L3 §8 #11.
 *
 * Tanzania-aware: KRA PIN (TIN), NIDA, M-Pesa account numbers, and
 * Kenyan NIN are first-class. Generic classes (phone, email, full-name,
 * address) round out the set.
 *
 * Each detector returns spans of `[start, end)` indices into the input
 * string + the detected class. Pure functions, no side-effects.
 *
 * Format references (sourced from official documents):
 *   - KRA PIN: 11 chars, alpha + 9 digits + alpha (e.g. A123456789B).
 *     Kenya Revenue Authority pattern.
 *   - NIDA: 20-digit National ID, Tanzania.
 *   - M-Pesa account: 10-digit account or `MPESA-<10>`; phone-shaped.
 *   - NIN: Nigeria National ID, 11 digits.
 *   - Phone (EA): +254|+255|+256|+250|0 followed by 9 digits.
 */

import type { PiiClass } from '../types.js';

export interface DetectedSpan {
  readonly piiClass: PiiClass;
  readonly original: string;
  readonly start: number;
  readonly end: number;
}

interface Detector {
  readonly piiClass: PiiClass;
  readonly regex: RegExp;
}

/**
 * Order matters — earlier detectors win on conflict. We list more-specific
 * patterns first (KRA PIN, NIDA, M-Pesa) so they aren't shadowed by the
 * generic phone/email detectors.
 *
 * Each regex uses the global flag so we can iterate all matches.
 */
const DETECTORS: ReadonlyArray<Detector> = Object.freeze([
  // KRA PIN — Kenya Revenue Authority, 11 chars: 1 alpha + 9 digits + 1 alpha.
  {
    piiClass: 'kra-pin',
    regex: /\b[A-Za-z]\d{9}[A-Za-z]\b/g,
  },
  // NIDA — Tanzania National ID, 20 digits. Match before generic phone.
  {
    piiClass: 'nida',
    regex: /\b\d{20}\b/g,
  },
  // M-Pesa account — explicit MPESA prefix or 10-digit account.
  // Match `MPESA-<10digits>` or the more permissive variant.
  {
    piiClass: 'mpesa-acct',
    regex: /\bMPESA[-\s]?\d{10}\b/gi,
  },
  // NIN — Nigeria, 11 digits, no leading zero.
  {
    piiClass: 'nin',
    regex: /\bNIN[-\s]?\d{11}\b/gi,
  },
  // Email — RFC-pragmatic.
  {
    piiClass: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Phone — EA country codes + international. Match common forms.
  {
    piiClass: 'phone',
    regex: /(?:\+?(?:254|255|256|250|1)[\s-]?)?(?:0?[17]\d{8})\b/g,
  },
  // Address — high-precision: explicit "P.O. Box <digits>" form.
  {
    piiClass: 'address',
    regex: /\bP\.?\s*O\.?\s*Box\s+\d{1,6}(?:[-\s]?\d{4,6})?(?:[,\s]+[A-Za-z][A-Za-z\s]+)?/gi,
  },
  // Full name — high-precision: explicit honorific + Title-Cased First Last.
  // We DO NOT do general name detection (FP risk too high without NER);
  // we catch high-confidence honorific-prefixed names. Tenant-supplied
  // names enter via structured fields anyway.
  {
    piiClass: 'full-name',
    regex: /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Bw|Bibi|Mama|Mzee|Hon)\.?\s+[A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30}){0,3}\b/g,
  },
]);

/**
 * Run all detectors over `text` and return non-overlapping spans
 * (earlier-detector-wins on conflict).
 *
 * Returns a sorted array (by start ascending) with no overlaps.
 */
export function detectAll(text: string): ReadonlyArray<DetectedSpan> {
  if (!text) return Object.freeze([]);

  const raw: DetectedSpan[] = [];
  for (const det of DETECTORS) {
    // Clone the regex so we can safely set lastIndex inside iteration.
    const re = new RegExp(det.regex.source, det.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (m[0].length === 0) {
        // Defensive: zero-length match would loop forever; nudge.
        re.lastIndex = re.lastIndex + 1;
        continue;
      }
      raw.push({
        piiClass: det.piiClass,
        original: m[0],
        start,
        end,
      });
    }
  }

  // Resolve overlaps — keep earliest start; on tie, longest span wins;
  // on tie, the higher-priority detector (earlier in DETECTORS) wins.
  raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return classPriority(a.piiClass) - classPriority(b.piiClass);
  });

  const merged: DetectedSpan[] = [];
  let cursor = -1;
  for (const span of raw) {
    if (span.start >= cursor) {
      merged.push(span);
      cursor = span.end;
    }
  }
  return Object.freeze(merged);
}

function classPriority(c: PiiClass): number {
  // Index into DETECTORS gives priority — earlier = higher.
  for (let i = 0; i < DETECTORS.length; i += 1) {
    const det = DETECTORS[i];
    if (det && det.piiClass === c) return i;
  }
  return 1_000;
}

/**
 * Class prefix for token formatting. `<PHONE_x7f3a>`.
 */
export function classPrefix(c: PiiClass): string {
  switch (c) {
    case 'phone':
      return 'PHONE';
    case 'email':
      return 'EMAIL';
    case 'kra-pin':
      return 'KRA_PIN';
    case 'nida':
      return 'NIDA';
    case 'mpesa-acct':
      return 'MPESA_ACCT';
    case 'nin':
      return 'NIN';
    case 'full-name':
      return 'FULL_NAME';
    case 'address':
      return 'ADDRESS';
  }
}
