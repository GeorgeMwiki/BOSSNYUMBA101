/**
 * PII redaction for the blind-review pipeline.
 *
 * Before a marginal decision rationale is shown to a reviewer, identifying
 * tokens are redacted so the study stays blind and reverse-identification
 * is hard: national-ID numbers, lease reference numbers, phone numbers,
 * bank account numbers, emails, and titled names. Pure string work.
 *
 * @module @bossnyumba/blind-review/anonymise
 */

import type { MarginalDecisionRecord } from './types';

// Tanzania NIDA national-ID number (launch jurisdiction's real ID format).
const NIDA_REGEX = /\b\d{8}-\d{5}-\d{5}-\d{2}\b/g;
// East-African mobile MSISDN (+255 / 0 prefix, 7xx).
const PHONE_REGEX = /\b(?:\+?255|0)\s*7\d{2}\s*\d{3}\s*\d{3}\b/g;
// Long bank/account numbers.
const ACCOUNT_REGEX = /\b\d{10,16}\b/g;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
// BossNyumba lease reference, e.g. LSE-2026-0042.
const LEASE_REF_REGEX = /\bLSE-\d{4}-\d{3,6}\b/g;
const NAME_PATTERN =
  /\b(Mr|Mrs|Ms|Bw|Bibi|Mama|Baba)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/g;

export function anonymiseRationale(rationale: string): string {
  return rationale
    .replace(NIDA_REGEX, '[NIDA]')
    .replace(LEASE_REF_REGEX, '[LEASE_REF]')
    .replace(PHONE_REGEX, '[PHONE]')
    .replace(ACCOUNT_REGEX, '[ACCOUNT]')
    .replace(EMAIL_REGEX, '[EMAIL]')
    .replace(NAME_PATTERN, '[NAME]');
}

function stripPiiFromObject(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') {
      out[k] = anonymiseRationale(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === 'string' ? anonymiseRationale(item) : item,
      );
    } else if (v !== null && typeof v === 'object') {
      out[k] = stripPiiFromObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function anonymiseRecord(
  record: MarginalDecisionRecord,
): MarginalDecisionRecord {
  return {
    ...record,
    rationale: anonymiseRationale(record.rationale),
    snapshot: stripPiiFromObject(record.snapshot),
  };
}
