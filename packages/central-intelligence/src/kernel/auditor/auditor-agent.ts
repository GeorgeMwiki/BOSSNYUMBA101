/**
 * Auditor Agent — gate every junior recommendation before it reaches
 * the owner or executes a binding action.
 *
 * This is the canonical evidence-required-output enforcer for the
 * BossNyumba brain (CLAUDE.md → "Evidence-required AI output").
 * Every junior recommendation MUST cite at least one `evidence_id`
 * from memory, the property-management knowledge base, or the tenant
 * intelligence corpus. The Auditor Agent rejects any response with
 * an empty evidence chain.
 *
 * Two-stage flow:
 *
 *   1. Local validation — synchronous, deterministic, zero side
 *      effects. Rejects when `evidence_ids` is empty, when
 *      `confidence` is missing on a binding action, or when a
 *      binding action's confidence falls below the originating
 *      junior's floor (default 0.7).
 *
 *   2. Counter-model check (OPTIONAL — only when a CounterModel port
 *      is wired in by the composition root). Haiku reviews the
 *      recommendation against the junior's hard rules and returns
 *      approve / reject / needs_human + missing-evidence list.
 *
 * HARD RULE: this module is a PURE validator. It does NOT write to
 * the audit chain, the database, or any sink. The caller (api-gateway
 * composition root) is responsible for appending the Auditor's
 * verdict to the hash-chained audit log. Keeping the validator pure
 * means the kernel package can be unit-tested without any DB stub.
 *
 * BILINGUAL: rejection messages and remediation hints are emitted
 * in both English (`reason_en`) and Swahili (`reason_sw`) so the
 * default-Swahili UI surface can render the right copy without an
 * extra translation hop.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * The shape of a junior recommendation the Auditor inspects.
 *
 * `evidence_ids` is the load-bearing field — empty array triggers
 * an auto-reject in Stage 1. `binding === true` means the
 * recommendation would execute a side-effectful action (rent
 * notice, vendor payment, lease termination, etc.); the Auditor
 * tightens the confidence floor for those.
 */
export const RecommendationToAudit = z.object({
  origin_junior: z.string().min(1),
  recommendation_id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  evidence_ids: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  binding: z.boolean().default(false),
});
export type RecommendationToAudit = z.infer<typeof RecommendationToAudit>;

export const AuditorInputSchema = z.object({
  tenantId: z.string().min(1),
  recommendation: RecommendationToAudit,
  /**
   * Override the default 0.7 confidence floor for binding actions.
   * Some safety-critical juniors (eviction-notice, payout-executed)
   * raise their own floor higher.
   */
  confidenceFloor: z.number().min(0).max(1).optional(),
});
export type AuditorInput = z.infer<typeof AuditorInputSchema>;

export const AuditorVerdict = z.enum(['approve', 'reject', 'needs_human']);
export type AuditorVerdict = z.infer<typeof AuditorVerdict>;

export const AuditorOutputSchema = z.object({
  verdict: AuditorVerdict,
  missing_evidence: z.array(z.string()).default([]),
  counter_model_agrees: z.boolean(),
  required_actions: z.array(z.string()).default([]),
  /**
   * Caller-stable id the api-gateway uses when it persists the
   * verdict to the hash-chained audit log. We mint it here so the
   * Auditor's output is the single source of truth for the id; the
   * Auditor itself never writes the row.
   */
  audit_log_id: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  reason_en: z.string().min(1),
  reason_sw: z.string().min(1),
  evidence_ids: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
});
export type AuditorOutput = z.infer<typeof AuditorOutputSchema>;

// ─────────────────────────────────────────────────────────────────────
// Counter-model port (optional)
// ─────────────────────────────────────────────────────────────────────

/**
 * Minimal counter-model surface the Auditor calls in Stage 2.
 *
 * The kernel package keeps zero runtime LLM imports — the caller
 * passes a wrapped client (circuit-breaker, budget guard) at
 * composition time. When the port is absent, the Auditor skips
 * Stage 2 and returns Stage-1's verdict directly.
 */
