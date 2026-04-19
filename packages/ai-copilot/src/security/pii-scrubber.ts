/**
 * BOSSNYUMBA AI PII scrubber — Wave-11 AI security hardening.
 *
 * Removes personally-identifiable information from text BEFORE it reaches the
 * LLM (or a log sink). Tailored for East Africa:
 *   - Tanzania NIDA national ID
 *   - Tanzania TIN
 *   - +255 / +254 mobile numbers (Swahili + English context lines)
 *   - Email, credit card, SSN-like, IP, passport, API-key-ish tokens
 *
 * Swahili-aware: context patterns like "namba yangu ni …" or "kitambulisho
 * changu ni …" trigger scrubbing even when the surrounded number does not
 * match a standalone PII pattern.
 *
 * The scrubber is idempotent — running it twice on the same input returns the
 * same output (placeholders themselves are not re-matched).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PiiType =
  | 'national_id'
  | 'tin_number'
  | 'phone_number'
  | 'email'
  | 'credit_card'
  | 'bank_account'
  | 'passport'
  | 'ssn'
  | 'ip_address'
  | 'api_key';

export interface PiiMatch {
  readonly type: PiiType;
  readonly value: string;
  readonly replacement: string;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface PiiScrubResult {
  readonly scrubbed: string;
  readonly original: string;
  readonly piiFound: readonly PiiMatch[];
  readonly hasPii: boolean;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

interface PiiPattern {
  readonly type: PiiType;
  readonly regex: RegExp;
  readonly replacement: string;
}

// Note: we intentionally do NOT mark patterns as /g here to avoid lastIndex
// state bleed across calls — we rebuild a global regex inside scrubPii().
const PII_PATTERNS: readonly PiiPattern[] = [
  // Tanzania NIDA — 20 digits often dash-separated.
  {
    type: 'national_id',
    regex: /\b(19|20)\d{2}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2,4}\b/,
    replacement: '[NIDA_ID]',
  },
  // Tanzania TIN — labelled form.
  {
    type: 'tin_number',
    regex: /\bTIN[\s:]*\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/i,
    replacement: '[TIN]',
  },
  // Kenya +254 mobiles.
  {
    type: 'phone_number',
    regex: /\b(?:\+?254|0)\s?7\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/,
    replacement: '[PHONE]',
  },
  // Tanzania +255 mobiles.
  {
    type: 'phone_number',
    regex: /\b(?:\+?255|0)\s?[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/,
    replacement: '[PHONE]',
  },
  // International fallback — conservative.
  {
    type: 'phone_number',
    regex: /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/,
    replacement: '[PHONE]',
  },
  // Email.
  {
    type: 'email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    replacement: '[EMAIL]',
  },
  // Credit card.
  {
    type: 'credit_card',
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{3,7}\b/,
    replacement: '[CARD]',
  },
  // Labelled bank account.
  {
    type: 'bank_account',
    regex: /\b(?:account|a\/c|acct|akaunti)[\s:#]*\d{8,16}\b/i,
    replacement: '[ACCOUNT]',
  },
  // Passport.
  {
    type: 'passport',
    regex: /\b(?:passport|pasipoti)[\s:#]*[A-Z]{1,2}\d{6,9}\b/i,
    replacement: '[PASSPORT]',
  },
  // SSN-ish.
  {
    type: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    replacement: '[SSN]',
  },
  // IP.
  {
    type: 'ip_address',
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    replacement: '[IP]',
  },
  // API-key shape. Requires prefix to avoid every long word.
  {
    type: 'api_key',
    regex: /\b(?:sk|pk|api[_-]?key|token)[-_][A-Za-z0-9]{16,}\b/i,
    replacement: '[API_KEY]',
  },
];

interface ContextPattern {
  readonly regex: RegExp;
  readonly piiRegex: RegExp;
  readonly type: PiiType;
  readonly replacement: string;
}

const CONTEXT_PATTERNS: readonly ContextPattern[] = [
  // English/Swahili phone context.
  {
    regex:
      /(?:my\s+(?:phone\s+)?number\s+is|namba\s+yangu\s+ni|piga\s+simu|call\s+me\s+(?:on|at))\s+/i,
    piiRegex: /\+?\d[\d\s-]{7,}/,
    type: 'phone_number',
    replacement: '[PHONE]',
  },
  // Email context.
  {
    regex: /(?:my\s+email\s+is|email\s+yangu\s+ni|send\s+to)\s+/i,
    piiRegex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    type: 'email',
    replacement: '[EMAIL]',
  },
  // NIDA / national ID.
  {
    regex:
      /(?:my\s+(?:national\s+)?id(?:\s+number)?\s+is|kitambulisho\s+changu(?:\s+ni)?|nida\s+yangu(?:\s+ni)?)\s+/i,
    piiRegex: /\d[\d\s-]{8,}/,
    type: 'national_id',
    replacement: '[NIDA_ID]',
  },
];

// Monetary patterns — we do not scrub monetary amounts.
const MONETARY_PATTERNS: readonly RegExp[] = [
  /\bTSh\s*[\d,]+/i,
  /\bTZS\s*[\d,]+/i,
  /\bKSh\s*[\d,]+/i,
  /\bKES\s*[\d,]+/i,
  /\$\s*[\d,]+/,
  /\bUSD\s*[\d,]+/i,
  /[\d,]+\s*(?:shillings?|shilingi|laki|elfu|milioni|bilioni)\b/i,
];

// Placeholders we emit — never re-scrub them.
const PLACEHOLDER_RX =
  /\[(?:NIDA_ID|TIN|PHONE|EMAIL|CARD|ACCOUNT|PASSPORT|SSN|IP|API_KEY)\]/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMonetary(text: string, start: number, end: number): boolean {
  const ctxStart = Math.max(0, start - 40);
  const ctxEnd = Math.min(text.length, end + 20);
  const ctx = text.slice(ctxStart, ctxEnd);
  return MONETARY_PATTERNS.some((rx) => rx.test(ctx));
}

function overlapsPlaceholder(
  text: string,
  start: number,
  end: number,
): boolean {
  const ctxStart = Math.max(0, start - 10);
  const ctxEnd = Math.min(text.length, end + 10);
  return PLACEHOLDER_RX.test(text.slice(ctxStart, ctxEnd));
}

function dedupe(matches: readonly PiiMatch[]): readonly PiiMatch[] {
  if (matches.length <= 1) return matches;
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const result: PiiMatch[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = result[result.length - 1];
    if (cur.startIndex < prev.endIndex) {
      if (cur.endIndex - cur.startIndex > prev.endIndex - prev.startIndex) {
        result[result.length - 1] = cur;
      }
    } else {
      result.push(cur);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scrubPii(message: string): PiiScrubResult {
  if (!message) {
    return { scrubbed: '', original: message ?? '', piiFound: [], hasPii: false };
  }

  const matches: PiiMatch[] = [];

  for (const p of PII_PATTERNS) {
    const globalRegex = new RegExp(
      p.regex.source,
      p.regex.flags.includes('g') ? p.regex.flags : `${p.regex.flags}g`,
    );
    let m: RegExpExecArray | null;
    while ((m = globalRegex.exec(message)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (overlapsPlaceholder(message, start, end)) continue;
      if (p.type !== 'email' && p.type !== 'api_key') {
        if (isMonetary(message, start, end)) continue;
      }
      // Very short digit runs are likely false positives.
      if (
        p.type !== 'email' &&
        p.type !== 'api_key' &&
        m[0].replace(/[\s-]/g, '').length < 6
      ) {
        continue;
      }
      matches.push({
        type: p.type,
        value: m[0],
        replacement: p.replacement,
        startIndex: start,
        endIndex: end,
      });
    }
  }

  for (const ctx of CONTEXT_PATTERNS) {
    const ctxMatch = ctx.regex.exec(message);
    if (!ctxMatch) continue;
    const tail = message.slice(ctxMatch.index + ctxMatch[0].length);
    const piiMatch = ctx.piiRegex.exec(tail);
    if (!piiMatch) continue;
    const absoluteStart = ctxMatch.index + ctxMatch[0].length + piiMatch.index;
    const absoluteEnd = absoluteStart + piiMatch[0].length;
    if (overlapsPlaceholder(message, absoluteStart, absoluteEnd)) continue;
    matches.push({
      type: ctx.type,
      value: piiMatch[0],
      replacement: ctx.replacement,
      startIndex: absoluteStart,
      endIndex: absoluteEnd,
    });
  }

  const deduped = dedupe(matches);
  let scrubbed = message;
  const reverseOrder = [...deduped].sort((a, b) => b.startIndex - a.startIndex);
  for (const m of reverseOrder) {
    scrubbed =
      scrubbed.slice(0, m.startIndex) +
      m.replacement +
      scrubbed.slice(m.endIndex);
  }

  return {
    scrubbed,
    original: message,
    piiFound: deduped,
    hasPii: deduped.length > 0,
  };
}

/**
 * Audit record for compliance logs. Never contains the PII values themselves.
 */
export function buildPiiAuditRecord(result: PiiScrubResult): Readonly<Record<string, unknown>> {
  if (!result.hasPii) return {};
  const types = [...new Set(result.piiFound.map((m) => m.type))];
  return {
    piiDetected: true,
    piiTypes: types,
    piiCount: result.piiFound.length,
  };
}
