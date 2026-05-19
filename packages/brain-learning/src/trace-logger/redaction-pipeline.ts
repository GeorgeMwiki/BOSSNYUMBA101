/**
 * 4-layer PII redaction pipeline (write-path only).
 *
 * Layer order (CRITICAL — must run in this sequence):
 *   1. regex          — structured PII patterns (M-E reuses these)
 *   2. ml             — ML classifier catches unstructured PII regex misses
 *   3. canary         — N-D canary tokens (alignment audit immune system)
 *   4. consent        — per-tenant opt-in gate for training data use
 *
 * Each layer can either pass-through, redact, or quarantine. If any layer
 * decides 'quarantined' the trace is held for human review and never
 * reaches storage. Layers are wire-agnostic — the ML and canary layers
 * are ports (`MLRedactor`, `CanaryChecker`) so this package has no
 * runtime dependency on Haiku 4.5 or the canary registry.
 *
 * NIST AI RMF compliance: every redaction action stamps
 * (model_version, policy_version, layersFired, action, redactedAt,
 * actorId).
 */

import type { RedactionAudit, RedactionLayer } from '../types.js';

/**
 * Input to the redaction pipeline.
 */
export interface RedactionInput {
  readonly tenantId: string;
  readonly content: string;
  /** Per-tenant opt-in: may this be used as training data? */
  readonly consentForTraining: boolean;
  /** Optional caller (kernel adapter, ingestion worker, etc.). */
  readonly actorId: string;
}

/**
 * Output of the redaction pipeline.
 */
export interface RedactionOutput {
  readonly redactedContent: string;
  readonly audit: RedactionAudit;
  /**
   * If the pipeline quarantined the input, redactedContent is the
   * empty string and downstream must NOT persist.
   */
  readonly quarantined: boolean;
}

/**
 * Structured-PII regex set. Mirrors M-E's existing PII patterns:
 *   - email
 *   - phone (E.164-loose)
 *   - KE national-ID (\d{8})
 *   - TZ NIDA (20 digits)
 *   - ZA RSA-ID (13 digits)
 *   - M-Pesa MSISDN (+254 7XX XXX XXX)
 *   - generic credit card (16-digit run with optional spaces/dashes)
 */
const STRUCTURED_PII_PATTERNS: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
  readonly token: string;
}> = [
  {
    name: 'email',
    pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    token: '<email>',
  },
  // MSISDN must precede generic phone — order matters.
  {
    name: 'mpesa-msisdn',
    pattern: /\+?254[\s-]?7\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
    token: '<msisdn>',
  },
  {
    name: 'tz-nida',
    pattern: /\b\d{20}\b/g,
    token: '<tz_nida>',
  },
  {
    name: 'credit-card',
    pattern: /\b(?:\d[\s-]?){13,19}\d\b/g,
    token: '<card>',
  },
  {
    name: 'za-rsa-id',
    pattern: /\b\d{13}\b/g,
    token: '<za_id>',
  },
  {
    name: 'phone',
    pattern: /\+?\d[\d\s().-]{7,}\d/g,
    token: '<phone>',
  },
  {
    name: 'ke-national-id',
    pattern: /\b\d{8}\b/g,
    token: '<ke_id>',
  },
];

/**
 * Layer 1 — regex pass. Pure; no side effects.
 */
export function redactByRegex(content: string): {
  redacted: string;
  fired: boolean;
} {
  let result = content;
  let fired = false;
  for (const { pattern, token } of STRUCTURED_PII_PATTERNS) {
    const before = result;
    result = result.replace(pattern, token);
    if (result !== before) fired = true;
  }
  return { redacted: result, fired };
}

/**
 * Layer 2 — ML classifier port. Wire-side typically plugs in Haiku 4.5
 * with a 100ms cached prompt. The port is sync-free; implementations
 * may proxy a Promise but the redaction pipeline awaits it.
 */
export interface MLRedactor {
  redact(input: { tenantId: string; content: string }): Promise<{
    redacted: string;
    fired: boolean;
  }>;
}

/**
 * Layer 3 — canary check port. Phase N-D's alignment auditor seeds
 * canary tokens into prompts; if they appear in outgoing traces the
 * model is leaking the audit harness — which is a signal to quarantine
 * the trace (never use it for training).
 */
export interface CanaryChecker {
  detect(content: string): Promise<{ hits: number; canaryIds: string[] }>;
}

/**
 * Layer 4 — consent gate. If the tenant has not opted in to training-
 * data use, content STILL gets stored for hot-tier replay/debug, but
 * the audit flags it so preference-pair-builder skips it.
 *
 * This layer is intentionally pure — no I/O.
 */
export function applyConsentGate(input: {
  consentForTraining: boolean;
}): { fired: boolean; action: 'redacted' | 'pass-through' } {
  return input.consentForTraining
    ? { fired: false, action: 'pass-through' }
    : { fired: true, action: 'redacted' };
}

/**
 * Configuration for the pipeline. Versions are stamped onto every
 * RedactionAudit.
 */
export interface RedactionPipelineConfig {
  readonly modelVersion: string;
  readonly policyVersion: string;
  readonly clock: () => Date;
}

/**
 * Compose the 4 layers. Always runs in order: regex → ml → canary →
 * consent. Canary HIT ⇒ quarantined and the function returns early.
 */
export function makeRedactionPipeline(args: {
  ml: MLRedactor;
  canary: CanaryChecker;
  config: RedactionPipelineConfig;
}): RedactionPipeline {
  return {
    async run(input: RedactionInput): Promise<RedactionOutput> {
      const layersFired: RedactionLayer[] = [];

      // ── Layer 1: regex ──
      const r1 = redactByRegex(input.content);
      let current = r1.redacted;
      if (r1.fired) layersFired.push('regex');

      // ── Layer 2: ML ──
      const r2 = await args.ml.redact({
        tenantId: input.tenantId,
        content: current,
      });
      current = r2.redacted;
      if (r2.fired) layersFired.push('ml');

      // ── Layer 3: canary ──
      const canary = await args.canary.detect(current);
      if (canary.hits > 0) {
        layersFired.push('canary');
        return Object.freeze({
          redactedContent: '',
          quarantined: true,
          audit: Object.freeze({
            modelVersion: args.config.modelVersion,
            policyVersion: args.config.policyVersion,
            layersFired: Object.freeze([...layersFired]),
            action: 'quarantined',
            redactedAt: args.config.clock().toISOString(),
            actorId: input.actorId,
          }),
        });
      }

      // ── Layer 4: consent ──
      const consent = applyConsentGate({
        consentForTraining: input.consentForTraining,
      });
      if (consent.fired) layersFired.push('consent');

      const anyFired = layersFired.length > 0;
      return Object.freeze({
        redactedContent: current,
        quarantined: false,
        audit: Object.freeze({
          modelVersion: args.config.modelVersion,
          policyVersion: args.config.policyVersion,
          layersFired: Object.freeze([...layersFired]),
          action: anyFired ? 'redacted' : 'pass-through',
          redactedAt: args.config.clock().toISOString(),
          actorId: input.actorId,
        }),
      });
    },
  };
}

/**
 * Public surface of the redaction pipeline. Implementations are usually
 * obtained via `makeRedactionPipeline`.
 */
export interface RedactionPipeline {
  run(input: RedactionInput): Promise<RedactionOutput>;
}
