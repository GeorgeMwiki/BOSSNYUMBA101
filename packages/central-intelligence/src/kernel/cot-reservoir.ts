/**
 * CoT reservoir — sampled chain-of-thought capture for audit replay.
 *
 * Storing every chain-of-thought is too expensive; storing none means
 * a regulator who later asks "why did the system say X?" gets nothing
 * to inspect. The reservoir is a probabilistic sample biased toward
 * high-stakes decisions:
 *
 *   stakes='low'      → 1% sample
 *   stakes='medium'   → 5% sample
 *   stakes='high'     → 50% sample
 *   stakes='critical' → 100% sample
 *
 * Wave-K parity update: every persisted sample is run through a
 * Tanzania/Kenya-aware PII scrubber BEFORE writing to the sink, and
 * SHA-256 hashes of the original prompt + sanitised response are
 * carried alongside the redacted text. Mirrors LITFIN
 * `cot-recorder.ts:35-78`.
 *
 * The sink interface is storage-agnostic; production binds to the
 * `cot_reservoir` Postgres table, tests use an in-memory recorder.
 */

import { createHash } from 'node:crypto';
import type { CotSample, CotReservoirSink, ThoughtRequest } from './kernel-types.js';

const SAMPLE_RATES: Record<ThoughtRequest['stakes'], number> = {
  low: 0.01,
  medium: 0.05,
  high: 0.5,
  critical: 1.0,
};

export interface CotReservoirDeps {
  readonly sink: CotReservoirSink;
  /** Injectable RNG so tests can be deterministic. */
  readonly rng?: () => number;
}

export interface CotReservoirCaptureInput {
  readonly thoughtId: string;
  readonly threadId: string;
  readonly stakes: ThoughtRequest['stakes'];
  readonly thoughtText: string | null;
  readonly capturedAt: string;
}

export interface CotReservoir {
  maybeCapture(input: CotReservoirCaptureInput): Promise<{ sampled: boolean }>;
}

// ─────────────────────────────────────────────────────────────────────
// PII scrubber — Tanzania/Kenya-aware. Mirrors policy-gate's PII_PATTERNS
// with the addition of KRA PIN, M-Pesa till/paybill shapes, and Kenyan
// national-ID (8 digits) which the policy-gate output redactor does
// NOT currently catch (output text is the user-facing surface and KRA
// PINs are not expected to be echoed there; CoT thought text, however,
// can contain anything the model "thought").
// ─────────────────────────────────────────────────────────────────────

interface PiiPattern {
  readonly kind: string;
  readonly re: RegExp;
  readonly replace: string;
}