export interface AuditorCounterModelOutcome {
  readonly verdict: AuditorVerdict;
  readonly missing_evidence: ReadonlyArray<string>;
  readonly rationale: string;
  readonly confidence: number;
}

export interface AuditorCounterModelPort {
  review(args: {
    tenantId: string;
    recommendation: RecommendationToAudit;
  }): Promise<AuditorCounterModelOutcome>;
}

// ─────────────────────────────────────────────────────────────────────
// System prompt (carried for parity + future Stage-2 wiring)
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIDENCE_FLOOR = 0.7;

export const AUDITOR_SYSTEM_PROMPT = [
  'You are the BOSSNYUMBA Auditor Agent.',
  '',
  'Mandate: verify the evidence chain on a peer junior recommendation.',
  'Reject when evidence_ids is empty or confidence is below the',
  'originating junior floor. Run a counter-model check on binding',
  'actions.',
  '',
  'Hard rules:',
  '- Auto-reject if recommendation.evidence_ids is empty.',
  '- Auto-reject if recommendation.binding === true AND',
  '  recommendation.confidence < the originating-junior floor (0.7 by',
  '  default).',
  '- For safety-critical recs (eviction / payout / cross-tenant),',
  '  require counter_model_agrees === true.',
  '',
  'Cite the junior whose hard rule was violated when rejecting.',
  'Cite the missing evidence kind (e.g. "lease_pdf", "kra_filing",',
  '"village_minute") when reject reason is missing_evidence.',
  '',
  'Return JSON with this shape:',
  '{ "verdict": "approve"|"reject"|"needs_human",',
  '  "missing_evidence": string[],',
  '  "counter_model_agrees": boolean,',
  '  "required_actions": string[],',
  '  "audit_log_id": string,',
  '  "confidence": number,',
  '  "rationale": string,',
  '  "evidence_ids": string[],',
  '  "citations": string[] }',
].join('\n');

// ─────────────────────────────────────────────────────────────────────
// Bilingual copy
// ─────────────────────────────────────────────────────────────────────

/**
 * Stage-1 rejection messages. The Auditor surfaces both languages on
 * every verdict so the consumer (admin web, owner cockpit, mobile)
 * can render either without an extra round-trip.
 *
 * The `id` keys here are stable — they show up in tests, dashboards,
 * and the audit chain.
 */
export const AUDITOR_REJECTION_COPY = Object.freeze({
  empty_evidence: {
    en: 'Auto-rejected: recommendation cites no evidence. Every junior recommendation must link at least one evidence_id from memory, the property knowledge base, or the tenant intelligence corpus.',
    sw: 'Imekataliwa moja kwa moja: pendekezo halina ushahidi wowote. Kila pendekezo la AI lazima litaje angalau evidence_id moja kutoka kumbukumbu, hifadhidata ya mali, au kumbukumbu za mteja.',
    remediation_en: 'Gather at least one evidence_id (lease_pdf, kra_filing, ledger_entry, village_minute, etc.) before re-submitting.',
    remediation_sw: 'Kusanya angalau evidence_id moja (kama lease_pdf, kra_filing, ledger_entry au village_minute) kabla ya kuwasilisha tena.',
  },
  binding_low_confidence: {
    en: 'Auto-rejected: binding action with confidence below the junior floor. Binding side-effects require deliberate certainty.',
    sw: 'Imekataliwa moja kwa moja: hatua inayofunga ina uhakika chini ya kiwango cha chini. Hatua zinazofunga zinahitaji uhakika wa makusudi.',
    remediation_en: 'Strengthen the evidence chain or escalate to a human reviewer before executing the binding action.',
    remediation_sw: 'Imarisha mlolongo wa ushahidi au mhamishe kwa mhakiki wa kibinadamu kabla ya kutekeleza hatua hii.',
  },
  binding_missing_confidence: {
    en: 'Auto-rejected: binding action did not report a confidence score. Every binding recommendation must include a calibrated confidence between 0 and 1.',
    sw: 'Imekataliwa moja kwa moja: hatua inayofunga haijaonyesha kiwango cha uhakika. Kila pendekezo la kufunga lazima liwe na uhakika kati ya 0 na 1.',
    remediation_en: 'Re-submit with an explicit confidence field on the recommendation.',
    remediation_sw: 'Wasilisha tena na uongeze uwanja wa uhakika kwenye pendekezo.',
  },
  approve: {
    en: 'Recommendation cleared the evidence-chain gate and the counter-model check.',
    sw: 'Pendekezo limepita ukaguzi wa mlolongo wa ushahidi na ukaguzi wa modeli ya pili.',
    remediation_en: '',
    remediation_sw: '',
  },
} as const);

export type AuditorRejectionKind = keyof typeof AUDITOR_REJECTION_COPY;

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export interface CreateAuditorAgentArgs {
  /**
   * Optional Stage-2 counter-model port. When omitted, Stage-2 is
   * skipped and the Stage-1 verdict is returned directly with
   * `counter_model_agrees: false`. Composition root wires this in
   * api-gateway.
   */
  readonly counterModel?: AuditorCounterModelPort;
  /**
   * Override the audit-log id generator (tests pin this to a
   * deterministic value).
   */
  readonly auditLogIdGenerator?: (input: AuditorInput) => string;
  /**
   * Default confidence floor for binding actions. Per-call overrides
   * via `AuditorInput.confidenceFloor` take precedence.
   */
  readonly defaultConfidenceFloor?: number;
}

export interface AuditorAgent {
  evaluate(input: AuditorInput): Promise<AuditorOutput>;
}

export function createAuditorAgent(
  args: CreateAuditorAgentArgs = {},
): AuditorAgent {
  const auditLogIdGen =
    args.auditLogIdGenerator ?? defaultAuditLogIdGenerator;
  const floor = args.defaultConfidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const counterModel = args.counterModel;

  return {
    async evaluate(input) {
      const validated = AuditorInputSchema.parse(input);
      const rec = validated.recommendation;
      const auditLogId = auditLogIdGen(validated);
      const effectiveFloor =
        typeof validated.confidenceFloor === 'number'
          ? validated.confidenceFloor
          : floor;

      // ── Stage 1: synchronous fail-fast gate ─────────────────────────
      const stage1 = runStage1Validation(rec, effectiveFloor);
      if (stage1) {
        return {
          ...stage1,
          audit_log_id: auditLogId,
        };
      }

      // ── Stage 2: counter-model (OPTIONAL) ───────────────────────────
      if (counterModel) {
        const stage2Outcome = await runStage2CounterModel({
          counterModel,
          tenantId: validated.tenantId,
          recommendation: rec,
        });
        return {
          verdict: stage2Outcome.verdict,
          missing_evidence: [...stage2Outcome.missing_evidence],
          counter_model_agrees: stage2Outcome.verdict === 'approve',
          required_actions:
            stage2Outcome.verdict === 'approve'
              ? []
              : [
                  AUDITOR_REJECTION_COPY.empty_evidence.remediation_en,
                ],
          audit_log_id: auditLogId,
          confidence: stage2Outcome.confidence,
          rationale: stage2Outcome.rationale,
          reason_en:
            stage2Outcome.verdict === 'approve'
              ? AUDITOR_REJECTION_COPY.approve.en
              : stage2Outcome.rationale,
          reason_sw:
            stage2Outcome.verdict === 'approve'
              ? AUDITOR_REJECTION_COPY.approve.sw
              : stage2Outcome.rationale,
          evidence_ids: [...rec.evidence_ids],
          citations: [
            `auditor:counter-model:${rec.origin_junior}`,
          ],
        };
      }

      // No counter-model wired — Stage 1 passed, approve.
      return {
        verdict: 'approve',
        missing_evidence: [],
        counter_model_agrees: false,
        required_actions: [],
        audit_log_id: auditLogId,
        confidence: rec.confidence ?? effectiveFloor,
        rationale:
          'Stage-1 evidence-chain gate passed; no counter-model wired.',
        reason_en: AUDITOR_REJECTION_COPY.approve.en,
        reason_sw: AUDITOR_REJECTION_COPY.approve.sw,
        evidence_ids: [...rec.evidence_ids],
        citations: [
          'CLAUDE.md — Evidence-required AI output',
          `auditor:${rec.origin_junior}`,
        ],
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Stage 1 — pure, synchronous
// ─────────────────────────────────────────────────────────────────────

type Stage1Reject = Omit<AuditorOutput, 'audit_log_id'>;

function runStage1Validation(
  rec: RecommendationToAudit,
  floor: number,
): Stage1Reject | null {
  if (rec.evidence_ids.length === 0) {
    const copy = AUDITOR_REJECTION_COPY.empty_evidence;
    return {
      verdict: 'reject',
      missing_evidence: ['evidence_ids'],
      counter_model_agrees: false,
      required_actions: [copy.remediation_en],
      confidence: 1,
      rationale:
        'Auto-rejected by Auditor Stage-1 gate: evidence_ids is empty.',
      reason_en: copy.en,
      reason_sw: copy.sw,
      evidence_ids: [rec.recommendation_id],
      citations: [
        'CLAUDE.md — Evidence-required AI output: every junior recommendation cites >=1 evidence_id.',
      ],
    };
  }

  if (rec.binding) {
    if (typeof rec.confidence !== 'number') {
      const copy = AUDITOR_REJECTION_COPY.binding_missing_confidence;
      return {
        verdict: 'reject',
        missing_evidence: ['confidence'],
        counter_model_agrees: false,
        required_actions: [copy.remediation_en],
        confidence: 1,
        rationale:
          'Auto-rejected by Auditor Stage-1 gate: binding action lacks a confidence score.',
        reason_en: copy.en,
        reason_sw: copy.sw,
        evidence_ids: [...rec.evidence_ids],
        citations: [
          'CLAUDE.md — Evidence-required AI output: binding actions require calibrated confidence.',
        ],
      };
    }
    if (rec.confidence < floor) {
      const copy = AUDITOR_REJECTION_COPY.binding_low_confidence;
      return {
        verdict: 'reject',
        missing_evidence: ['confidence_above_floor'],
        counter_model_agrees: false,
        required_actions: [copy.remediation_en],
        confidence: 1,
        rationale: `Auto-rejected by Auditor Stage-1 gate: binding action confidence ${rec.confidence} < floor ${floor}.`,
        reason_en: copy.en,
        reason_sw: copy.sw,
        evidence_ids: [...rec.evidence_ids],
        citations: [
          'CLAUDE.md — Evidence-required AI output: binding actions require confidence >= junior floor.',
        ],
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Stage 2 — counter-model
// ─────────────────────────────────────────────────────────────────────

interface Stage2Args {
  readonly counterModel: AuditorCounterModelPort;
  readonly tenantId: string;
  readonly recommendation: RecommendationToAudit;
}

async function runStage2CounterModel(
  args: Stage2Args,
): Promise<AuditorCounterModelOutcome> {
  try {
    const outcome = await args.counterModel.review({
      tenantId: args.tenantId,
      recommendation: args.recommendation,
    });
    return outcome;
  } catch (error) {
    // Fail-closed: a counter-model crash escalates rather than silently
    // approving the recommendation. The Stage-2 fallback verdict is
    // 'needs_human' so the four-eye queue sees it.
    return {
      verdict: 'needs_human',
      missing_evidence: ['counter_model_unavailable'],
      rationale: `Counter-model unavailable (${error instanceof Error ? error.message : String(error)}); escalating to human reviewer.`,
      confidence: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Default audit-log id generator
// ─────────────────────────────────────────────────────────────────────

function defaultAuditLogIdGenerator(input: AuditorInput): string {
  return `audit_${Date.now()}_${input.recommendation.recommendation_id}`;
}