const COT_PII_PATTERNS: ReadonlyArray<PiiPattern> = [
  { kind: 'phone-tz',   re: /\+?255[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  { kind: 'phone-ke',   re: /\+?254[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  // Formatted local mobile shape — REQUIRES a consistent separator
  // (e.g. `0712 345 678` or `0712-345-678`). Un-formatted 10-digit
  // strings (invoice numbers, internal IDs) no longer false-positive
  // here; bare-phone strings still get scrubbed via the cue-word
  // path below.
  { kind: 'phone-gen',  re: /\b0[67]\d{2}([\s-])\d{3}\1\d{3}\b/g,       replace: '[redacted-phone]' },
  { kind: 'email',      re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,  replace: '[redacted-email]' },
  { kind: 'nida-tz',    re: /\b\d{8}-\d{5}-\d{5}-\d{2}\b/g,             replace: '[redacted-nida]' },
  { kind: 'kra-pin',    re: /\b[A-Z]\d{9}[A-Z]\b/g,                     replace: '[redacted-kra-pin]' },
  // Kenyan national ID is a bare 8-digit number; only redact when it
  // appears with an "ID"/"NID" cue to avoid mauling unit-counts.
  { kind: 'id-ke',      re: /\b(?:ID|NID|National[\s-]?ID)[\s:.#-]*\d{8}\b/gi, replace: '[redacted-id]' },
  // M-Pesa till/paybill numbers — 5-7 digits typically prefixed by
  // "till", "paybill", or "M-Pesa".
  { kind: 'mpesa-till', re: /\b(?:till|paybill|M[-\s]?Pesa)[\s#:.-]*\d{5,7}\b/gi, replace: '[redacted-mpesa]' },
  // Cue-anchored bare 10-digit local mobile — only scrub when a phone
  // cue word ("phone", "tel", "call", "reach", "whatsapp", "mpesa",
  // "sms", "mobile", "cell") sits immediately before the number
  // (within ~30 chars of separator/punctuation). This restores
  // coverage for `phone: 0712345678` while keeping `INV-0712345678`
  // and bare invoice numbers intact. The cue word is consumed in the
  // match (same convention as `mpesa-till`).
  {
    kind: 'phone-cue',
    re: /\b(?:phone|tel(?:ephone)?|call|reach|whatsapp|mpesa|sms|mobile|cell(?:phone)?)[\s#:.\-]{0,30}0[67]\d{8}\b/gi,
    replace: '[redacted-phone]',
  },
];

/**
 * Best-effort scrub of CoT thought text. Pure; idempotent. Returns
 * `{ sanitized, mutations }` so callers can log which categories fired
 * without needing to re-run the regexes.
 */
export function scrubCotText(input: string): {
  readonly sanitized: string;
  readonly mutations: ReadonlyArray<string>;
} {
  let text = input;
  const mutations: string[] = [];
  for (const p of COT_PII_PATTERNS) {
    if (p.re.test(text)) {
      text = text.replace(p.re, p.replace);
      mutations.push(`scrubbed:${p.kind}`);
    }
  }
  return { sanitized: text, mutations };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function createCotReservoir(deps: CotReservoirDeps): CotReservoir {
  const rng = deps.rng ?? Math.random;
  return {
    async maybeCapture(input) {
      if (!input.thoughtText) return { sampled: false };
      const rate = SAMPLE_RATES[input.stakes];
      if (rng() >= rate) return { sampled: false };
      const { sanitized } = scrubCotText(input.thoughtText);
      const sample: CotSample = {
        thoughtId: input.thoughtId,
        threadId: input.threadId,
        stakes: input.stakes,
        thoughtText: sanitized,
        promptHash: sha256Hex(input.thoughtText),
        responseHash: sha256Hex(sanitized),
        capturedAt: input.capturedAt,
      };
      await deps.sink.capture(sample);
      return { sampled: true };
    },
  };
}

/**
 * In-memory sink useful for tests. Production wires a Postgres-backed
 * sink at the composition root.
 */
export function createInMemoryCotReservoirSink(): CotReservoirSink & {
  samples(): ReadonlyArray<CotSample>;
} {
  const buf: CotSample[] = [];
  return {
    async capture(sample: CotSample): Promise<void> {
      buf.push(sample);
    },
    samples(): ReadonlyArray<CotSample> {
      return buf.slice();
    },
  };
}

/**
 * In-memory persona-drift sink — companion to the Cot one. Used in
 * tests to assert what the kernel detected.
 */
import type { PersonaDriftEvent, PersonaDriftSink, ProvenanceRecord, ProvenanceSink } from './kernel-types.js';

export function createInMemoryPersonaDriftSink(): PersonaDriftSink & {
  events(): ReadonlyArray<PersonaDriftEvent>;
} {
  const buf: PersonaDriftEvent[] = [];
  return {
    async record(event: PersonaDriftEvent): Promise<void> {
      buf.push(event);
    },
    events(): ReadonlyArray<PersonaDriftEvent> {
      return buf.slice();
    },
  };
}

export function createInMemoryProvenanceSink(): ProvenanceSink & {
  records(): ReadonlyArray<ProvenanceRecord>;
} {
  const buf: ProvenanceRecord[] = [];
  return {
    async record(rec: ProvenanceRecord): Promise<void> {
      buf.push(rec);
    },
    records(): ReadonlyArray<ProvenanceRecord> {
      return buf.slice();
    },
  };
}
